import { z } from "zod";

import { type CalendarDay, calendarDaySchema } from "../common/days";
import { idSchema } from "../common/ids";
import { characterCount, MAX_NAME_LENGTH } from "../common/text";

/** The longest title of an item, in characters: a name, as everywhere else ({@link MAX_NAME_LENGTH}). */
export const MAX_TODO_TITLE_LENGTH = MAX_NAME_LENGTH;
/** The longest notes of an item, in characters, line breaks included (decision 18). */
export const MAX_TODO_NOTES_LENGTH = 250;
/** The longest tag, in characters. */
export const MAX_TAG_LENGTH = 40;
/** The most tags one item may have. */
export const MAX_TAGS = 20;

/**
 * An item of a todo list (decision 18): its title, whether it is done, an optional due day, notes of a few
 * lines, its tags, the two flags that place it in the Eisenhower matrix, and the item it is a subtask of
 * (null at the top level; one level only, so a subtask has no subtasks).
 */
export type TodoItem = {
  id: string;
  title: string;
  done: boolean;
  due: CalendarDay | null;
  notes: string;
  tags: string[];
  urgent: boolean;
  important: boolean;
  parentId: string | null;
};

/**
 * A todo list: its items in the user's order. A top-level item's subtasks are the items that name it as
 * their parent, in the order they come; the edits write them straight after their parent.
 */
export type TodoList = { items: TodoItem[] };

const oneLine = (text: string) => !/[\r\n]/.test(text);

/** A tag as stored: trimmed, one line, 1 to {@link MAX_TAG_LENGTH} characters. */
const tagSchema = z
  .string()
  .refine((tag) => tag === tag.trim() && oneLine(tag), "A tag is trimmed and on one line.")
  .refine((tag) => characterCount(tag) >= 1 && characterCount(tag) <= MAX_TAG_LENGTH, "A tag is 1 to 40 characters.");

export const todoItemSchema = z
  .object({
    id: idSchema,
    title: z
      .string()
      .refine(
        (title) =>
          title === title.trim() && characterCount(title) >= 1 && characterCount(title) <= MAX_TODO_TITLE_LENGTH,
        "A title is trimmed, 1 to 120 characters.",
      ),
    done: z.boolean(),
    due: calendarDaySchema.nullable(),
    notes: z
      .string()
      .refine((notes) => characterCount(notes) <= MAX_TODO_NOTES_LENGTH, "Notes are 250 characters at most."),
    tags: z.array(tagSchema).max(MAX_TAGS),
    urgent: z.boolean(),
    important: z.boolean(),
    parentId: idSchema.nullable(),
  })
  .strict() satisfies z.ZodType<TodoItem>;

export const todoListSchema = z.object({ items: z.array(todoItemSchema) }).strict() satisfies z.ZodType<TodoList>;
