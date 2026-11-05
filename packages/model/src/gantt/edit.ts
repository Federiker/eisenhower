import { addDays, type CalendarDay, compareDays, daysBetween, isCalendarDay } from "../common/days";
import type { Colour } from "../common/palette";
import { done, type EditResult, refused } from "../common/result";
import { nameProblem } from "../common/text";
import { dependsOnTask } from "./graph";
import { type GanttSection, ganttSections } from "./layout";
import {
  type Gantt,
  type GanttGroup,
  type GanttProblem,
  type GanttTask,
  ganttProblems,
  ganttSchema,
  MAX_DEPENDENCIES,
  MAX_GANTT_GROUPS,
  MAX_GANTT_TASKS,
} from "./schema";

/** An edit's outcome: the new chart, or why there is none. */
export type GanttResult = EditResult<Gantt, GanttProblem>;

/** What happens to the tasks of a deleted group: they join the group before or after it, go outside every group, or go with it. */
export type GanttGroupDisposal = "before" | "after" | "outside" | "delete";

/** Which end of a task a resize moves. */
export type TaskEdge = "start" | "end";

/**
 * How the edits that move tasks behave. With `autoSchedule` (Move dependent tasks), a task goes no earlier than
 * the day after the last day of the tasks it depends on, and the tasks that depend on it are pushed later as far
 * as needed. Off by default: nothing moves by itself.
 */
export type GanttEditOptions = { autoSchedule?: boolean };

/** The finished chart, or "invalid" when it would not pass its schema and checks (never stored half right). */
function checked(gantt: Gantt): GanttResult {
  if (!ganttSchema.safeParse(gantt).success || ganttProblems(gantt).length > 0) return refused("invalid");
  return done(gantt);
}

/** The chart with its tasks laid out again from sections (outside every group first, then group by group). */
function fromSections(gantt: Gantt, sections: readonly GanttSection[]): Gantt {
  return {
    ...gantt,
    tasks: sections.flatMap((section) =>
      section.tasks.map((task) => (task.groupId === section.groupId ? task : { ...task, groupId: section.groupId })),
    ),
  };
}

/**
 * The chart with one task changed by `change`, or "missing". With `autoSchedule`, a change to its days pushes
 * the tasks that depend on it ({@link scheduled}).
 */
function withTask(
  gantt: Gantt,
  id: string,
  change: (task: GanttTask) => GanttTask | GanttProblem,
  options: GanttEditOptions = {},
): GanttResult {
  const task = gantt.tasks.find((one) => one.id === id);
  if (!task) return refused("missing");
  const next = change(task);
  if (typeof next === "string") return refused(next);
  return scheduled({ ...gantt, tasks: gantt.tasks.map((one) => (one.id === id ? next : one)) }, task, next, options);
}

/** The tasks of a chart by their ids. */
function tasksById(gantt: Gantt): Map<string, GanttTask> {
  return new Map(gantt.tasks.map((task) => [task.id, task]));
}

/** The last day of the tasks a task depends on (those that are there), or null when it depends on none. */
function lastPredecessorEnd(byId: ReadonlyMap<string, GanttTask>, task: GanttTask): CalendarDay | null {
  let last: CalendarDay | null = null;
  for (const id of task.dependsOn) {
    const end = byId.get(id)?.end;
    if (end !== undefined && (last === null || compareDays(end, last) > 0)) last = end;
  }
  return last;
}

/**
 * The first day a task may start on: the day after the last day of the tasks it depends on. Null when it
 * depends on none, is not in the chart, or when a task it depends on ends on the calendar's last day (9999-12-31).
 */
export function earliestStart(gantt: Gantt, id: string): CalendarDay | null {
  const task = gantt.tasks.find((one) => one.id === id);
  if (!task) return null;
  const last = lastPredecessorEnd(tasksById(gantt), task);
  return last === null ? null : dayAfter(last, 1);
}

/** The task moved (both its days, keeping its length) to start on a day, or null past the calendar's years. */
function startingOn(task: GanttTask, start: CalendarDay): GanttTask | null {
  const end = dayAfter(start, daysBetween(task.start, task.end));
  return end ? { ...task, start, end } : null;
}

/**
 * The task as it is when it starts after the last day of the tasks it depends on, or else moved (keeping its
 * length) to start the day after; "invalid" when that day is past the calendar's years.
 */
function afterPredecessors(byId: ReadonlyMap<string, GanttTask>, task: GanttTask): GanttTask | "invalid" {
  const last = lastPredecessorEnd(byId, task);
  if (last === null || compareDays(task.start, last) > 0) return task;
  const start = dayAfter(last, 1);
  return (start === null ? null : startingOn(task, start)) ?? "invalid";
}

/**
 * The chart with the tasks that depend on one task (directly or through others) pushed later as far as needed:
 * in dependency order, each one that starts on or before the last day of the tasks it depends on starts the day
 * after, keeping its length. A gap absorbs a move, nothing is pulled earlier, and the tasks that do not depend on
 * it are left as they are (the same objects). Null when a push passes the calendar's years.
 */
function pushDependents(gantt: Gantt, id: string): Gantt | null {
  const successors = new Map<string, string[]>();
  for (const task of gantt.tasks) {
    for (const predecessor of task.dependsOn) {
      const list = successors.get(predecessor);
      if (list) list.push(task.id);
      else successors.set(predecessor, [task.id]);
    }
  }
  const reached = new Set<string>();
  const stack = [...(successors.get(id) ?? [])];
  while (stack.length > 0) {
    const next = stack.pop()!;
    if (reached.has(next)) continue;
    reached.add(next);
    stack.push(...(successors.get(next) ?? []));
  }
  const byId = tasksById(gantt);
  // How many of each reached task's predecessors are still to be placed; a task is placed once they all are.
  const waiting = new Map(
    [...reached].map((one) => [one, byId.get(one)!.dependsOn.filter((other) => reached.has(other)).length]),
  );
  const ready = [...reached].filter((one) => waiting.get(one) === 0);
  let moved = false;
  while (ready.length > 0) {
    const current = ready.shift()!;
    const task = byId.get(current)!;
    const placed = afterPredecessors(byId, task);
    if (placed === "invalid") return null;
    if (placed !== task) {
      byId.set(current, placed);
      moved = true;
    }
    for (const successor of successors.get(current) ?? []) {
      const count = waiting.get(successor)!;
      waiting.set(successor, count - 1);
      if (count === 1) ready.push(successor);
    }
  }
  return moved ? { ...gantt, tasks: gantt.tasks.map((task) => byId.get(task.id)!) } : gantt;
}

/**
 * The finished chart after a task changed from `before` to `after`: with `autoSchedule` and new days, the tasks
 * that depend on it are pushed as far as needed ({@link pushDependents}), or the edit is refused ("invalid")
 * when a push would pass the calendar's years.
 */
function scheduled(gantt: Gantt, before: GanttTask, after: GanttTask, options: GanttEditOptions): GanttResult {
  if (!options.autoSchedule || (before.start === after.start && before.end === after.end)) return checked(gantt);
  const pushed = pushDependents(gantt, after.id);
  return pushed ? checked(pushed) : refused("invalid");
}

/** A new group, at the end of the groups unless `index` says where. */
export function addGanttGroup(gantt: Gantt, id: string, name: string, index = gantt.groups.length): GanttResult {
  const problem = nameProblem(name);
  if (problem) return refused(problem);
  if (gantt.groups.length >= MAX_GANTT_GROUPS) return refused("limit");
  if (gantt.groups.some((group) => group.id === id)) return refused("duplicate");
  const groups = [...gantt.groups];
  groups.splice(Math.max(0, Math.min(groups.length, index)), 0, { id, name: name.trim(), collapsed: false });
  return checked({ ...gantt, groups });
}

export function renameGanttGroup(gantt: Gantt, id: string, name: string): GanttResult {
  if (!gantt.groups.some((group) => group.id === id)) return refused("missing");
  const problem = nameProblem(name);
  if (problem) return refused(problem);
  return checked({
    ...gantt,
    groups: gantt.groups.map((group) => (group.id === id ? { ...group, name: name.trim() } : group)),
  });
}

/** Moves a group (with its tasks) to another place among the groups (its index after the move). */
export function moveGanttGroup(gantt: Gantt, id: string, to: number): GanttResult {
  const from = gantt.groups.findIndex((group) => group.id === id);
  if (from < 0) return refused("missing");
  const groups: GanttGroup[] = [...gantt.groups];
  const [group] = groups.splice(from, 1);
  groups.splice(Math.max(0, Math.min(groups.length, to)), 0, group!);
  return checked(fromSections({ ...gantt, groups }, ganttSections({ ...gantt, groups })));
}

/** Folds a group's tasks under its summary row, or unfolds them. */
export function setGanttGroupCollapsed(gantt: Gantt, id: string, collapsed: boolean): GanttResult {
  if (!gantt.groups.some((group) => group.id === id)) return refused("missing");
  return checked({
    ...gantt,
    groups: gantt.groups.map((group) => (group.id === id ? { ...group, collapsed } : group)),
  });
}

/** Folds a group if it is unfolded, and the other way round. */
export function toggleGanttGroup(gantt: Gantt, id: string): GanttResult {
  const group = gantt.groups.find((one) => one.id === id);
  if (!group) return refused("missing");
  return setGanttGroupCollapsed(gantt, id, !group.collapsed);
}

/**
 * Gives a group a palette colour, or takes it away (null: the field is left out, as in a group that never had
 * one). The group's tasks keep their own colours.
 */
export function setGanttGroupColour(gantt: Gantt, id: string, colour: Colour): GanttResult {
  if (!gantt.groups.some((group) => group.id === id)) return refused("missing");
  return checked({
    ...gantt,
    groups: gantt.groups.map((group) => {
      if (group.id !== id) return group;
      const { colour: _old, ...rest } = group;
      return colour === null ? rest : { ...rest, colour };
    }),
  });
}

/** The tasks of a group. */
export function tasksInGanttGroup(gantt: Gantt, id: string): number {
  return gantt.tasks.filter((task) => task.groupId === id).length;
}

/** The chart without some tasks, and without the dependencies on them. */
function withoutTasks(gantt: Gantt, ids: ReadonlySet<string>): Gantt {
  return {
    ...gantt,
    tasks: gantt.tasks
      .filter((task) => !ids.has(task.id))
      .map((task) =>
        task.dependsOn.some((id) => ids.has(id))
          ? { ...task, dependsOn: task.dependsOn.filter((id) => !ids.has(id)) }
          : task,
      ),
  };
}

/**
 * Deletes a group. Its tasks join the end of the group before it or the start of the group after it (so they
 * keep their place in the rows), the end of the tasks outside every group, or are deleted with it (and the
 * dependencies on them with them).
 */
export function deleteGanttGroup(gantt: Gantt, id: string, disposal: GanttGroupDisposal): GanttResult {
  const index = gantt.groups.findIndex((group) => group.id === id);
  if (index < 0) return refused("missing");
  const sections = ganttSections(gantt);
  const own = sections[index + 1]!;
  const rest = sections.filter((section) => section !== own);
  const groups = gantt.groups.filter((group) => group.id !== id);
  if (disposal === "delete") {
    return checked(withoutTasks({ ...gantt, groups }, new Set(own.tasks.map((task) => task.id))));
  }
  if (disposal === "before" || disposal === "after") {
    const neighbour = gantt.groups[disposal === "before" ? index - 1 : index + 1];
    if (!neighbour) return refused("missing");
    const target = rest.find((section) => section.groupId === neighbour.id)!;
    target.tasks = disposal === "before" ? [...target.tasks, ...own.tasks] : [...own.tasks, ...target.tasks];
  } else {
    rest[0]!.tasks = [...rest[0]!.tasks, ...own.tasks];
  }
  return checked(fromSections({ ...gantt, groups }, rest));
}

/**
 * A new task with nothing but its name and days: in a group or none, not done, without dependencies, in
 * `colour` (none by default; the view gives a task made in a group its group's colour).
 */
export function blankGanttTask(
  id: string,
  name: string,
  start: CalendarDay,
  end: CalendarDay,
  groupId: string | null,
  colour: Colour = null,
): GanttTask {
  return { id, name, groupId, start, end, milestone: false, progress: 0, colour, dependsOn: [] };
}

/** Why a task as a whole cannot be stored, or null: its name, its days, its progress. Its links are the chart's. */
function taskProblem(task: GanttTask): GanttProblem | null {
  const problem = nameProblem(task.name);
  if (problem) return problem;
  if (!isCalendarDay(task.start) || !isCalendarDay(task.end)) return "invalid";
  if (compareDays(task.end, task.start) < 0) return "order";
  if (task.milestone && task.end !== task.start) return "invalid";
  if (!Number.isInteger(task.progress) || task.progress < 0 || task.progress > 100) return "invalid";
  return null;
}

/** Why a task's dependencies cannot be stored in the chart, or null: missing tasks, itself, twice, a cycle. */
function dependencyProblem(gantt: Gantt, task: GanttTask): GanttProblem | null {
  if (task.dependsOn.length > MAX_DEPENDENCIES) return "limit";
  if (new Set(task.dependsOn).size !== task.dependsOn.length) return "duplicate";
  if (task.dependsOn.includes(task.id)) return "cycle";
  if (task.dependsOn.some((id) => !gantt.tasks.some((one) => one.id === id && one.id !== task.id))) return "missing";
  const others = gantt.tasks.filter((one) => one.id !== task.id);
  if (task.dependsOn.some((id) => dependsOnTask([...others, task], id, task.id))) return "cycle";
  return null;
}

/** Adds a task to its group (or outside every group) at this place in it, at its end by default. */
export function addGanttTask(gantt: Gantt, task: GanttTask, index = Number.MAX_SAFE_INTEGER): GanttResult {
  const named = { ...task, name: task.name.trim() };
  const problem = taskProblem(named);
  if (problem) return refused(problem);
  if (gantt.tasks.length >= MAX_GANTT_TASKS) return refused("limit");
  if (gantt.tasks.some((one) => one.id === task.id)) return refused("duplicate");
  const sections = ganttSections(gantt);
  const section = sections.find((one) => one.groupId === task.groupId);
  if (!section) return refused("missing");
  const links = dependencyProblem(gantt, named);
  if (links) return refused(links);
  section.tasks = [...section.tasks];
  section.tasks.splice(Math.max(0, Math.min(section.tasks.length, index)), 0, named);
  return checked(fromSections(gantt, sections));
}

/**
 * Replaces a task by its id (what the task dialog saves). A task that stays in its group keeps its place; one
 * given another group goes to the end of that group. A milestone is given its start as its end. With
 * `autoSchedule`, a task that would start on or before the last day of the tasks it now depends on starts the day
 * after (keeping its length), and new days push the tasks that depend on it.
 */
export function putGanttTask(gantt: Gantt, task: GanttTask, options: GanttEditOptions = {}): GanttResult {
  const old = gantt.tasks.find((one) => one.id === task.id);
  if (!old) return refused("missing");
  const named = { ...task, name: task.name.trim(), end: task.milestone ? task.start : task.end };
  const problem = taskProblem(named) ?? dependencyProblem(gantt, named);
  if (problem) return refused(problem);
  const groupMissing = named.groupId !== null && !gantt.groups.some((group) => group.id === named.groupId);
  if (old.groupId !== named.groupId && groupMissing) return refused("missing");
  // A save that leaves its days and its dependencies alone leaves a task that already starts too early as it is.
  const timed =
    named.start !== old.start || named.end !== old.end || named.dependsOn.join("\n") !== old.dependsOn.join("\n");
  const next = options.autoSchedule && timed ? afterPredecessors(tasksById(gantt), named) : named;
  if (next === "invalid") return refused(next);
  if (old.groupId === next.groupId) {
    return scheduled(
      { ...gantt, tasks: gantt.tasks.map((one) => (one.id === next.id ? next : one)) },
      old,
      next,
      options,
    );
  }
  const sections = ganttSections(gantt).map((section) => ({
    ...section,
    tasks: section.tasks.filter((one) => one.id !== next.id),
  }));
  sections.find((section) => section.groupId === next.groupId)!.tasks.push(next);
  return scheduled(fromSections(gantt, sections), old, next, options);
}

export function renameGanttTask(gantt: Gantt, id: string, name: string): GanttResult {
  return withTask(gantt, id, (task) => nameProblem(name) ?? { ...task, name: name.trim() });
}

/** Deletes a task, and the dependencies of other tasks on it. */
export function deleteGanttTask(gantt: Gantt, id: string): GanttResult {
  if (!gantt.tasks.some((task) => task.id === id)) return refused("missing");
  return checked(withoutTasks(gantt, new Set([id])));
}

/** Moves a task into a group (null: outside every group) at this place in it (counted without the task itself). */
export function moveGanttTask(gantt: Gantt, id: string, groupId: string | null, index: number): GanttResult {
  const task = gantt.tasks.find((one) => one.id === id);
  if (!task) return refused("missing");
  const sections = ganttSections(gantt).map((section) => ({
    ...section,
    tasks: section.tasks.filter((one) => one.id !== id),
  }));
  const target = sections.find((section) => section.groupId === groupId);
  if (!target) return refused("missing");
  target.tasks.splice(Math.max(0, Math.min(target.tasks.length, index)), 0, task);
  return checked(fromSections(gantt, sections));
}

/** A day `days` after this one, or null past the calendar's years (0001 to 9999). */
function dayAfter(day: CalendarDay, days: number): CalendarDay | null {
  const next = addDays(day, days);
  return isCalendarDay(next) ? next : null;
}

/**
 * Moves a task (both its days) `days` later, or earlier when negative; its length stays the same. With
 * `autoSchedule`, it stops at the day after the last day of the tasks it depends on (so a task that starts too
 * early lands there when it is moved at all), and the tasks that depend on it are pushed as far as needed.
 */
export function shiftTask(gantt: Gantt, id: string, days: number, options: GanttEditOptions = {}): GanttResult {
  if (!Number.isInteger(days)) return refused("invalid");
  return withTask(
    gantt,
    id,
    (task) => {
      const start = dayAfter(task.start, days);
      const end = dayAfter(task.end, days);
      if (!start || !end) return "invalid";
      const moved = { ...task, start, end };
      return options.autoSchedule && days !== 0 ? afterPredecessors(tasksById(gantt), moved) : moved;
    },
    options,
  );
}

/**
 * Moves one end of a task `days` later (earlier when negative). An end never passes the other ("order"): a
 * one-day task is as short as a task gets. A milestone has no length to change ("invalid"); it is moved instead.
 * With `autoSchedule`, the start stops at the day after the last day of the tasks it depends on ("order" when
 * that passes the end), and a new end pushes the tasks that depend on it as far as needed.
 */
export function resizeTask(
  gantt: Gantt,
  id: string,
  edge: TaskEdge,
  days: number,
  options: GanttEditOptions = {},
): GanttResult {
  if (!Number.isInteger(days)) return refused("invalid");
  return withTask(
    gantt,
    id,
    (task) => {
      if (task.milestone) return "invalid";
      let day = dayAfter(task[edge], days);
      if (!day) return "invalid";
      const last = lastPredecessorEnd(tasksById(gantt), task);
      if (options.autoSchedule && edge === "start" && days !== 0 && last !== null && compareDays(day, last) <= 0) {
        day = dayAfter(last, 1);
        if (!day) return "invalid";
      }
      const next = { ...task, [edge]: day };
      return compareDays(next.end, next.start) < 0 ? "order" : next;
    },
    options,
  );
}

/** Sets the percentage done: a whole number from 0 to 100. */
export function setTaskProgress(gantt: Gantt, id: string, progress: number): GanttResult {
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) return refused("invalid");
  return withTask(gantt, id, (task) => ({ ...task, progress }));
}

/**
 * Makes a task depend on another (finish-to-start). Refused when either is missing, when it already does
 * ("duplicate"), and when the other depends on it, directly or through others, or is the task itself
 * ("cycle"). With `autoSchedule`, a task that starts on or before the other's last day starts after the last
 * day of every task it depends on (keeping its length), and pushes the tasks that depend on it as far as needed.
 */
export function addDependency(
  gantt: Gantt,
  id: string,
  predecessorId: string,
  options: GanttEditOptions = {},
): GanttResult {
  const predecessor = gantt.tasks.find((task) => task.id === predecessorId);
  if (!predecessor) return refused("missing");
  return withTask(
    gantt,
    id,
    (task) => {
      if (id === predecessorId || dependsOnTask(gantt.tasks, predecessorId, id)) return "cycle";
      if (task.dependsOn.includes(predecessorId)) return "duplicate";
      if (task.dependsOn.length >= MAX_DEPENDENCIES) return "limit";
      const linked = { ...task, dependsOn: [...task.dependsOn, predecessorId] };
      if (!options.autoSchedule || compareDays(task.start, predecessor.end) > 0) return linked;
      return afterPredecessors(tasksById(gantt), linked);
    },
    options,
  );
}

/** Whether a task could depend on another without a cycle (and is not already the task itself). */
export function canDependOn(gantt: Gantt, id: string, predecessorId: string): boolean {
  return id !== predecessorId && !dependsOnTask(gantt.tasks, predecessorId, id);
}

export function removeDependency(gantt: Gantt, id: string, predecessorId: string): GanttResult {
  return withTask(gantt, id, (task) =>
    task.dependsOn.includes(predecessorId)
      ? { ...task, dependsOn: task.dependsOn.filter((one) => one !== predecessorId) }
      : "missing",
  );
}
