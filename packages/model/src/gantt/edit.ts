import { addDays, type CalendarDay, compareDays, isCalendarDay } from "../common/days";
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

/** The finished chart, or "invalid" when it would not pass its schema and checks (never stored half right). */
function checked(gantt: Gantt): GanttResult {
  if (!ganttSchema.safeParse(gantt).success || ganttProblems(gantt).length > 0) return refused("invalid");
  return done(gantt);
}

/** The chart with its tasks laid out again from sections (outside every group first, then group by group). */
function fromSections(gantt: Gantt, sections: readonly GanttSection[]): Gantt {
  return {
    ...gantt,
    tasks: sections.flatMap((section) => section.tasks.map((task) => ({ ...task, groupId: section.groupId }))),
  };
}

/** The chart with one task changed by `change`, or "missing". */
function withTask(gantt: Gantt, id: string, change: (task: GanttTask) => GanttTask | GanttProblem): GanttResult {
  const task = gantt.tasks.find((one) => one.id === id);
  if (!task) return refused("missing");
  const next = change(task);
  if (typeof next === "string") return refused(next);
  return checked({ ...gantt, tasks: gantt.tasks.map((one) => (one.id === id ? next : one)) });
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

/** A new task with nothing but its name and days: in a group or none, not done, without colour or dependencies. */
export function blankGanttTask(
  id: string,
  name: string,
  start: CalendarDay,
  end: CalendarDay,
  groupId: string | null,
): GanttTask {
  return { id, name, groupId, start, end, milestone: false, progress: 0, colour: null, dependsOn: [] };
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
 * given another group goes to the end of that group. A milestone is given its start as its end.
 */
export function putGanttTask(gantt: Gantt, task: GanttTask): GanttResult {
  const old = gantt.tasks.find((one) => one.id === task.id);
  if (!old) return refused("missing");
  const next = { ...task, name: task.name.trim(), end: task.milestone ? task.start : task.end };
  const problem = taskProblem(next) ?? dependencyProblem(gantt, next);
  if (problem) return refused(problem);
  if (old.groupId === next.groupId) {
    return checked({ ...gantt, tasks: gantt.tasks.map((one) => (one.id === next.id ? next : one)) });
  }
  const sections = ganttSections(gantt).map((section) => ({
    ...section,
    tasks: section.tasks.filter((one) => one.id !== next.id),
  }));
  const target = sections.find((section) => section.groupId === next.groupId);
  if (!target) return refused("missing");
  target.tasks.push(next);
  return checked(fromSections(gantt, sections));
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

/** Moves a task (both its days) `days` later, or earlier when negative; its length stays the same. */
export function shiftTask(gantt: Gantt, id: string, days: number): GanttResult {
  if (!Number.isInteger(days)) return refused("invalid");
  return withTask(gantt, id, (task) => {
    const start = dayAfter(task.start, days);
    const end = dayAfter(task.end, days);
    return start && end ? { ...task, start, end } : "invalid";
  });
}

/**
 * Moves one end of a task `days` later (earlier when negative). An end never passes the other ("order"): a
 * one-day task is as short as a task gets. A milestone has no length to change ("invalid"); it is moved instead.
 */
export function resizeTask(gantt: Gantt, id: string, edge: TaskEdge, days: number): GanttResult {
  if (!Number.isInteger(days)) return refused("invalid");
  return withTask(gantt, id, (task) => {
    if (task.milestone) return "invalid";
    const day = dayAfter(task[edge], days);
    if (!day) return "invalid";
    const next = { ...task, [edge]: day };
    return compareDays(next.end, next.start) < 0 ? "order" : next;
  });
}

/** Sets the percentage done: a whole number from 0 to 100. */
export function setTaskProgress(gantt: Gantt, id: string, progress: number): GanttResult {
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) return refused("invalid");
  return withTask(gantt, id, (task) => ({ ...task, progress }));
}

/**
 * Makes a task depend on another (finish-to-start). Refused when either is missing, when it already does
 * ("duplicate"), and when the other depends on it, directly or through others, or is the task itself
 * ("cycle").
 */
export function addDependency(gantt: Gantt, id: string, predecessorId: string): GanttResult {
  if (!gantt.tasks.some((task) => task.id === predecessorId)) return refused("missing");
  return withTask(gantt, id, (task) => {
    if (id === predecessorId || dependsOnTask(gantt.tasks, predecessorId, id)) return "cycle";
    if (task.dependsOn.includes(predecessorId)) return "duplicate";
    if (task.dependsOn.length >= MAX_DEPENDENCIES) return "limit";
    return { ...task, dependsOn: [...task.dependsOn, predecessorId] };
  });
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
