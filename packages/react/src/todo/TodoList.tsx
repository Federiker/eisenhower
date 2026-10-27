import {
  addItem,
  allTags,
  type CalendarDay,
  deleteItem,
  type EditResult,
  filterByTags,
  freeName,
  hasTag,
  indentItem,
  itemsInQuadrant,
  MAX_TODO_TITLE_LENGTH,
  moveItem,
  newId,
  outdentItem,
  type Problem,
  QUADRANTS,
  type Quadrant,
  quadrantFlags,
  quadrantOf,
  quadrantToward,
  renameItem,
  setItemQuadrant,
  shownItems,
  stepItem,
  subtasksOf,
  type TodoItem,
  type TodoList as TodoData,
  todoOutline,
  toggleItemDone,
  today as localToday,
} from "@eisenhower/model";
import { type DragEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";

import { ContextMenu, type MenuItem, type MenuPlace, placeBelow } from "../controls/ContextMenu";
import { DeleteQuestion } from "./DeleteQuestion";
import { Notice } from "../controls/Notice";
import { classNames } from "../controls/classNames";
import { LiveRegion, useAnnouncer } from "../hooks/useAnnouncer";
import { actionOf, shortcutsIn } from "../keyboard/shortcuts";
import { type Translate, useTranslate } from "../strings/translate";
import { type EisenhowerSettings, ViewRoot } from "../theme/EisenhowerProvider";
import { type FocusAction, listNeighbour, matrixNeighbour } from "./navigation";
import { QuickAdd } from "./QuickAdd";
import { type RowDrag, TodoRow } from "./TodoRow";
import { TodoItemDialog } from "./TodoItemDialog";
import { TodoMatrix, type DropZone } from "./TodoMatrix";
import { TodoToolbar } from "./TodoToolbar";

/** How the todo list is shown: as a list, or as the Eisenhower matrix's four quadrants (decision 18). */
export type TodoLayout = "list" | "matrix";

/**
 * The todo list's props (decisions 7 and 18). Controlled: `value` is the list, `onChange` gets each new one.
 * The layout, the tag filter and Hide done are the host's when it gives them (with their `on…Change`), the
 * view's own otherwise. `today` decides what is overdue (the user's local day by default).
 */
export type TodoListProps = EisenhowerSettings & {
  value: TodoData;
  onChange: (next: TodoData) => void;
  /** The layout shown; the view keeps its own (starting with the list) when it is not given. */
  layout?: TodoLayout;
  onLayoutChange?: (layout: TodoLayout) => void;
  /** The tags an item must all have to be shown; none (all items) by default. */
  tagFilter?: readonly string[];
  onTagFilterChange?: (tags: string[]) => void;
  /** Whether done items are hidden; by default shown in the list and hidden in the matrix. */
  hideDone?: boolean;
  onHideDoneChange?: (hide: boolean) => void;
  /** The day it is, for what is overdue; the user's local day by default. */
  today?: CalendarDay;
  /** Shows the list without letting it change: no ticking, editing, adding, moving or deleting. */
  readOnly?: boolean;
  className?: string;
};

const KEYS = shortcutsIn("todo");
const DRAG_TYPE = "application/x-eisenhower-todo-item";

type Menu = { id: string; place: MenuPlace; returnTo: HTMLElement | null };
type MenuAction = "details" | "rename" | "subtask" | "up" | "down" | "indent" | "outdent" | Quadrant | "delete";
type Drop = { before: string } | { end: true } | { quadrant: Quadrant } | null;
type Focus = { item: string } | { add: string };

/** The words for a title that cannot be used. */
function titleProblem(t: Translate, problem: Problem): string {
  if (problem === "blank") return t("todo.problem.blank");
  if (problem === "tooLong") return t("todo.problem.titleTooLong", { max: MAX_TODO_TITLE_LENGTH });
  return t("todo.problem.other");
}

const quadrantName = (t: Translate, quadrant: Quadrant) => t(`todo.quadrant.${quadrant}`);

/**
 * A todo list (decision 18), as a list or as the Eisenhower matrix, with a toolbar to switch between them,
 * the Hide done switch and the tag filter.
 *
 * The list: each item with its check box, its title (renamed in place), its due day ("Overdue" in words
 * when it is past), its tags and notes; subtasks under their parent, which counts how many are done; a field
 * at the foot adds an item. Items move by dragging (before another item, or to the end), by Alt+↑ and Alt+↓
 * among their siblings, and Alt+→ and Alt+← make an item a subtask of the one above or a top-level item
 * again; the focus stays on the moved item and its new place is announced.
 *
 * The matrix: the four quadrants (Do, Schedule, Delegate, Drop) in a 2×2 grid, urgent on the left and
 * important at the top, each a region with its heading, its description, its items (subtasks among them,
 * each saying its parent) and a field that adds an item to it. Dragging an item to a quadrant, or Alt and an
 * arrow, moves it there, which changes its flags; the order within a quadrant is the list's.
 *
 * In both, the arrows, Home and End move the focus, Enter opens the item's details, F2 renames it, Delete
 * asks before deleting it (and what becomes of its subtasks), and the Menu key, Shift+F10, a right-click or
 * the ⋮ button open its menu.
 */
export function TodoList({ strings, t, locale, theme, className, ...props }: TodoListProps) {
  return (
    <ViewRoot strings={strings} t={t} locale={locale} theme={theme} className={classNames("eh-todo", className)}>
      <TodoListContent {...props} />
    </ViewRoot>
  );
}

function TodoListContent({
  value,
  onChange,
  layout: layoutProp,
  onLayoutChange,
  tagFilter: filterProp,
  onTagFilterChange,
  hideDone: hideProp,
  onHideDoneChange,
  today: todayProp,
  readOnly = false,
}: Omit<TodoListProps, keyof EisenhowerSettings | "className">) {
  const t = useTranslate();
  const { message, announce } = useAnnouncer();
  const [ownLayout, setOwnLayout] = useState<TodoLayout>("list");
  const [ownFilter, setOwnFilter] = useState<readonly string[]>([]);
  const [ownHide, setOwnHide] = useState<Record<TodoLayout, boolean>>({ list: false, matrix: true });
  const [menu, setMenu] = useState<Menu | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [details, setDetails] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; nonce: number } | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [drop, setDrop] = useState<Drop>(null);
  const dragged = useRef<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const layout = layoutProp ?? ownLayout;
  const tagFilter = filterProp ?? ownFilter;
  const hideDone = hideProp ?? ownHide[layout];
  const today = todayProp ?? localToday();
  const matrix = layout === "matrix";

  /** The item's check box: its focus point. */
  const checkOf = (id: string) =>
    [...(root.current?.querySelectorAll<HTMLElement>("[data-item-id]") ?? [])]
      .find((element) => element.dataset.itemId === id)
      ?.querySelector<HTMLElement>(".eh-todo-check") ?? null;

  // Once the list is drawn again after a change, the focus goes where the change asked.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new request moves the focus.
  useEffect(() => {
    if (!focus) return;
    if ("item" in focus) checkOf(focus.item)?.focus();
    else root.current?.querySelector<HTMLElement>(`[data-quick-add="${focus.add}"]`)?.focus();
  }, [focus]);

  const focusItem = (id: string) => setFocus({ item: id });
  const find = (list: TodoData, id: string) => list.items.find((item) => item.id === id);

  /** The items shown in each quadrant of the matrix. */
  function quadrantItems(list: TodoData): Record<Quadrant, TodoItem[]> {
    const shown = (quadrant: Quadrant) =>
      filterByTags(itemsInQuadrant(list, quadrant), tagFilter).filter((item) => !(hideDone && item.done));
    return { do: shown("do"), schedule: shown("schedule"), delegate: shown("delegate"), drop: shown("drop") };
  }

  /** The items shown, in the order the focus goes through them. */
  function shownOrder(list: TodoData): string[] {
    if (!matrix) return shownItems(list, { tags: tagFilter, hideDone }).map((item) => item.id);
    const quadrants = quadrantItems(list);
    return QUADRANTS.flatMap((quadrant) => quadrants[quadrant].map((item) => item.id));
  }

  /** Saves an edit's list; false when it was refused. */
  function commit(result: EditResult<TodoData>): result is { ok: true; value: TodoData } {
    if (result.ok) onChange(result.value);
    return result.ok;
  }

  /**
   * After an item is hidden or deleted, the focus goes to the item that was after it (or before it) and is
   * still shown in `next`, or to the field that adds items.
   */
  function focusAfterLeaving(id: string, next: TodoData, quadrant: Quadrant) {
    const before = shownOrder(value);
    const after = new Set(shownOrder(next));
    const index = before.indexOf(id);
    const neighbour =
      before.slice(index + 1).find((one) => after.has(one)) ??
      before
        .slice(0, Math.max(0, index))
        .reverse()
        .find((one) => after.has(one));
    if (neighbour) focusItem(neighbour);
    else setFocus({ add: matrix ? quadrant : "list" });
  }

  /** Says where an item now is in the list: its place among its siblings, under its parent if it has one. */
  function announcePlace(next: TodoData, id: string) {
    const item = find(next, id)!;
    const siblings = todoOutline(next).filter((one) => one.parentId === item.parentId);
    const place = { title: item.title, position: siblings.indexOf(item) + 1, total: siblings.length };
    const parent = item.parentId === null ? undefined : find(next, item.parentId);
    announce(
      parent ? t("todo.announce.movedUnder", { ...place, parent: parent.title }) : t("todo.announce.moved", place),
    );
  }

  function move(id: string, result: EditResult<TodoData>) {
    focusItem(id);
    if (commit(result)) announcePlace(result.value, id);
  }

  function moveToQuadrant(id: string, quadrant: Quadrant) {
    focusItem(id);
    const item = find(value, id);
    // Dropped back where it was: nothing changes, and nothing is said.
    if (!item || quadrantOf(item) === quadrant) return;
    const result = setItemQuadrant(value, id, quadrant);
    if (!commit(result)) return;
    announce(t("todo.announce.quadrant", { title: find(value, id)!.title, quadrant: quadrantName(t, quadrant) }));
  }

  function toggle(item: TodoItem) {
    const result = toggleItemDone(value, item.id);
    if (!commit(result)) return;
    if (shownOrder(result.value).includes(item.id)) return;
    focusAfterLeaving(item.id, result.value, quadrantOf(item));
    announce(t("todo.announce.hidden", { title: item.title }));
  }

  async function rename(id: string, title: string): Promise<string | null> {
    const result = renameItem(value, id, title);
    if (!result.ok) return titleProblem(t, result.reason);
    onChange(result.value);
    return null;
  }

  /** Adds an item from a field: with the filter's tags (so that it stays shown) and a quadrant's flags. */
  function add(title: string, quadrant: Quadrant | null): string | null {
    const result = addItem(value, {
      id: newId(),
      title,
      tags: [...tagFilter],
      ...(quadrant ? quadrantFlags(quadrant) : {}),
    });
    if (!result.ok) return titleProblem(t, result.reason);
    onChange(result.value);
    announce(t("todo.announce.added", { title: title.trim() }));
    return null;
  }

  function addSubtask(parent: TodoItem) {
    const id = newId();
    const title = freeName(
      subtasksOf(value, parent.id).map((item) => ({ name: item.title })),
      t("todo.newSubtaskName"),
    );
    if (commit(addItem(value, { id, title, tags: [...tagFilter] }, { parentId: parent.id }))) {
      setRenaming({ id, nonce: Date.now() });
    }
  }

  function keep(id: string) {
    setDeleting(null);
    focusItem(id);
  }

  function remove(item: TodoItem, subtasks: "delete" | "keep") {
    const result = deleteItem(value, item.id, subtasks);
    if (!commit(result)) return;
    setDeleting(null);
    focusAfterLeaving(item.id, result.value, quadrantOf(item));
    announce(t("todo.announce.deleted", { title: item.title }));
  }

  /** Moves an item the way an Alt+arrow asks: in the list, up, down, in or out; in the matrix, to a quadrant. */
  function moveWay(item: TodoItem, way: "up" | "down" | "left" | "right") {
    if (matrix) {
      const quadrant = quadrantToward(quadrantOf(item), way);
      if (quadrant) moveToQuadrant(item.id, quadrant);
      return;
    }
    const result =
      way === "left"
        ? outdentItem(value, item.id)
        : way === "right"
          ? indentItem(value, item.id)
          : stepItem(value, item.id, way);
    if (result.ok) move(item.id, result);
  }

  function openMenu(id: string, place: MenuPlace, returnTo: HTMLElement | null) {
    setMenu({ id, place, returnTo });
  }

  function closeMenu() {
    const returnTo = menu?.returnTo ?? null;
    setMenu(null);
    returnTo?.focus();
  }

  function choose(action: MenuAction, item: TodoItem) {
    closeMenu();
    switch (action) {
      case "details":
        setDetails(item.id);
        break;
      case "rename":
        setRenaming({ id: item.id, nonce: Date.now() });
        break;
      case "subtask":
        addSubtask(item);
        break;
      case "up":
      case "down":
        moveWay(item, action);
        break;
      case "indent":
        moveWay(item, "right");
        break;
      case "outdent":
        moveWay(item, "left");
        break;
      case "delete":
        setDeleting(item.id);
        break;
      default:
        moveToQuadrant(item.id, action);
    }
  }

  function menuItems(item: TodoItem): MenuItem<MenuAction>[] {
    const items: MenuItem<MenuAction>[] = [
      { id: "details", label: t("todo.details") },
      { id: "rename", label: t("todo.rename") },
    ];
    if (item.parentId === null) items.push({ id: "subtask", label: t("todo.addSubtask") });
    if (!matrix) {
      items.push(
        { id: "up", label: t("common.moveUp"), disabled: !stepItem(value, item.id, "up").ok, separated: true },
        { id: "down", label: t("common.moveDown"), disabled: !stepItem(value, item.id, "down").ok },
        item.parentId === null
          ? { id: "indent", label: t("todo.indent"), disabled: !indentItem(value, item.id).ok }
          : { id: "outdent", label: t("todo.outdent") },
      );
    }
    const current = quadrantOf(item);
    QUADRANTS.filter((quadrant) => quadrant !== current).forEach((quadrant, index) => {
      items.push({
        id: quadrant,
        label: t("todo.moveToQuadrant", { quadrant: quadrantName(t, quadrant) }),
        separated: index === 0,
      });
    });
    items.push({ id: "delete", label: t("todo.delete"), separated: true });
    return items;
  }

  function itemKey(event: KeyboardEvent<HTMLInputElement>, item: TodoItem) {
    const action = actionOf(event.nativeEvent, KEYS);
    if (!action) return;
    if (action.startsWith("focus")) {
      const next = matrix
        ? matrixNeighbour(
            Object.fromEntries(
              Object.entries(quadrantItems(value)).map(([quadrant, items]) => [quadrant, items.map((one) => one.id)]),
            ) as Record<Quadrant, string[]>,
            item.id,
            action as FocusAction,
          )
        : listNeighbour(shownOrder(value), item.id, action as FocusAction);
      if (next) {
        event.preventDefault();
        checkOf(next)?.focus();
      }
      return;
    }
    if (readOnly) return;
    const row = event.currentTarget.closest<HTMLElement>(".eh-todo-row") ?? event.currentTarget;
    switch (action) {
      case "moveUp":
      case "moveDown":
      case "moveLeft":
      case "moveRight":
        event.preventDefault();
        moveWay(item, action.slice(4).toLowerCase() as "up" | "down" | "left" | "right");
        break;
      case "open":
        event.preventDefault();
        setDetails(item.id);
        break;
      case "rename":
        event.preventDefault();
        setRenaming({ id: item.id, nonce: Date.now() });
        break;
      case "delete":
        event.preventDefault();
        setDeleting(item.id);
        break;
      case "menu":
        event.preventDefault();
        openMenu(item.id, placeBelow(row), event.currentTarget);
        break;
    }
  }

  function endDrag() {
    dragged.current = null;
    setDrop(null);
  }

  /** The dragged item's id, once, as a drop takes it. */
  function take(): string | null {
    const id = dragged.current;
    endDrag();
    return id;
  }

  function dragStart(item: TodoItem) {
    return (event: DragEvent<HTMLElement>) => {
      event.stopPropagation();
      dragged.current = item.id;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(DRAG_TYPE, item.id);
    };
  }

  /** Dragging in the list: an item dropped on another goes just before it, among its siblings. */
  function listDrag(item: TodoItem): RowDrag {
    return {
      draggable: !readOnly,
      onDragStart: dragStart(item),
      onDragEnd: endDrag,
      onDragOver: (event) => {
        if (!dragged.current) return;
        event.preventDefault();
        event.stopPropagation();
        setDrop({ before: item.id });
      },
      onDragLeave: () => setDrop((old) => (old && "before" in old && old.before === item.id ? null : old)),
      onDrop: (event) => {
        if (!dragged.current) return;
        event.preventDefault();
        event.stopPropagation();
        const id = take();
        if (!id || id === item.id) return;
        const siblings = todoOutline(value).filter((one) => one.parentId === item.parentId && one.id !== id);
        const result = moveItem(value, id, item.parentId, siblings.indexOf(item));
        if (result.ok) move(id, result);
      },
    };
  }

  /** A place that takes a dragged item: the end of the list, or a quadrant. */
  function dropZone(zone: Exclude<Drop, null>, onDropped: (id: string) => void): DropZone {
    const here = (old: Drop) => JSON.stringify(old) === JSON.stringify(zone);
    return {
      "data-drop": here(drop) ? "inside" : undefined,
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (!dragged.current) return;
        event.preventDefault();
        setDrop(zone);
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        setDrop((old) => (here(old) ? null : old));
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        if (!dragged.current) return;
        event.preventDefault();
        const id = take();
        if (id) onDropped(id);
      },
    };
  }

  function row(item: TodoItem, subtasks?: TodoItem[]) {
    return (
      <TodoRow
        key={item.id}
        item={item}
        list={value}
        today={today}
        readOnly={readOnly}
        showParent={matrix}
        drop={drop !== null && "before" in drop && drop.before === item.id}
        renameRequest={renaming?.id === item.id ? renaming.nonce : undefined}
        onToggle={() => toggle(item)}
        onRename={(title) => rename(item.id, title)}
        onKeyDown={(event) => itemKey(event, item)}
        onMenu={(event) => {
          if (event.target instanceof HTMLElement && event.target.closest("input:not([type=checkbox]), textarea"))
            return;
          event.preventDefault();
          event.stopPropagation();
          openMenu(item.id, { left: event.clientX, top: event.clientY }, checkOf(item.id));
        }}
        onMore={(button) => openMenu(item.id, placeBelow(button), button)}
        drag={matrix ? { draggable: !readOnly, onDragStart: dragStart(item), onDragEnd: endDrag } : listDrag(item)}
        subtasks={
          subtasks &&
          subtasks.length > 0 && (
            <ol className="eh-todo-subtasks" aria-label={t("todo.subtasksOf", { title: item.title })}>
              {subtasks.map((subtask) => row(subtask))}
            </ol>
          )
        }
      >
        {deleting === item.id && (
          <DeleteQuestion
            item={item}
            subtasks={subtasksOf(value, item.id).length}
            onDelete={(subtasks) => remove(item, subtasks)}
            onCancel={() => keep(item.id)}
          />
        )}
      </TodoRow>
    );
  }

  function listLayout() {
    const shown = shownItems(value, { tags: tagFilter, hideDone });
    // A subtask is drawn under its parent; one whose parent is not a top-level item (a list that is not
    // valid) is drawn at the top level, as the outline puts it.
    const nested = (item: TodoItem) => item.parentId !== null && find(value, item.parentId)?.parentId === null;
    return (
      <>
        <div
          className="eh-todo-body"
          {...dropZone({ end: true }, (id) => move(id, moveItem(value, id, null, Infinity)))}
        >
          {shown.length > 0 ? (
            <ol className="eh-todo-items" aria-label={t("todo.items")}>
              {shown
                .filter((item) => !nested(item))
                .map((item) =>
                  row(
                    item,
                    shown.filter((one) => one.parentId === item.id && nested(one)),
                  ),
                )}
            </ol>
          ) : (
            <Notice>{t(value.items.length === 0 ? "todo.empty" : "todo.emptyShown")}</Notice>
          )}
        </div>
        {!readOnly && <QuickAdd label={t("todo.newItem")} place="list" onAdd={(title) => add(title, null)} />}
      </>
    );
  }

  function chooseLayout(next: TodoLayout) {
    if (layoutProp === undefined) setOwnLayout(next);
    onLayoutChange?.(next);
  }

  function chooseHide(hide: boolean) {
    if (hideProp === undefined) setOwnHide((old) => ({ ...old, [layout]: hide }));
    onHideDoneChange?.(hide);
  }

  function chooseFilter(tags: string[]) {
    if (filterProp === undefined) setOwnFilter(tags);
    onTagFilterChange?.(tags);
  }

  const tags = [
    ...allTags(value),
    ...tagFilter.filter((tag) => !allTags(value).some((one) => hasTag({ tags: [one] }, tag))),
  ];
  const menuItem = menu ? find(value, menu.id) : undefined;
  const detailsItem = details ? find(value, details) : undefined;

  return (
    <div ref={root} className="eh-todo-content">
      <TodoToolbar
        matrix={matrix}
        onLayout={(toMatrix) => chooseLayout(toMatrix ? "matrix" : "list")}
        hideDone={hideDone}
        onHideDone={chooseHide}
        tags={tags}
        tagFilter={tagFilter}
        onTagFilter={chooseFilter}
      />
      {matrix ? (
        <TodoMatrix
          quadrants={quadrantItems(value)}
          readOnly={readOnly}
          row={(item) => row(item)}
          dropZone={(quadrant) => dropZone({ quadrant }, (id) => moveToQuadrant(id, quadrant))}
          onAdd={add}
        />
      ) : (
        listLayout()
      )}
      <LiveRegion message={message} />
      {menu && menuItem && (
        <ContextMenu
          label={t("todo.menuNamed", { title: menuItem.title })}
          items={menuItems(menuItem)}
          place={menu.place}
          onChoose={(action) => choose(action, menuItem)}
          onClose={closeMenu}
        />
      )}
      {detailsItem && (
        <TodoItemDialog
          list={value}
          item={detailsItem}
          onSave={(next) => {
            onChange(next);
            setDetails(null);
            focusItem(detailsItem.id);
          }}
          onClose={() => {
            setDetails(null);
            focusItem(detailsItem.id);
          }}
        />
      )}
    </div>
  );
}
