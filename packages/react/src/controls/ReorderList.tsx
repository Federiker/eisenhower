import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";

import { ariaKeyShortcuts } from "../keyboard/shortcuts";
import { useTranslate } from "../strings/translate";

import { ContextMenu, opensMenu, placeBelow, type MenuItem, type MenuPlace } from "./ContextMenu";
import { classNames } from "./classNames";

type Move = "up" | "down";

/** Whether a right-click inside a row belongs to a field there (which keeps the system's text menu). */
function inField(target: EventTarget): boolean {
  return target instanceof HTMLElement && target.closest("input, textarea, select") !== null;
}

/**
 * A list a page's items are put in order in (a timeline's steps or categories): without Move up, Move down
 * or Delete buttons. A row moves by dragging it onto another, with Alt+Up and Alt+Down while it (or something
 * in it) has the focus, or with Move up and Move down in its menu: right-click, the Menu key or Shift+F10.
 * The menu also offers the caller's own actions (such as Delete); the Delete key asks the caller to delete the
 * focused row. The focus stays on a moved row, comes back to the row when its menu closes, and goes to the row
 * in its place when the focused row is removed. Fields inside a row keep their own keys and the system's text
 * menu.
 */
export function ReorderList<Item, Action extends string>({
  label,
  items,
  idOf,
  menuLabel,
  actions = () => [],
  disabled = false,
  dragType,
  onMove,
  onAction,
  onDelete,
  className,
  children,
}: {
  /** The list's accessible name. */
  label: string;
  items: readonly Item[];
  idOf: (item: Item) => string;
  /** The row's menu's accessible name (such as "Step actions: Act 1"). */
  menuLabel: (item: Item) => string;
  /** The row's own menu items, after Move up and Move down. */
  actions?: (item: Item) => MenuItem<Action>[];
  disabled?: boolean;
  /** The drag data type, so that a row is only dropped on its own list. */
  dragType: string;
  /** Moves a row to a place in the list (0 is the first). */
  onMove: (id: string, to: number) => void;
  onAction?: (action: Action, item: Item) => void;
  /** The Delete key on a focused row (not in a field): the caller deletes it, or asks first. */
  onDelete?: (item: Item) => void;
  className?: string;
  /** A row's contents. */
  children: (item: Item, index: number) => ReactNode;
}) {
  const t = useTranslate();
  const rows = useRef(new Map<string, HTMLLIElement>());
  const dragged = useRef<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ id: string; place: MenuPlace } | null>(null);
  // The row last holding the focus, so that the focus can go to the row in its place when it is removed.
  const focused = useRef<{ id: string; index: number } | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: only a change of the rows can remove the focused one.
  useEffect(() => {
    const last = focused.current;
    if (!last || items.some((item) => idOf(item) === last.id)) return;
    focused.current = null;
    const active = document.activeElement;
    if (items.length === 0 || (active && active !== document.body)) return;
    rows.current.get(idOf(items[Math.min(last.index, items.length - 1)]!))?.focus();
  }, [items]);

  function move(id: string, index: number, way: Move) {
    const to = way === "up" ? index - 1 : index + 1;
    if (to < 0 || to >= items.length) return;
    onMove(id, to);
  }

  function key(event: KeyboardEvent<HTMLLIElement>, id: string, index: number) {
    if (event.nativeEvent.isComposing || disabled) return;
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      move(id, index, event.key === "ArrowUp" ? "up" : "down");
    } else if (opensMenu(event) && !inField(event.target)) {
      event.preventDefault();
      setMenu({ id, place: placeBelow(event.currentTarget) });
    } else if (
      event.key === "Delete" &&
      onDelete &&
      !inField(event.target) &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey
    ) {
      event.preventDefault();
      onDelete(items[index]!);
    }
  }

  function contextMenu(event: MouseEvent<HTMLLIElement>, id: string) {
    if (disabled || inField(event.target)) return;
    event.preventDefault();
    setMenu({ id, place: { left: event.clientX, top: event.clientY } });
  }

  function close(id: string) {
    setMenu(null);
    rows.current.get(id)?.focus();
  }

  const open = menu ? items.find((item) => idOf(item) === menu.id) : undefined;
  const openIndex = open === undefined ? -1 : items.indexOf(open);

  return (
    <>
      <ol className={classNames("eh-reorder-list", className)} aria-label={label}>
        {items.map((item, index) => {
          const id = idOf(item);
          return (
            <li
              key={id}
              ref={(element) => {
                if (element) rows.current.set(id, element);
                else rows.current.delete(id);
              }}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: a row takes the focus so that Alt+arrows and the Menu key move it.
              tabIndex={0}
              aria-keyshortcuts={ariaKeyShortcuts(["moveUp", "moveDown"])}
              data-drop={dropAt === index ? "before" : undefined}
              draggable={!disabled}
              onKeyDown={(event) => key(event, id, index)}
              onFocus={() => {
                focused.current = { id, index };
              }}
              onContextMenu={(event) => contextMenu(event, id)}
              onDragStart={(event) => {
                dragged.current = id;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(dragType, id);
              }}
              onDragOver={(event) => {
                if (!dragged.current) return;
                event.preventDefault();
                setDropAt(index);
              }}
              onDragLeave={() => setDropAt((old) => (old === index ? null : old))}
              onDrop={(event) => {
                event.preventDefault();
                const from = dragged.current;
                dragged.current = null;
                setDropAt(null);
                if (from && from !== id) onMove(from, index);
              }}
              onDragEnd={() => {
                dragged.current = null;
                setDropAt(null);
              }}
            >
              {children(item, index)}
            </li>
          );
        })}
      </ol>
      {menu && open !== undefined && (
        <ContextMenu<Move | Action>
          label={menuLabel(open)}
          items={[
            { id: "up", label: t("common.moveUp"), disabled: openIndex <= 0 },
            { id: "down", label: t("common.moveDown"), disabled: openIndex >= items.length - 1 },
            ...actions(open).map((action, at) => ({ ...action, separated: action.separated ?? at === 0 })),
          ]}
          place={menu.place}
          onClose={() => close(menu.id)}
          onChoose={(choice) => {
            close(menu.id);
            if (choice === "up" || choice === "down") move(menu.id, openIndex, choice as Move);
            else onAction?.(choice as Action, open);
          }}
        />
      )}
    </>
  );
}
