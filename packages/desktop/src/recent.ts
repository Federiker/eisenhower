import type { DocumentKindName } from "@eisenhower/model";
import { z } from "zod";

/** How many documents the start screen lists. */
export const MAX_RECENT = 20;

/** Where the window keeps the list, in its `localStorage`. */
export const RECENT_KEY = "eisenhower-desktop:recent";

/** A document opened lately: its file, its name and kind as shown, and when it was last opened (ISO 8601). */
export type RecentDocument = { path: string; name: string; kind: DocumentKindName; opened: string };

const recentSchema = z.array(
  z
    .object({
      path: z.string().min(1),
      name: z.string(),
      kind: z.enum(["board", "timeline", "gantt", "todo"]),
      opened: z.string(),
    })
    .strict(),
);

/** The list with `document` first (moved there when it was listed already), keeping {@link MAX_RECENT}. */
export function addRecent(list: readonly RecentDocument[], document: RecentDocument): RecentDocument[] {
  return [document, ...list.filter((one) => one.path !== document.path)].slice(0, MAX_RECENT);
}

/** The list without the document at `path`. */
export function removeRecent(list: readonly RecentDocument[], path: string): RecentDocument[] {
  return list.filter((one) => one.path !== path);
}

/**
 * The list without the documents whose file is gone: `exists` answers for each path, and a path it cannot
 * answer for (it throws) stays listed, so that opening it says why. The same list when nothing is gone.
 */
export async function pruneRecent(
  list: readonly RecentDocument[],
  exists: (path: string) => Promise<boolean>,
): Promise<readonly RecentDocument[]> {
  const kept = await Promise.all(list.map((one) => exists(one.path).catch(() => true)));
  return kept.every(Boolean) ? list : list.filter((_, index) => kept[index]);
}

/** The list kept in `storage`, or why it could not be read; nothing kept yet is an empty list. */
export function readRecent(storage: Pick<Storage, "getItem">): { list: RecentDocument[]; unreadable: boolean } {
  let text: string | null;
  try {
    text = storage.getItem(RECENT_KEY);
  } catch {
    return { list: [], unreadable: true };
  }
  if (text === null) return { list: [], unreadable: false };
  try {
    const parsed = recentSchema.safeParse(JSON.parse(text));
    return parsed.success
      ? { list: parsed.data.slice(0, MAX_RECENT), unreadable: false }
      : { list: [], unreadable: true };
  } catch {
    return { list: [], unreadable: true };
  }
}

/** Keeps the list in `storage`; false when it could not be written. */
export function writeRecent(storage: Pick<Storage, "setItem">, list: readonly RecentDocument[]): boolean {
  try {
    storage.setItem(RECENT_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}
