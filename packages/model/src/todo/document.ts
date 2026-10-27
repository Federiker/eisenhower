import type { DocumentKind } from "../storage/document";
import { type TodoItem, type TodoList, todoListSchema } from "./schema";

/**
 * What a stored todo list must also be, beyond its schema: each id once, each subtask's parent a top-level
 * item of the list, each item's tags different ignoring case. One sentence a problem, for logs.
 */
function problems(list: TodoList): string[] {
  const found: string[] = [];
  const byId = new Map<string, TodoItem>();
  for (const item of list.items) {
    if (byId.has(item.id)) found.push(`item ${item.id} appears twice`);
    byId.set(item.id, item);
  }
  for (const item of list.items) {
    const parent = item.parentId === null ? null : byId.get(item.parentId);
    if (parent === undefined || parent?.id === item.id) found.push(`item ${item.id} is a subtask of no item`);
    else if (parent && parent.parentId !== null) found.push(`item ${item.id} is a subtask of a subtask`);
    const tags = item.tags.map((tag) => tag.toLocaleLowerCase());
    if (new Set(tags).size !== tags.length) found.push(`item ${item.id} has a tag twice`);
  }
  return found;
}

/** A todo list as a stored document (decisions 9 and 18): kind `todo`, version 1. */
export const todoDocument: DocumentKind<TodoList> = {
  kind: "todo",
  version: 1,
  schema: todoListSchema,
  problems,
};
