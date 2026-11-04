import { type Gantt, type GanttRow, ganttSections, ganttTaskPlace } from "@eisenhower/model";

/** Where a task dragged by its name goes: a group (null: outside every group), its place there, the line drawn. */
export type TaskDrop = { groupId: string | null; index: number; line: number };
/** Where a group dragged by its name goes: its index among the groups after the move, the line drawn. */
export type GroupDrop = { to: number; line: number };

/** The row under a point `y` pixels down the rows, whether in its lower half, or null below the last row. */
function rowAt(rows: readonly GanttRow[], y: number, rowHeight: number): { index: number; lower: boolean } | null {
  const index = Math.max(0, Math.floor(y / rowHeight));
  if (index >= rows.length) return null;
  return { index, lower: y - index * rowHeight >= rowHeight / 2 };
}

/**
 * Where a task dragged by its name to `y` would go: before or after the task under the pointer (by its half), at
 * the start of an unfolded group under the lower half of its summary row, at the end of a folded one, at the end
 * of the section above under the upper half of a summary row, and at the end of the last section below every
 * row. Null when it would stay where it is. Places count the tasks without the one dragged, as `moveGanttTask`.
 */
export function taskDrop(
  gantt: Gantt,
  rows: readonly GanttRow[],
  id: string,
  y: number,
  rowHeight: number,
): TaskDrop | null {
  const sections = ganttSections(gantt).map((section) => ({
    ...section,
    tasks: section.tasks.filter((task) => task.id !== id),
  }));
  const endOf = (groupId: string | null) => sections.find((section) => section.groupId === groupId)!.tasks.length;
  const at = rowAt(rows, y, rowHeight);
  let drop: TaskDrop;
  if (!at) {
    const last = sections.at(-1)!;
    drop = { groupId: last.groupId, index: last.tasks.length, line: rows.length * rowHeight };
  } else {
    const row = rows[at.index]!;
    if (row.kind === "task") {
      if (row.task.id === id) return null;
      const section = sections.find((one) => one.groupId === row.task.groupId)!;
      const index = section.tasks.findIndex((task) => task.id === row.task.id) + (at.lower ? 1 : 0);
      drop = { groupId: row.task.groupId, index, line: (at.index + (at.lower ? 1 : 0)) * rowHeight };
    } else if (at.lower || row.group.collapsed) {
      const index = row.group.collapsed ? endOf(row.group.id) : 0;
      drop = { groupId: row.group.id, index, line: (at.index + 1) * rowHeight };
    } else {
      const before = sections[sections.findIndex((section) => section.groupId === row.group.id) - 1]!;
      drop = { groupId: before.groupId, index: before.tasks.length, line: at.index * rowHeight };
    }
  }
  const task = gantt.tasks.find((one) => one.id === id);
  const place = ganttTaskPlace(gantt, id);
  const stays = task && place && task.groupId === drop.groupId && place.index === drop.index;
  return stays ? null : drop;
}

/**
 * Where a group dragged by its name to `y` would go among the groups: before a group under the upper half of
 * its summary row, after it anywhere else in its rows, first over the tasks outside every group, last below
 * every row. Null when it would stay where it is.
 */
export function groupDrop(
  gantt: Gantt,
  rows: readonly GanttRow[],
  id: string,
  y: number,
  rowHeight: number,
): GroupDrop | null {
  const from = gantt.groups.findIndex((group) => group.id === id);
  if (from < 0) return null;
  const at = rowAt(rows, y, rowHeight);
  let before: number;
  if (!at) {
    before = gantt.groups.length;
  } else {
    const row = rows[at.index]!;
    const groupId = row.kind === "group" ? row.group.id : row.task.groupId;
    const index = groupId === null ? -1 : gantt.groups.findIndex((group) => group.id === groupId);
    before = index < 0 ? 0 : row.kind === "group" && !at.lower ? index : index + 1;
  }
  const to = before > from ? before - 1 : before;
  if (to === from) return null;
  const summary = rows.findIndex((row) => row.kind === "group" && row.group.id === gantt.groups[before]?.id);
  return { to, line: (summary < 0 ? rows.length : summary) * rowHeight };
}
