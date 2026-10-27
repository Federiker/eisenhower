/** A document with changes not saved yet, as the window's close sees it: its name, and how to save it. */
export type Unsaved = {
  name: string;
  /** Saves it where it came from, or with Save as… when it has no file; false when not saved (cancelled or failed). */
  save: () => Promise<boolean>;
};

/** What the user answers when the window closes with unsaved changes. */
export type CloseChoice = "save" | "discard" | "cancel";

/**
 * Whether the window may close: at once when nothing is unsaved; else as the user chooses, asked once for
 * every unsaved document. Save saves each in turn and closes only when all are saved: the first one not
 * saved (Save as… cancelled, or a failure, which it reports itself) keeps the window open and stops there.
 * Don't save closes; Cancel stays.
 */
export async function mayClose(
  unsaved: readonly Unsaved[],
  choose: (names: readonly string[]) => Promise<CloseChoice>,
): Promise<boolean> {
  if (unsaved.length === 0) return true;
  const choice = await choose(unsaved.map((document) => document.name));
  if (choice === "discard") return true;
  if (choice === "cancel") return false;
  for (const document of unsaved) {
    if (!(await document.save())) return false;
  }
  return true;
}
