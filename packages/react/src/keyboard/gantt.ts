import type { ShortcutDefinition } from "./shortcuts";

/**
 * The gantt chart's own keys (decision 8), beside the common ones it gives a meaning of its own: Alt+← and
 * Alt+→ (`moveLeft`, `moveRight`) move the focused task a day earlier or later on every scale (the owner's
 * decision of 27 October 2026); ← and → fold and unfold a group, or go from a task to its group. Alt+Shift+←
 * and Alt+Shift+→ move the task's end by a day; Ctrl+= (or Ctrl++) and Ctrl+- change the
 * scale, as jerome's timeline zooms.
 */
export const GANTT_SHORTCUTS = [
  {
    action: "shortenTask",
    area: "gantt",
    keys: ["ArrowLeft"],
    alt: true,
    shift: true,
    description: "gantt.keys.shorten",
  },
  {
    action: "lengthenTask",
    area: "gantt",
    keys: ["ArrowRight"],
    alt: true,
    shift: true,
    description: "gantt.keys.lengthen",
  },
  { action: "zoomIn", area: "gantt", keys: ["=", "+"], mod: true, description: "gantt.keys.zoomIn" },
  { action: "zoomIn", area: "gantt", keys: ["+"], mod: true, shift: true, description: "gantt.keys.zoomIn" },
  { action: "zoomOut", area: "gantt", keys: ["-"], mod: true, description: "gantt.keys.zoomOut" },
] as const satisfies readonly ShortcutDefinition[];
