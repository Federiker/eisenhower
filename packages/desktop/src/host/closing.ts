import type { Unsaved } from "./host";

/** What the user answers when the window closes with unsaved changes. */
export type CloseChoice = "save" | "discard" | "cancel";

/**
 * Whether the window may close: at once when nothing is unsaved; else as the user chooses. Save closes only
 * once the document is saved (Save as… cancelled, or a failure, which it reports itself, keeps the window
 * open); Don't save closes; Cancel stays.
 */
export async function mayClose(
  unsaved: Unsaved | null,
  choose: (name: string) => Promise<CloseChoice>,
): Promise<boolean> {
  if (unsaved === null) return true;
  const choice = await choose(unsaved.name);
  if (choice === "discard") return true;
  if (choice === "cancel") return false;
  return unsaved.save();
}
