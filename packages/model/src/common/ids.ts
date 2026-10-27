import { z } from "zod";

/** The longest id, in characters: room for a UUID or a host's own key, never a document. */
export const MAX_ID_LENGTH = 200;

/** An id the host chose (a UUID, a database key…): any non-empty string up to {@link MAX_ID_LENGTH}. */
export const idSchema = z.string().min(1).max(MAX_ID_LENGTH);

/** A new id for something made in a view (decision 3). */
export function newId(): string {
  return crypto.randomUUID();
}

/** Whether the ids in a list are all different. */
export function uniqueIds(items: readonly { id: string }[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}
