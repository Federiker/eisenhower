import type { CalendarDay } from "../common/days";
import type { TodoItem, TodoList } from "./schema";

/**
 * The Eisenhower matrix's quadrants (decision 18): `do` (urgent and important), `schedule` (important, not
 * urgent), `delegate` (urgent, not important) and `drop` (neither), in reading order of its 2×2 grid.
 */
export type Quadrant = "do" | "schedule" | "delegate" | "drop";

export const QUADRANTS: readonly Quadrant[] = ["do", "schedule", "delegate", "drop"];

const FLAGS: Readonly<Record<Quadrant, { urgent: boolean; important: boolean }>> = {
  do: { urgent: true, important: true },
  schedule: { urgent: false, important: true },
  delegate: { urgent: true, important: false },
  drop: { urgent: false, important: false },
};

/** The flags that place an item in a quadrant. */
export function quadrantFlags(quadrant: Quadrant): { urgent: boolean; important: boolean } {
  return FLAGS[quadrant];
}

/** The quadrant an item's flags place it in. */
export function quadrantOf(item: Pick<TodoItem, "urgent" | "important">): Quadrant {
  if (item.important) return item.urgent ? "do" : "schedule";
  return item.urgent ? "delegate" : "drop";
}

/** A direction in the matrix's grid: urgent on the left, important at the top. */
export type QuadrantDirection = "up" | "down" | "left" | "right";

/** The quadrant beside one in a direction of the grid, or null at its edge. */
export function quadrantToward(quadrant: Quadrant, direction: QuadrantDirection): Quadrant | null {
  const index = QUADRANTS.indexOf(quadrant);
  const row = Math.floor(index / 2);
  const column = index % 2;
  const [nextRow, nextColumn] =
    direction === "up"
      ? [row - 1, column]
      : direction === "down"
        ? [row + 1, column]
        : direction === "left"
          ? [row, column - 1]
          : [row, column + 1];
  if (nextRow < 0 || nextRow > 1 || nextColumn < 0 || nextColumn > 1) return null;
  return QUADRANTS[nextRow * 2 + nextColumn]!;
}

/** The list's items in outline order: each top-level item followed by its subtasks. */
export function todoOutline(list: TodoList): TodoItem[] {
  const byId = new Map(list.items.map((item) => [item.id, item]));
  // A subtask whose parent is missing or is a subtask itself (a list that is not valid) is shown at the top
  // level, not lost.
  const top = list.items.filter((item) => item.parentId === null || byId.get(item.parentId)?.parentId !== null);
  return top.flatMap((item) => [item, ...list.items.filter((one) => one.parentId === item.id && one !== item)]);
}

/** The subtasks of an item, in order (none for a subtask). */
export function subtasksOf(list: TodoList, id: string): TodoItem[] {
  return list.items.filter((item) => item.parentId === id);
}

/** How many of an item's subtasks are done, of how many. */
export function subtaskProgress(list: TodoList, id: string): { done: number; total: number } {
  const subtasks = subtasksOf(list, id);
  return { done: subtasks.filter((item) => item.done).length, total: subtasks.length };
}

/** The items in a quadrant, in the list's outline order (subtasks among them, each by its own flags). */
export function itemsInQuadrant(list: TodoList, quadrant: Quadrant): TodoItem[] {
  return todoOutline(list).filter((item) => quadrantOf(item) === quadrant);
}

const fold = (tag: string) => tag.toLocaleLowerCase();

/** Whether an item has a tag, ignoring case. */
export function hasTag(item: Pick<TodoItem, "tags">, tag: string): boolean {
  const wanted = fold(tag.trim());
  return item.tags.some((one) => fold(one) === wanted);
}

/**
 * Every tag the list's items use, once each (ignoring case; spelt as first met), in alphabetical order
 * (ignoring case and accents).
 */
export function allTags(list: TodoList): string[] {
  const seen = new Map<string, string>();
  for (const item of todoOutline(list)) for (const tag of item.tags) if (!seen.has(fold(tag))) seen.set(fold(tag), tag);
  return [...seen.values()].sort((first, second) => first.localeCompare(second, "en", { sensitivity: "base" }));
}

/** The items that have any one of the tags (ignoring case; owner decision, 27 October 2026); all of them when no tag is given. */
export function filterByTags(items: readonly TodoItem[], tags: readonly string[]): TodoItem[] {
  return tags.length === 0 ? [...items] : items.filter((item) => tags.some((tag) => hasTag(item, tag)));
}

/** Whether an item is past its due day: not done, and due before `today`. */
export function isOverdue(item: Pick<TodoItem, "done" | "due">, today: CalendarDay): boolean {
  return !item.done && item.due !== null && item.due < today;
}

/**
 * The items a view shows, in outline order: those with any tag of `tags` and, with `hideDone`, not done;
 * and the parent of any subtask shown, so that a subtask is never shown without its parent.
 */
export function shownItems(list: TodoList, options: { tags?: readonly string[]; hideDone?: boolean } = {}): TodoItem[] {
  const { tags = [], hideDone = false } = options;
  const passes = new Set(
    filterByTags(list.items, tags)
      .filter((item) => !(hideDone && item.done))
      .map((item) => item.id),
  );
  const parents = new Set(
    list.items.filter((item) => passes.has(item.id) && item.parentId !== null).map((item) => item.parentId),
  );
  return todoOutline(list).filter((item) => passes.has(item.id) || parents.has(item.id));
}
