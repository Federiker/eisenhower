/**
 * Why an edit was refused, the same words in every view so a host translates them once: a name or text
 * that is blank or too long, a list at its limit, something that is not there (any more), two that may not
 * share a value, an order that may not be (an end before its start), or a result that would not be valid.
 */
export type Problem = "blank" | "tooLong" | "limit" | "missing" | "duplicate" | "order" | "invalid";

/** An edit's outcome: the new value, or why there is none. Edits never throw for what a user typed or did. */
export type EditResult<T, P extends string = Problem> = { ok: true; value: T } | { ok: false; reason: P };

export function done<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function refused<P extends string>(reason: P): { ok: false; reason: P } {
  return { ok: false, reason };
}
