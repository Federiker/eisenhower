import type { ShortcutDefinition } from "./shortcuts";

/**
 * The timeline's own keys, after the common ones (jerome's drawing): Ctrl+= (or Ctrl++) zooms in, Ctrl+-
 * zooms out and Ctrl+0 fits the drawing to its width again, while the focus is in the drawing.
 */
export const TIMELINE_SHORTCUTS = [
  {
    action: "zoomIn",
    area: "timeline",
    keys: ["=", "+"],
    mod: true,
    shift: false,
    description: "timeline.keys.zoomIn",
  },
  // "+" is Shift+= on many keyboards.
  { action: "zoomIn", area: "timeline", keys: ["+"], mod: true, shift: true, description: "timeline.keys.zoomIn" },
  { action: "zoomOut", area: "timeline", keys: ["-"], mod: true, shift: false, description: "timeline.keys.zoomOut" },
  { action: "zoomFit", area: "timeline", keys: ["0"], mod: true, shift: false, description: "timeline.keys.zoomFit" },
] as const satisfies readonly ShortcutDefinition[];
