import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

import { useTranslate } from "../strings/translate";

/**
 * Where a menu opens: at the pointer, or beside the item it belongs to when opened from the keyboard. `above` is
 * where it ends when there is no room below (the top of the caret's line, so the menu does not cover it); without
 * it the menu ends at `top` (the pointer).
 */
export type MenuPlace = { left: number; top: number; above?: number };

export type MenuItem<Id extends string> = {
  id: Id;
  label: string;
  disabled?: boolean;
  /** Draws a line above the item, to group it apart from the ones before. */
  separated?: boolean;
  /** A letter that chooses the item from the keyboard while the menu is open, shown underlined in its label. */
  accessKey?: string;
  /** Makes the item one that is on or off (a `menuitemcheckbox`), checked where it is on. */
  checked?: boolean;
};

/**
 * An item's label with its access letter underlined (the first one in it), or with the letter shown at its end
 * when the label has none (a translation's words may not hold it).
 */
function labelWithAccessKey(label: string, accessKey: string | undefined): ReactNode {
  if (!accessKey) return label;
  const at = label.toLocaleLowerCase().indexOf(accessKey.toLocaleLowerCase());
  if (at < 0)
    return (
      <>
        {label}
        <kbd className="eh-menu-access-key">{accessKey}</kbd>
      </>
    );
  return (
    <>
      {label.slice(0, at)}
      <span className="eh-menu-access">{label.slice(at, at + accessKey.length)}</span>
      {label.slice(at + accessKey.length)}
    </>
  );
}

/**
 * The views' right-click menu, for a card, an entry, a bar, an item or a list's row: it opens at the
 * pointer or, from the keyboard (the Menu key or Shift+F10), beside its item. The first usable item has
 * the focus; the arrow keys, Home and End move between items, Enter, a click or an item's access letter chooses
 * one, and Escape or Tab closes the menu. Closing gives the focus back through `onClose`.
 */
export function ContextMenu<Id extends string>({
  label,
  items,
  place,
  onChoose,
  onClose,
  children,
}: {
  /** The menu's accessible name. */
  label: string;
  items: MenuItem<Id>[];
  place: MenuPlace;
  onChoose: (id: Id) => void;
  onClose: () => void;
  /** Shown under the items, such as a problem with the last choice. */
  children?: ReactNode;
}) {
  const t = useTranslate();
  const buttons = useRef(new Map<Id, HTMLButtonElement>());
  const menu = useRef<HTMLDivElement>(null);
  const enabled = items.filter((item) => !item.disabled).map((item) => item.id);

  // biome-ignore lint/correctness/useExhaustiveDependencies: on opening only: the first enabled item takes the focus and the menu is kept inside the window.
  useEffect(() => {
    buttons.current.get(enabled[0]!)?.focus();
    // Keep the menu inside the window: open up or to the left when there is no room below or right. Up, it ends
    // above the line it was opened from (or at the pointer), and is only moved where even that does not fit.
    const element = menu.current;
    if (!element) return;
    const bounds = element.getBoundingClientRect();
    if (bounds.right > window.innerWidth) element.style.left = `${Math.max(4, window.innerWidth - bounds.width - 4)}px`;
    if (bounds.bottom > window.innerHeight) {
      const upwards = place.above === undefined ? place.top - bounds.height : place.above - bounds.height - 4;
      element.style.top = `${upwards >= 4 ? upwards : Math.max(4, window.innerHeight - bounds.height - 4)}px`;
    }
  }, []);

  function key(event: KeyboardEvent, id: Id) {
    const index = enabled.indexOf(id);
    const next =
      event.key === "ArrowDown"
        ? enabled[(index + 1) % enabled.length]
        : event.key === "ArrowUp"
          ? enabled[(index - 1 + enabled.length) % enabled.length]
          : event.key === "Home"
            ? enabled[0]
            : event.key === "End"
              ? enabled[enabled.length - 1]
              : null;
    const lettered =
      !event.ctrlKey && !event.metaKey && !event.altKey && [...event.key].length === 1
        ? items.find((item) => !item.disabled && item.accessKey?.toLocaleLowerCase() === event.key.toLocaleLowerCase())
        : undefined;
    if (next) {
      event.preventDefault();
      buttons.current.get(next)?.focus();
    } else if (lettered) {
      event.preventDefault();
      onChoose(lettered.id);
    } else if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  }

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the backdrop closes the menu on a click outside it; Escape does so from the keyboard. */}
      <div
        className="eh-menu-backdrop"
        onMouseDown={(event) => {
          event.preventDefault();
          onClose();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          onClose();
        }}
      />
      <div ref={menu} className="eh-menu" role="menu" aria-label={label} style={{ left: place.left, top: place.top }}>
        {items.length === 0 && <p className="eh-menu-problem">{t("common.menuNothing")}</p>}
        {items.map(({ id, label: itemLabel, disabled, separated, accessKey, checked }, index) => (
          <div key={id}>
            {separated && index > 0 && <hr className="eh-menu-separator" />}
            <button
              type="button"
              {...(checked === undefined
                ? { role: "menuitem" }
                : { role: "menuitemcheckbox", "aria-checked": checked })}
              aria-keyshortcuts={accessKey}
              // The label as one word for screen readers, whichever letter of it is drawn underlined.
              aria-label={accessKey ? itemLabel : undefined}
              disabled={disabled}
              ref={(element) => {
                if (element) buttons.current.set(id, element);
                else buttons.current.delete(id);
              }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onChoose(id)}
              onKeyDown={(event) => key(event, id)}
            >
              {labelWithAccessKey(itemLabel, accessKey)}
            </button>
          </div>
        ))}
        {children}
      </div>
    </>
  );
}

/** Where a keyboard-opened menu goes: just below the start of the element it belongs to, or above it. */
export function placeBelow(element: Element): MenuPlace {
  const bounds = element.getBoundingClientRect();
  return { left: bounds.left, top: bounds.bottom, above: bounds.top };
}

/** Whether a key opens the context menu: the Menu key, or Shift+F10. */
export function opensMenu(event: { key: string; shiftKey: boolean }): boolean {
  return event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey);
}
