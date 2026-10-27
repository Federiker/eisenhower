import type { ShortcutDefinition } from "./shortcuts";

/**
 * The todo list's own keys (decision 18); the rest are the common ones. Space ticks the focused item (its
 * check box's own key). In the list, Alt+← and Alt+→ move an item out of and into the item above, as an
 * outliner does; in the matrix, Alt and an arrow move it to the quadrant that way.
 */
export const TODO_SHORTCUTS = [
  { action: "toggleDone", area: "todo", keys: [" "], description: "todo.keys.toggleDone" },
] as const satisfies readonly ShortcutDefinition[];
