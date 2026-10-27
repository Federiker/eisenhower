import type { Problem } from "./result";

/** The longest name of a column, a card, a step, a task… in characters (code points), as jerome's research names. */
export const MAX_NAME_LENGTH = 120;
/** The longest one-line summary of a card or an entry, in characters. */
export const MAX_SUMMARY_LENGTH = 500;

/** Characters, not UTF-16 units: an emoji or a CJK extension character counts once. */
export function characterCount(text: string): number {
  return [...text].length;
}

/** Whether a name fits once trimmed: 1 to {@link MAX_NAME_LENGTH} characters. */
export function nameFits(name: string, max = MAX_NAME_LENGTH): boolean {
  const length = characterCount(name.trim());
  return length >= 1 && length <= max;
}

/** Why a name cannot be used (blank or too long), or null when it can. */
export function nameProblem(name: string, max = MAX_NAME_LENGTH): Extract<Problem, "blank" | "tooLong"> | null {
  const trimmed = name.trim();
  if (trimmed === "") return "blank";
  return characterCount(trimmed) > max ? "tooLong" : null;
}

/** Whether a text is one line (no line break) of at most `max` characters; it may be empty. */
export function oneLineFits(text: string, max = MAX_SUMMARY_LENGTH): boolean {
  return characterCount(text) <= max && !/[\r\n]/.test(text);
}

/**
 * The name a new item of a list takes: `base` ("New step"), or "New step 2", "New step 3"… when an item
 * already has it (ignoring case), as a new folder is named in a tree.
 */
export function freeName(items: readonly { name: string }[], base: string): string {
  const taken = new Set(items.map((item) => item.name.trim().toLowerCase()));
  let name = base;
  for (let number = 2; taken.has(name.toLowerCase()); number += 1) name = `${base} ${number}`;
  return name;
}
