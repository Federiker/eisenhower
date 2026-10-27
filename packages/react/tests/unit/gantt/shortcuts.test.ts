import { describe, expect, it } from "vitest";

import { actionOf, createTranslate, describeShortcut, SHORTCUTS, shortcutsIn } from "../../../src";

const press = (key: string, extra: Partial<KeyboardEvent> = {}) => ({
  key,
  code: "",
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  isComposing: false,
  ...extra,
});

const gantt = shortcutsIn("gantt");

describe("the gantt chart's keys", () => {
  it("move a task with Alt and an arrow, its end with Alt+Shift and an arrow", () => {
    expect(actionOf(press("ArrowLeft", { altKey: true }), gantt, false)).toBe("moveLeft");
    expect(actionOf(press("ArrowRight", { altKey: true }), gantt, false)).toBe("moveRight");
    expect(actionOf(press("ArrowLeft", { altKey: true, shiftKey: true }), gantt, false)).toBe("shortenTask");
    expect(actionOf(press("ArrowRight", { altKey: true, shiftKey: true }), gantt, true)).toBe("lengthenTask");
  });

  it("change the scale with Ctrl+= or Ctrl++ and Ctrl+-, ⌘ on a Mac", () => {
    expect(actionOf(press("=", { ctrlKey: true }), gantt, false)).toBe("zoomIn");
    expect(actionOf(press("+", { ctrlKey: true, shiftKey: true }), gantt, false)).toBe("zoomIn");
    expect(actionOf(press("+", { ctrlKey: true }), gantt, false)).toBe("zoomIn");
    expect(actionOf(press("-", { metaKey: true }), gantt, true)).toBe("zoomOut");
    expect(actionOf(press("-"), gantt, false)).toBeNull();
    // Other views do not hear them.
    expect(actionOf(press("=", { ctrlKey: true }), shortcutsIn(), false)).toBeNull();
  });

  it("are described for people, each with its message", () => {
    const t = createTranslate();
    const own = SHORTCUTS.filter((shortcut) => shortcut.area === "gantt");
    expect(own.map((shortcut) => describeShortcut(shortcut, false))).toEqual([
      "Alt+Shift+←",
      "Alt+Shift+→",
      "Ctrl+=",
      "Ctrl+Shift++",
      "Ctrl+-",
    ]);
    for (const shortcut of own) expect(t(shortcut.description)).not.toBe(shortcut.description);
  });
});
