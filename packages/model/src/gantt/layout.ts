import { type CalendarDay, compareDays } from "../common/days";
import type { Gantt, GanttGroup, GanttTask } from "./schema";

/** The tasks of a group in order (`groupId` null: the tasks outside every group). */
export type GanttSection = { groupId: string | null; tasks: GanttTask[] };

/**
 * The tasks by section, in order: those outside every group first, then each group's (as the board puts the
 * cards outside every column first). Every group has a section, even an empty one.
 */
export function ganttSections(gantt: Gantt): GanttSection[] {
  return [null, ...gantt.groups.map((group) => group.id)].map((groupId) => ({
    groupId,
    tasks: gantt.tasks.filter((task) => task.groupId === groupId),
  }));
}

/** Where a task is: its section's index in {@link ganttSections} and its place there; null when it is not there. */
export function ganttTaskPlace(gantt: Gantt, id: string): { section: number; index: number } | null {
  for (const [section, { tasks }] of ganttSections(gantt).entries()) {
    const index = tasks.findIndex((task) => task.id === id);
    if (index >= 0) return { section, index };
  }
  return null;
}

/** The first and last day of a group's tasks, for its summary row; null when it has none. */
export function groupSpan(gantt: Gantt, groupId: string): { start: CalendarDay; end: CalendarDay } | null {
  const tasks = gantt.tasks.filter((task) => task.groupId === groupId);
  if (tasks.length === 0) return null;
  let { start, end } = tasks[0]!;
  for (const task of tasks) {
    if (compareDays(task.start, start) < 0) start = task.start;
    if (compareDays(task.end, end) > 0) end = task.end;
  }
  return { start, end };
}

/** A broken finish-to-start dependency: the task starts on or before the last day of a task it depends on. */
export type DependencyConflict = { taskId: string; predecessorId: string };

/**
 * The dependencies that are not kept (decision 17): a task must start after the last day of every task it
 * depends on, so one that starts on that day or before is in conflict. In the tasks' order, then their
 * dependencies' order.
 */
export function dependencyConflicts(gantt: Gantt): DependencyConflict[] {
  const byId = new Map(gantt.tasks.map((task) => [task.id, task]));
  return gantt.tasks.flatMap((task) =>
    task.dependsOn
      .filter((id) => {
        const predecessor = byId.get(id);
        return predecessor !== undefined && compareDays(task.start, predecessor.end) <= 0;
      })
      .map((predecessorId) => ({ taskId: task.id, predecessorId })),
  );
}

/** The ids of the tasks that start too early for a task they depend on ({@link dependencyConflicts}). */
export function lateTasks(gantt: Gantt): Set<string> {
  return new Set(dependencyConflicts(gantt).map((conflict) => conflict.taskId));
}

/** A row of the chart as drawn: a group's summary row, or a task (in a group that is not collapsed, or in none). */
export type GanttRow =
  | { kind: "group"; group: GanttGroup; span: { start: CalendarDay; end: CalendarDay } | null; count: number }
  | { kind: "task"; task: GanttTask };

/**
 * The rows the chart shows, top to bottom: the tasks outside every group, then each group's summary row
 * followed by its tasks unless it is collapsed. `collapsed` overrides the groups' own flags (a read-only view
 * folding groups without changing the chart).
 */
export function ganttRows(gantt: Gantt, collapsed?: ReadonlyMap<string, boolean>): GanttRow[] {
  const [loose, ...grouped] = ganttSections(gantt);
  return [
    ...loose!.tasks.map((task): GanttRow => ({ kind: "task", task })),
    ...grouped.flatMap((section, index): GanttRow[] => {
      const group = gantt.groups[index]!;
      const folded = collapsed?.get(group.id) ?? group.collapsed;
      return [
        { kind: "group", group, span: groupSpan(gantt, group.id), count: section.tasks.length },
        ...(folded ? [] : section.tasks.map((task): GanttRow => ({ kind: "task", task }))),
      ];
    }),
  ];
}

/** A step a task can take in the order: one row up or down. */
export type GanttStep = "up" | "down";

/**
 * Where a step up or down takes a task, or null when it can go no further. Within its section it swaps with its
 * neighbour; from the top of a group it goes to the end of the section above (the group before, or the tasks
 * outside every group), and from the bottom to the start of the section below, as the rows read.
 */
export function ganttStepTarget(
  gantt: Gantt,
  id: string,
  step: GanttStep,
): { groupId: string | null; index: number } | null {
  const place = ganttTaskPlace(gantt, id);
  if (!place) return null;
  const sections = ganttSections(gantt);
  const section = sections[place.section]!;
  if (step === "up") {
    if (place.index > 0) return { groupId: section.groupId, index: place.index - 1 };
    const before = sections[place.section - 1];
    return before ? { groupId: before.groupId, index: before.tasks.length } : null;
  }
  if (place.index < section.tasks.length - 1) return { groupId: section.groupId, index: place.index + 1 };
  const after = sections[place.section + 1];
  return after ? { groupId: after.groupId, index: 0 } : null;
}
