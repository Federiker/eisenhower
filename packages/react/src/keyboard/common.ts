import type { ShortcutDefinition } from "./shortcuts";

/**
 * The keys every view shares (decision 8), as jerome's plot board has them: the arrows, Home and End move
 * the focus; Alt and an arrow move the focused card, entry, bar or item; Enter opens it, F2 renames it,
 * Delete deletes it (asking first where the view does), the Menu key or Shift+F10 opens its menu, and Escape
 * closes or cancels.
 */
export const COMMON_SHORTCUTS = [
  { action: "focusUp", area: "common", keys: ["ArrowUp"], shift: false, description: "common.keys.focusUp" },
  { action: "focusDown", area: "common", keys: ["ArrowDown"], shift: false, description: "common.keys.focusDown" },
  { action: "focusLeft", area: "common", keys: ["ArrowLeft"], shift: false, description: "common.keys.focusLeft" },
  { action: "focusRight", area: "common", keys: ["ArrowRight"], shift: false, description: "common.keys.focusRight" },
  { action: "focusFirst", area: "common", keys: ["Home"], shift: false, description: "common.keys.focusFirst" },
  { action: "focusLast", area: "common", keys: ["End"], shift: false, description: "common.keys.focusLast" },
  {
    action: "moveUp",
    area: "common",
    keys: ["ArrowUp"],
    alt: true,
    shift: false,
    description: "common.keys.moveUp",
  },
  {
    action: "moveDown",
    area: "common",
    keys: ["ArrowDown"],
    alt: true,
    shift: false,
    description: "common.keys.moveDown",
  },
  {
    action: "moveLeft",
    area: "common",
    keys: ["ArrowLeft"],
    alt: true,
    shift: false,
    description: "common.keys.moveLeft",
  },
  {
    action: "moveRight",
    area: "common",
    keys: ["ArrowRight"],
    alt: true,
    shift: false,
    description: "common.keys.moveRight",
  },
  { action: "open", area: "common", keys: ["Enter"], shift: false, description: "common.keys.open" },
  { action: "saveText", area: "common", keys: ["Enter"], mod: true, description: "common.keys.saveText" },
  { action: "rename", area: "common", keys: ["F2"], shift: false, description: "common.keys.rename" },
  { action: "delete", area: "common", keys: ["Delete"], shift: false, description: "common.keys.delete" },
  { action: "menu", area: "common", keys: ["ContextMenu"], description: "common.keys.menu" },
  { action: "menu", area: "common", keys: ["F10"], shift: true, description: "common.keys.menu" },
  { action: "escape", area: "common", keys: ["Escape"], description: "common.keys.escape" },
] as const satisfies readonly ShortcutDefinition[];
