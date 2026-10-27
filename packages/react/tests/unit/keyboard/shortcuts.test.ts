import { describe, expect, it } from "vitest";

import {
  actionOf,
  ariaKeyShortcuts,
  createTranslate,
  describeShortcut,
  isMac,
  opensMenu,
  SHORTCUTS,
  type ShortcutAction,
  shortcutsIn,
} from "../../../src";

const press = (key: string, extra: Partial<KeyboardEvent> = {}) => ({
  key,
  code: extra.code ?? "",
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  isComposing: false,
  ...extra,
});

const shortcut = (action: ShortcutAction, index = 0) =>
  SHORTCUTS.filter((candidate) => candidate.action === action)[index]!;

describe("the shared keys", () => {
  it("move the focus with the arrows, Home and End, and the item with Alt and an arrow, as jerome's board", () => {
    expect(actionOf(press("ArrowUp"), SHORTCUTS, false)).toBe("focusUp");
    expect(actionOf(press("ArrowRight"), SHORTCUTS, false)).toBe("focusRight");
    expect(actionOf(press("Home"), SHORTCUTS, false)).toBe("focusFirst");
    expect(actionOf(press("End"), SHORTCUTS, false)).toBe("focusLast");
    expect(actionOf(press("ArrowUp", { altKey: true }), SHORTCUTS, false)).toBe("moveUp");
    expect(actionOf(press("ArrowDown", { altKey: true }), SHORTCUTS, false)).toBe("moveDown");
    expect(actionOf(press("ArrowLeft", { altKey: true }), SHORTCUTS, false)).toBe("moveLeft");
    expect(actionOf(press("ArrowRight", { altKey: true }), SHORTCUTS, true)).toBe("moveRight");
    // Shift with an arrow is left for a view's own use.
    expect(actionOf(press("ArrowUp", { shiftKey: true }), SHORTCUTS, false)).toBeNull();
  });

  it("open, rename, delete, open the menu and close", () => {
    expect(actionOf(press("Enter"), SHORTCUTS, false)).toBe("open");
    expect(actionOf(press("Enter", { ctrlKey: true }), SHORTCUTS, false)).toBe("saveText");
    expect(actionOf(press("Enter", { metaKey: true }), SHORTCUTS, true)).toBe("saveText");
    expect(actionOf(press("F2"), SHORTCUTS, false)).toBe("rename");
    expect(actionOf(press("Delete"), SHORTCUTS, false)).toBe("delete");
    expect(actionOf(press("Delete", { shiftKey: true }), SHORTCUTS, false)).toBeNull();
    expect(actionOf(press("ContextMenu"), SHORTCUTS, false)).toBe("menu");
    expect(actionOf(press("F10", { shiftKey: true }), SHORTCUTS, false)).toBe("menu");
    expect(actionOf(press("F10"), SHORTCUTS, false)).toBeNull();
    expect(actionOf(press("Escape"), SHORTCUTS, false)).toBe("escape");
  });

  it("are the keys the menu opens with", () => {
    for (const menu of SHORTCUTS.filter((candidate) => candidate.action === "menu")) {
      expect(opensMenu({ key: menu.keys[0]!, shiftKey: "shift" in menu && menu.shift })).toBe(true);
    }
  });

  it("tell Ctrl from ⌘ by platform, and leave AltGr, input methods and other keys alone", () => {
    expect(actionOf(press("Enter", { ctrlKey: true }), SHORTCUTS, true)).toBeNull();
    expect(actionOf(press("Enter", { metaKey: true }), SHORTCUTS, false)).toBeNull();
    expect(actionOf(press("@", { ctrlKey: true, altKey: true }), SHORTCUTS, false)).toBeNull();
    expect(actionOf(press("Enter", { isComposing: true }), SHORTCUTS, false)).toBeNull();
    expect(actionOf(press("x"), SHORTCUTS, false)).toBeNull();
    expect(actionOf(press("Enter"))).toBe("open");
  });

  it("are written for people and for aria-keyshortcuts", () => {
    expect(describeShortcut(shortcut("moveUp"), false)).toBe("Alt+↑");
    expect(describeShortcut(shortcut("moveUp"), true)).toBe("⌥↑");
    expect(describeShortcut(shortcut("menu", 0), false)).toBe("Menu");
    expect(describeShortcut(shortcut("menu", 1), false)).toBe("Shift+F10");
    expect(describeShortcut(shortcut("menu", 1), true)).toBe("⇧F10");
    expect(describeShortcut(shortcut("saveText"), false)).toBe("Ctrl+Enter");
    expect(describeShortcut(shortcut("saveText"), true)).toBe("⌘Enter");
    expect(describeShortcut(shortcut("escape"), false)).toBe("Esc");
    expect(describeShortcut(shortcut("delete"), false)).toBe("Delete");
    expect(describeShortcut({ ...shortcut("open"), keys: ["a"] }, false)).toBe("A");
    expect(describeShortcut({ ...shortcut("open"), keys: ["code:Digit5"] }, false)).toBe("5");
    expect(describeShortcut(shortcut("open"))).toBe("Enter");
    expect(ariaKeyShortcuts(["moveUp", "moveDown"], false)).toBe("Alt+ArrowUp Alt+ArrowDown");
    expect(ariaKeyShortcuts(["menu"], false)).toBe("ContextMenu Shift+F10");
    expect(ariaKeyShortcuts(["saveText"], false)).toBe("Control+Enter");
    expect(ariaKeyShortcuts(["saveText"], true)).toBe("Meta+Enter");
    expect(ariaKeyShortcuts(["moveUp"])).toBe("Alt+ArrowUp");
    expect(isMac("MacIntel")).toBe(true);
    expect(isMac("Win32")).toBe(false);
  });

  it("each have a description, and one meaning per key and modifiers in an area", () => {
    const t = createTranslate();
    const seen = new Map<string, string>();
    for (const one of shortcutsIn()) {
      expect(t(one.description)).not.toBe("");
      for (const key of one.keys) {
        const id = `${one.area}|${key}|${one.mod ?? false}|${one.shift ?? false}|${one.alt ?? false}`;
        expect(seen.get(id) ?? one.action).toBe(one.action);
        seen.set(id, one.action);
      }
    }
    expect(shortcutsIn()).toEqual(SHORTCUTS.filter((one) => one.area === "common"));
  });
});
