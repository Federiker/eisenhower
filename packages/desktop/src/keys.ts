/** The app's own commands with a key (not the views': the README lists them). */
export type AppCommand = "new" | "open" | "save" | "saveAs" | "undo" | "redo";

/** The keys of each command, as `aria-keyshortcuts` writes them. */
export const APP_KEYS: Readonly<Record<AppCommand, string>> = {
  new: "Control+N",
  open: "Control+O",
  save: "Control+S",
  saveAs: "Control+Shift+S",
  undo: "Control+Z",
  redo: "Control+Y Control+Shift+Z",
};

const IN_DIALOGUE = "dialog, [role='dialog'], [role='alertdialog']";
const IN_FIELD = "input, textarea, select, [contenteditable]";

/**
 * The app's command a key press is, with Ctrl (⌘ on macOS): N a new document, O open, S save, Shift+S save
 * as, Z undo, Y or Shift+Z redo. None in a dialogue, whose changes are not made yet, nor once a view has taken
 * the key; undo and redo are left to a text field, which has its own.
 */
export function appCommand(event: KeyboardEvent): AppCommand | null {
  if (event.defaultPrevented || event.altKey || !(event.ctrlKey || event.metaKey)) return null;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest(IN_DIALOGUE)) return null;
  const key = event.key.toLowerCase();
  if (key === "n" && !event.shiftKey) return "new";
  if (key === "o" && !event.shiftKey) return "open";
  if (key === "s") return event.shiftKey ? "saveAs" : "save";
  if (target?.closest(IN_FIELD)) return null;
  if (key === "z") return event.shiftKey ? "redo" : "undo";
  if (key === "y" && !event.shiftKey) return "redo";
  return null;
}
