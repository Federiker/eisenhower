/**
 * Whether a key press is the app's undo (Ctrl+Z, ⌘Z) or redo (Ctrl+Y, Ctrl+Shift+Z, ⌘⇧Z). Not in a field,
 * which has its own undo, nor in a dialogue, whose changes are not made yet, nor once a view has taken the
 * key. These are the demo app's keys, not the views' (the README lists them).
 */
export function isUndoKey(event: KeyboardEvent): "undo" | "redo" | null {
  if (event.defaultPrevented || event.altKey || !(event.ctrlKey || event.metaKey)) return null;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest("input, textarea, select, [contenteditable], dialog, [role='dialog'], [role='alertdialog']")) {
    return null;
  }
  const key = event.key.toLowerCase();
  if (key === "z") return event.shiftKey ? "redo" : "undo";
  if (key === "y" && !event.shiftKey) return "redo";
  return null;
}
