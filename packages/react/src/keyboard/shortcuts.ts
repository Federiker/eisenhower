/**
 * Every keyboard shortcut of the views (decision 8). This list is the one place keys are defined: the views
 * read it, and docs/features/interface.md lists it. "Mod" is Ctrl, or ⌘ on macOS.
 *
 * Each area keeps its shortcuts in a file of its own beside this one (common.ts, board.ts…), with its
 * descriptions in its strings, spread into `SHORTCUTS` below.
 */
import type { MessageKey } from "../strings/en-GB";
import { COMMON_SHORTCUTS } from "./common";
import { TIMELINE_SHORTCUTS } from "./timeline";

/** Where a shortcut applies: in every view (`common`), or in one view. */
export type ShortcutArea = "common" | "timeline";

/**
 * A key as `KeyboardEvent.key` names it (letters in either case), or a physical key by `KeyboardEvent.code`
 * (`code:Digit5`), for keys whose character changes with the layout.
 */
type Key = string;

/**
 * A shortcut: its action, the keys that ask for it and the message that describes it. A modifier left out
 * must not be held (`mod`, `alt`), except Shift, which is then free for keys other than letters; `shift:
 * false` says it must not be held either.
 */
export type ShortcutDefinition = {
  readonly action: string;
  readonly area: ShortcutArea;
  readonly keys: readonly Key[];
  readonly description: MessageKey;
  readonly mod?: boolean;
  readonly shift?: boolean;
  readonly alt?: boolean;
};

export const SHORTCUTS = [...COMMON_SHORTCUTS, ...TIMELINE_SHORTCUTS] as const satisfies readonly ShortcutDefinition[];

export type ShortcutAction = (typeof SHORTCUTS)[number]["action"];

export type Shortcut = ShortcutDefinition & { readonly action: ShortcutAction };

/** The shortcuts of the areas given, with the common ones first: what one view listens to. */
export function shortcutsIn(...areas: ShortcutArea[]): readonly Shortcut[] {
  return SHORTCUTS.filter((shortcut) => shortcut.area === "common" || areas.includes(shortcut.area));
}

/** Whether the computer is a Mac, where "Mod" is ⌘ rather than Ctrl. */
export function isMac(platform: string = globalThis.navigator?.platform ?? ""): boolean {
  return /mac|iphone|ipad/i.test(platform);
}

function keyMatches(key: Key, event: Pick<KeyboardEvent, "key" | "code">): boolean {
  if (key.startsWith("code:")) return event.code === key.slice(5);
  return event.key.length === 1 ? event.key.toLowerCase() === key.toLowerCase() : event.key === key;
}

/**
 * The action a key press asks for, or null. Modifiers must match exactly ("Mod" is ⌘ on a Mac, Ctrl
 * elsewhere); AltGr, which browsers report as Ctrl and Alt together, never matches a shortcut, so characters
 * typed with it reach text fields untouched; neither do key presses of an input method still composing.
 */
export function actionOf(
  event: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "isComposing">,
  shortcuts: readonly Shortcut[] = SHORTCUTS,
  mac: boolean = isMac(),
): ShortcutAction | null {
  if (event.isComposing) return null;
  if (event.ctrlKey && event.altKey) return null;
  const mod = mac ? event.metaKey : event.ctrlKey;
  const other = mac ? event.ctrlKey : event.metaKey;
  if (other) return null;
  for (const shortcut of shortcuts) {
    if ((shortcut.mod ?? false) !== mod) continue;
    if ((shortcut.alt ?? false) !== event.altKey) continue;
    // Shift is part of a character on many layouts: it matters only for the shortcuts that name it, and for
    // letters.
    const letter = event.key.length === 1 && /\p{L}/u.test(event.key);
    if (shortcut.shift !== undefined || letter || shortcut.mod) {
      if ((shortcut.shift ?? false) !== event.shiftKey) continue;
    }
    if (shortcut.keys.some((key) => keyMatches(key, event))) return shortcut.action;
  }
  return null;
}

const KEY_NAMES: Readonly<Record<string, string>> = {
  " ": "Space",
  ArrowRight: "→",
  ArrowLeft: "←",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Escape: "Esc",
  ContextMenu: "Menu",
};

/** How a shortcut's keys are written for people: "Alt+↑", "Shift+F10", "⌘Enter", "F2". */
export function describeShortcut(shortcut: Shortcut, mac: boolean = isMac()): string {
  const key = shortcut.keys[0]!;
  const name =
    KEY_NAMES[key] ??
    (key.startsWith("code:")
      ? key.replace(/^code:(Digit|Numpad|Key)?/, "")
      : key.length === 1
        ? key.toUpperCase()
        : key);
  const parts = [
    ...(shortcut.mod ? [mac ? "⌘" : "Ctrl"] : []),
    ...(shortcut.alt ? [mac ? "⌥" : "Alt"] : []),
    ...(shortcut.shift ? [mac ? "⇧" : "Shift"] : []),
    name,
  ];
  return mac ? parts.join("") : parts.join("+");
}

/** The keys of some actions as `aria-keyshortcuts` writes them: "Alt+ArrowUp Alt+ArrowDown". */
export function ariaKeyShortcuts(actions: readonly ShortcutAction[], mac: boolean = isMac()): string {
  return SHORTCUTS.filter((shortcut) => actions.includes(shortcut.action))
    .flatMap((shortcut: Shortcut) =>
      shortcut.keys.map((key) =>
        [
          ...(shortcut.mod ? [mac ? "Meta" : "Control"] : []),
          ...(shortcut.alt ? ["Alt"] : []),
          ...(shortcut.shift ? ["Shift"] : []),
          key === " " ? "Space" : key.replace(/^code:(Digit|Numpad|Key)?/, ""),
        ].join("+"),
      ),
    )
    .join(" ");
}
