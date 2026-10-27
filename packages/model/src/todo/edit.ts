import { isCalendarDay } from "../common/days";
import { idSchema } from "../common/ids";
import { done, type EditResult, type Problem, refused } from "../common/result";
import { characterCount, nameProblem } from "../common/text";
import { hasTag, todoOutline, type Quadrant, quadrantFlags, subtasksOf } from "./items";
import {
  MAX_TODO_NOTES_LENGTH,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  MAX_TODO_TITLE_LENGTH,
  type TodoItem,
  type TodoList,
} from "./schema";

/** A new item: its id and title, and any of its other fields (not done, no due day, notes or tags otherwise). */
export type NewTodoItem = { id: string; title: string } & Partial<Omit<TodoItem, "id" | "title" | "parentId">>;

/**
 * Where a new item goes: at the end of the top level or of an item's subtasks (`parentId`), or just after an
 * item (`after`), as its next sibling (after its subtasks, for a top-level item).
 */
export type TodoPlace = { parentId: string | null } | { after: string };

/** What becomes of an item's subtasks when it is deleted: deleted with it, or kept at the top level. */
export type SubtaskDisposal = "delete" | "keep";

type Result = EditResult<TodoList>;

const find = (list: TodoList, id: string) => list.items.find((item) => item.id === id);

function change(list: TodoList, id: string, edit: (item: TodoItem) => Partial<TodoItem>): Result {
  if (!find(list, id)) return refused("missing");
  return done({ items: list.items.map((item) => (item.id === id ? { ...item, ...edit(item) } : item)) });
}

/** A title as it is stored (trimmed), or why it cannot be. */
function cleanTitle(title: string): EditResult<string> {
  const problem = nameProblem(title, MAX_TODO_TITLE_LENGTH);
  return problem ? refused(problem) : done(title.trim());
}

/** Notes as they are stored: trimmed, line breaks as `\n`, at most {@link MAX_TODO_NOTES_LENGTH} characters. */
function cleanNotes(notes: string): EditResult<string> {
  const clean = notes.replace(/\r\n?/g, "\n").trim();
  return characterCount(clean) > MAX_TODO_NOTES_LENGTH ? refused("tooLong") : done(clean);
}

/** A tag as it is stored (trimmed, one line, 1 to {@link MAX_TAG_LENGTH} characters), or why it cannot be. */
function cleanTag(tag: string): EditResult<string> {
  const clean = tag.trim();
  if (clean === "") return refused("blank");
  if (/[\r\n]/.test(clean)) return refused("invalid");
  return characterCount(clean) > MAX_TAG_LENGTH ? refused("tooLong") : done(clean);
}

/**
 * Tags as they are stored: each trimmed, blank ones left out, each once (ignoring case; the first spelling
 * kept), at most {@link MAX_TAGS}; or why they cannot be.
 */
function cleanTags(tags: readonly string[]): EditResult<string[]> {
  const kept: string[] = [];
  for (const tag of tags) {
    if (tag.trim() === "") continue;
    const clean = cleanTag(tag);
    if (!clean.ok) return clean;
    if (!hasTag({ tags: kept }, clean.value)) kept.push(clean.value);
  }
  return kept.length > MAX_TAGS ? refused("limit") : done(kept);
}

/** An item and, when it is at the top level, its subtasks: what moves when it moves. */
function block(items: readonly TodoItem[], item: TodoItem): TodoItem[] {
  return [item, ...items.filter((one) => one.parentId === item.id)];
}

/** Where an item goes among `items` (in outline order) to be the `index`th child of `parentId` (clamped). */
function insertionIndex(items: readonly TodoItem[], parentId: string | null, index: number): number {
  const siblings = items.filter((item) => item.parentId === parentId);
  const before = siblings[Math.max(0, index)];
  if (before) return items.indexOf(before);
  if (parentId === null) return items.length;
  const last = siblings.at(-1) ?? items.find((item) => item.id === parentId)!;
  return items.indexOf(last) + 1;
}

/** Why an item may not be a child of `parentId` (null at the top level), or null when it may. */
function parentProblem(list: TodoList, item: TodoItem | null, parentId: string | null): Problem | null {
  if (parentId === null) return null;
  const parent = find(list, parentId);
  if (!parent || parent.id === item?.id) return "missing";
  // One level of subtasks: a subtask has none, and an item with subtasks cannot become one.
  if (parent.parentId !== null) return "limit";
  if (item && subtasksOf(list, item.id).length > 0) return "limit";
  return null;
}

/**
 * Adds an item (decision 18) at the end of the list, at the end of an item's subtasks, or just after an item
 * (see {@link TodoPlace}). A new subtask takes its parent's flags unless it is given its own. Refused when the
 * id is not usable or taken, the title is blank or too long, the notes too long, a tag not usable, the due day
 * not a calendar day, or the place not there or too deep.
 */
export function addItem(list: TodoList, input: NewTodoItem, place: TodoPlace = { parentId: null }): Result {
  if (!idSchema.safeParse(input.id).success) return refused("invalid");
  if (find(list, input.id)) return refused("duplicate");
  const title = cleanTitle(input.title);
  if (!title.ok) return title;
  const notes = cleanNotes(input.notes ?? "");
  if (!notes.ok) return notes;
  const tags = cleanTags(input.tags ?? []);
  if (!tags.ok) return tags;
  const due = input.due ?? null;
  if (due !== null && !isCalendarDay(due)) return refused("invalid");

  const items = todoOutline(list);
  let parentId: string | null;
  let at: number;
  if ("after" in place) {
    const after = find(list, place.after);
    if (!after) return refused("missing");
    parentId = after.parentId;
    const run = after.parentId === null ? block(items, after) : [after];
    at = items.indexOf(run.at(-1)!) + 1;
  } else {
    parentId = place.parentId;
    const problem = parentProblem(list, null, parentId);
    if (problem) return refused(problem);
    at = insertionIndex(items, parentId, Number.MAX_SAFE_INTEGER);
  }
  const parent = parentId === null ? null : find(list, parentId)!;
  const item: TodoItem = {
    id: input.id,
    title: title.value,
    done: input.done ?? false,
    due,
    notes: notes.value,
    tags: tags.value,
    urgent: input.urgent ?? parent?.urgent ?? false,
    important: input.important ?? parent?.important ?? false,
    parentId,
  };
  return done({ items: [...items.slice(0, at), item, ...items.slice(at)] });
}

/** Renames an item: its title trimmed, refused when blank or too long. */
export function renameItem(list: TodoList, id: string, title: string): Result {
  const clean = cleanTitle(title);
  return clean.ok ? change(list, id, () => ({ title: clean.value })) : clean;
}

/** Sets an item's notes: trimmed, several lines allowed, refused over {@link MAX_TODO_NOTES_LENGTH} characters. */
export function setItemNotes(list: TodoList, id: string, notes: string): Result {
  const clean = cleanNotes(notes);
  return clean.ok ? change(list, id, () => ({ notes: clean.value })) : clean;
}

/** Sets an item's due day, or clears it (null); refused when it is not a calendar day. */
export function setItemDue(list: TodoList, id: string, due: string | null): Result {
  if (due !== null && !isCalendarDay(due)) return refused("invalid");
  return change(list, id, () => ({ due }));
}

/** Sets an item's tags: trimmed, blank ones left out, each once ignoring case; refused when one is not usable. */
export function setItemTags(list: TodoList, id: string, tags: readonly string[]): Result {
  const clean = cleanTags(tags);
  return clean.ok ? change(list, id, () => ({ tags: clean.value })) : clean;
}

/** Gives an item one more tag; refused when it already has it (ignoring case) or has all it may. */
export function addItemTag(list: TodoList, id: string, tag: string): Result {
  const clean = cleanTag(tag);
  if (!clean.ok) return clean;
  const item = find(list, id);
  if (!item) return refused("missing");
  if (hasTag(item, clean.value)) return refused("duplicate");
  if (item.tags.length >= MAX_TAGS) return refused("limit");
  return change(list, id, (old) => ({ tags: [...old.tags, clean.value] }));
}

/** Takes a tag off an item (ignoring case); refused when it does not have it. */
export function removeItemTag(list: TodoList, id: string, tag: string): Result {
  const item = find(list, id);
  if (!item || !hasTag(item, tag)) return refused("missing");
  return change(list, id, (old) => ({ tags: old.tags.filter((one) => !hasTag({ tags: [one] }, tag)) }));
}

/** Ticks or unticks an item. Only that item: a parent's subtasks keep theirs, and a parent its own. */
export function setItemDone(list: TodoList, id: string, isDone: boolean): Result {
  return change(list, id, () => ({ done: isDone }));
}

/** Ticks an item that is not done, or unticks one that is. */
export function toggleItemDone(list: TodoList, id: string): Result {
  return change(list, id, (item) => ({ done: !item.done }));
}

/** Puts an item in a quadrant of the matrix, by setting its urgent and important flags (its subtasks keep theirs). */
export function setItemQuadrant(list: TodoList, id: string, quadrant: Quadrant): Result {
  return change(list, id, () => quadrantFlags(quadrant));
}

/**
 * Moves an item to be the `index`th child of `parentId` (null: the top level), counted without the item
 * itself and clamped to the ends; a top-level item moves with its subtasks. Refused when the item or the
 * parent is not there, or the move would make subtasks of subtasks.
 */
export function moveItem(list: TodoList, id: string, parentId: string | null, index: number): Result {
  const item = find(list, id);
  if (!item) return refused("missing");
  const problem = parentProblem(list, item, parentId);
  if (problem) return refused(problem);
  const items = todoOutline(list);
  const moving = item.parentId === null ? block(items, item) : [item];
  const rest = items.filter((one) => !moving.includes(one));
  const at = insertionIndex(rest, parentId, index);
  const moved = [{ ...item, parentId }, ...moving.slice(1)];
  return done({ items: [...rest.slice(0, at), ...moved, ...rest.slice(at)] });
}

/** The items beside an item: the top level's, or its parent's subtasks. */
function siblingsOf(list: TodoList, item: TodoItem): TodoItem[] {
  return todoOutline(list).filter((one) => one.parentId === item.parentId);
}

/**
 * Moves an item one place up or down among its siblings (a top-level item with its subtasks; a subtask
 * stays with its parent); refused ("order") at either end.
 */
export function stepItem(list: TodoList, id: string, way: "up" | "down"): Result {
  const item = find(list, id);
  if (!item) return refused("missing");
  const index = siblingsOf(list, item).indexOf(item);
  const to = way === "up" ? index - 1 : index + 1;
  if (to < 0 || to >= siblingsOf(list, item).length) return refused("order");
  return moveItem(list, id, item.parentId, to);
}

/**
 * Makes a top-level item the last subtask of the top-level item above it, as an outliner indents. Refused
 * ("order") for the first item, and ("limit") for a subtask or an item that has subtasks of its own.
 */
export function indentItem(list: TodoList, id: string): Result {
  const item = find(list, id);
  if (!item) return refused("missing");
  if (item.parentId !== null || subtasksOf(list, id).length > 0) return refused("limit");
  const siblings = siblingsOf(list, item);
  const above = siblings[siblings.indexOf(item) - 1];
  if (!above) return refused("order");
  return moveItem(list, id, above.id, Number.MAX_SAFE_INTEGER);
}

/**
 * Makes a subtask a top-level item, just after its parent and the parent's other subtasks; refused ("order")
 * for an item at the top level.
 */
export function outdentItem(list: TodoList, id: string): Result {
  const item = find(list, id);
  if (!item) return refused("missing");
  if (item.parentId === null) return refused("order");
  const parentId = item.parentId;
  const top = todoOutline(list).filter((one) => one.parentId === null);
  return moveItem(list, id, null, top.findIndex((one) => one.id === parentId) + 1);
}

/** Deletes an item; a top-level item's subtasks go with it, or stay as top-level items where they were. */
export function deleteItem(list: TodoList, id: string, subtasks: SubtaskDisposal = "delete"): Result {
  if (!find(list, id)) return refused("missing");
  return done({
    items: todoOutline(list)
      .filter((item) => item.id !== id && !(subtasks === "delete" && item.parentId === id))
      .map((item) => (item.parentId === id ? { ...item, parentId: null } : item)),
  });
}
