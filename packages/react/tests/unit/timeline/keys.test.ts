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

describe("the timeline's keys", () => {
  const keys = shortcutsIn("timeline");

  it("come after the common ones and zoom with Ctrl (⌘ on a Mac)", () => {
    expect(
      keys.slice(0, SHORTCUTS.filter((one) => one.area === "common").length).every((one) => one.area === "common"),
    ).toBe(true);
    expect(actionOf(press("=", { ctrlKey: true }), keys, false)).toBe("zoomIn");
    expect(actionOf(press("+", { ctrlKey: true, shiftKey: true }), keys, false)).toBe("zoomIn");
    expect(actionOf(press("+", { ctrlKey: true }), keys, false)).toBe("zoomIn");
    expect(actionOf(press("-", { metaKey: true }), keys, true)).toBe("zoomOut");
    expect(actionOf(press("0", { ctrlKey: true }), keys, false)).toBe("zoomFit");
    expect(actionOf(press("=", { ctrlKey: true }), shortcutsIn(), false)).toBeNull();
    expect(actionOf(press("ArrowLeft", { altKey: true }), keys, false)).toBe("moveLeft");
    expect(describeShortcut(keys.find((one) => one.action === "zoomOut")!, false)).toBe("Ctrl+-");
  });

  it("each have a description, and one meaning per key and modifiers", () => {
    const t = createTranslate();
    const seen = new Map<string, string>();
    for (const one of keys) {
      expect(t(one.description)).not.toBe("");
      for (const key of one.keys) {
        const id = `${key}|${one.mod ?? false}|${one.shift ?? false}|${one.alt ?? false}`;
        expect(seen.get(id) ?? one.action).toBe(one.action);
        seen.set(id, one.action);
      }
    }
  });
});
