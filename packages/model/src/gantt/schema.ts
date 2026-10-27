import { z } from "zod";

import { type CalendarDay, calendarDaySchema, compareDays } from "../common/days";
import { idSchema, uniqueIds } from "../common/ids";
import { type Colour, colourSchema } from "../common/palette";
import type { Problem } from "../common/result";
import { nameFits } from "../common/text";
import type { DocumentKind } from "../storage/document";
import { cycleMember } from "./graph";

/** The most tasks a gantt chart holds: a few hundred stay smooth, two thousand still draw. */
export const MAX_GANTT_TASKS = 2000;
/** The most groups (summary rows) a gantt chart holds. */
export const MAX_GANTT_GROUPS = 200;
/** The most tasks one task may depend on. */
export const MAX_DEPENDENCIES = 50;
/** The highest percentage done. */
export const MAX_PROGRESS = 100;

/**
 * A group of tasks, drawn as a summary row spanning its tasks, which it shows or hides (`collapsed`). Groups
 * have one level: a group holds tasks, never other groups.
 */
export type GanttGroup = { id: string; name: string; collapsed: boolean };

/**
 * A task, a bar from its first day to its last (`end` is included: a one-day task ends on the day it starts),
 * or, as a `milestone`, a moment with no length on one day (`start` and `end` the same). It is in a group or
 * in none (`groupId` null); `progress` is the percentage done (a whole number, 0 to 100); `dependsOn` lists
 * the tasks that must finish before it starts (finish-to-start: it starts after their last day).
 */
export type GanttTask = {
  id: string;
  name: string;
  groupId: string | null;
  start: CalendarDay;
  end: CalendarDay;
  milestone: boolean;
  progress: number;
  colour: Colour;
  dependsOn: string[];
};

/**
 * A gantt chart (decision 17): its groups in order, and its tasks. The tasks' order is the rows' order: the
 * tasks outside every group first, then each group's tasks in the groups' order; where a task stands in the
 * array among those of other groups does not matter.
 */
export type Gantt = { groups: GanttGroup[]; tasks: GanttTask[] };

/** Why a change to a gantt chart was refused: the common problems, or a dependency that would make a cycle. */
export type GanttProblem = Problem | "cycle";

const nameSchema = z
  .string()
  .refine((name) => nameFits(name) && name === name.trim(), "A name is 1 to 120 characters.");

export const ganttGroupSchema: z.ZodType<GanttGroup> = z.strictObject({
  id: idSchema,
  name: nameSchema,
  collapsed: z.boolean(),
});

export const ganttTaskSchema: z.ZodType<GanttTask> = z.strictObject({
  id: idSchema,
  name: nameSchema,
  groupId: idSchema.nullable(),
  start: calendarDaySchema,
  end: calendarDaySchema,
  milestone: z.boolean(),
  progress: z.number().int().min(0).max(MAX_PROGRESS),
  colour: colourSchema,
  dependsOn: z.array(idSchema).max(MAX_DEPENDENCIES),
});

export const ganttSchema: z.ZodType<Gantt> = z.strictObject({
  groups: z.array(ganttGroupSchema).max(MAX_GANTT_GROUPS),
  tasks: z.array(ganttTaskSchema).max(MAX_GANTT_TASKS),
});

/**
 * What a schema cannot say about a gantt chart, one sentence each for logs: ids used twice, a task in a group
 * that is not there, an end before its start, a milestone with a length, a dependency on a task that is not
 * there, on the task itself or twice, and dependencies that go round in a cycle. None means it is sound.
 */
export function ganttProblems(gantt: Gantt): string[] {
  const problems: string[] = [];
  if (!uniqueIds(gantt.groups)) problems.push("two groups have the same id");
  if (!uniqueIds(gantt.tasks)) problems.push("two tasks have the same id");
  const groups = new Set(gantt.groups.map((group) => group.id));
  const tasks = new Set(gantt.tasks.map((task) => task.id));
  for (const task of gantt.tasks) {
    if (task.groupId !== null && !groups.has(task.groupId)) problems.push(`task ${task.id} is in a missing group`);
    if (compareDays(task.end, task.start) < 0) problems.push(`task ${task.id} ends before it starts`);
    if (task.milestone && task.end !== task.start)
      problems.push(`milestone ${task.id} does not start and end the same day`);
    if (task.dependsOn.includes(task.id)) problems.push(`task ${task.id} depends on itself`);
    if (new Set(task.dependsOn).size !== task.dependsOn.length)
      problems.push(`task ${task.id} names a dependency twice`);
    for (const id of task.dependsOn) {
      if (!tasks.has(id)) problems.push(`task ${task.id} depends on a missing task ${id}`);
    }
  }
  // A task on itself is said above; only a longer cycle is a problem of its own.
  const others = gantt.tasks.map((task) => ({ id: task.id, dependsOn: task.dependsOn.filter((id) => id !== task.id) }));
  const member = cycleMember(others);
  if (member !== null) problems.push(`the dependencies go round in a cycle through task ${member}`);
  return problems;
}

/** The gantt chart's document kind (decision 9): version 1. */
export const ganttDocument: DocumentKind<Gantt> = {
  kind: "gantt",
  version: 1,
  schema: ganttSchema,
  problems: ganttProblems,
};

/** A gantt chart with nothing in it. */
export function emptyGantt(): Gantt {
  return { groups: [], tasks: [] };
}
