import type { TodoItem, TodoList } from "../../../src";

/** An item with the fields a test does not care about left plain. */
export function item(id: string, title: string, extra: Partial<TodoItem> = {}): TodoItem {
  return {
    id,
    title,
    done: false,
    due: null,
    notes: "",
    tags: [],
    urgent: false,
    important: false,
    parentId: null,
    ...extra,
  };
}

/**
 * A small list: "Paint the shed" with two subtasks (one done), "Book flights" (urgent, important, tagged),
 * and "Read a novel" (tagged, done).
 */
export const LIST: TodoList = {
  items: [
    item("a", "Paint the shed", { important: true, tags: ["Home"] }),
    item("a1", "Buy paint", { parentId: "a", done: true, important: true }),
    item("a2", "Sand the walls", { parentId: "a", urgent: true, tags: ["home", "Weekend"] }),
    item("b", "Book flights", { urgent: true, important: true, due: "2026-11-02", tags: ["Travel"] }),
    item("c", "Read a novel", { done: true, tags: ["Leisure", "Weekend"] }),
  ],
};

/** The titles in the list's order, a subtask's with a leading "-". */
export const titles = (list: TodoList) =>
  list.items.map((one) => (one.parentId === null ? one.title : `-${one.title}`));

/** The new list of an edit that must succeed. */
export function ok<T>(result: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!result.ok) throw new Error(`refused: ${result.reason}`);
  return result.value;
}
