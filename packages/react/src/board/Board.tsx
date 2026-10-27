import {
  addCardAt,
  addColumn,
  type Board as BoardValue,
  type BoardCard,
  type BoardColumn,
  type BoardDirection,
  blankCard,
  boardGroups,
  boardNeighbour,
  type CardStep,
  type CardTarget,
  type ColumnDisposal,
  cardPlace,
  cardStepTarget,
  cardsInColumn,
  deleteCard,
  deleteColumn,
  type EditResult,
  editCard,
  freeName,
  moveCard,
  moveColumn,
  newCardSpot,
  newId,
  type Problem,
  placeBefore,
  renameColumn,
} from "@eisenhower/model";
import {
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "../controls/Button";
import { ContextMenu, type MenuItem, type MenuPlace, placeBelow } from "../controls/ContextMenu";
import { classNames } from "../controls/classNames";
import { InlineQuestion } from "../controls/InlineQuestion";
import { MoveToDialog } from "../controls/MoveToDialog";
import { Notice } from "../controls/Notice";
import { LiveRegion, useAnnouncer } from "../hooks/useAnnouncer";
import { actionOf, type ShortcutAction, shortcutsIn } from "../keyboard/shortcuts";
import { useTranslate } from "../strings/translate";
import { type EisenhowerSettings, ViewRoot } from "../theme/EisenhowerProvider";
import { BOARD_PROBLEM_LABELS, CardDialog, type CardDialogSubject } from "./CardDialog";
import { CardRow, CardTile } from "./CardItem";
import { ColumnHeading } from "./ColumnHeading";

/** How the board is drawn: columns of cards side by side, or the same groups as a list, one under another. */
export type BoardLayout = "board" | "list";

export type BoardProps = EisenhowerSettings & {
  /** The board: its columns and cards (`@eisenhower/model`'s `Board`). */
  value: BoardValue;
  /** Every change, as the whole new board, made by the model's edit operations. */
  onChange: (next: BoardValue) => void;
  /** Columns side by side (`board`, the default) or a list grouped by column (`list`). */
  layout?: BoardLayout;
  /** Shows the board without letting it be changed: no dragging, no edits; cards still open. */
  readOnly?: boolean;
  /** Something of the host's shown on each card and row with its details, such as a status or a target. */
  badge?: (card: BoardCard) => ReactNode;
  /** The host's own content for a card's details (instead of its summary, colour's name and badge). */
  renderCard?: (card: BoardCard) => ReactNode;
  /**
   * Opens a card in the host's own editor (Enter, a click or a double-click, Open in its menu, and New card,
   * which then adds the card first); without it, the board's own dialog edits the card.
   */
  onOpenCard?: (id: string) => void;
  /** The card shown as chosen; by default, the card last opened. */
  selectedId?: string | null;
  className?: string;
};

type CardAction = "open" | "rename" | "up" | "down" | "moveTo" | "delete";
type ColumnAction = "rename" | "up" | "down" | "delete";

/** The menu that is open, for a card or a column, and where the focus goes back when it closes. */
type Menu = { kind: "card" | "column"; id: string; place: MenuPlace; returnTo: HTMLElement | null };

/** Where a dragged card or column would go: before a card, at the end of a group, or at a column's place. */
type Drop = { card: string } | { group: string | null } | { column: number } | null;

/** Where the focus goes once the board is drawn again. */
type FocusTarget = { card: string } | { column: string } | "newCard" | "newColumn";

/**
 * A focus to give once drawn: at once (`base` null), or once the host has given back a board other than
 * `base`, the one the change was made on (a controlled view's change is drawn when the host passes it back).
 */
type FocusRequest = { target: FocusTarget; base: BoardValue | null };

const SHORTCUTS = shortcutsIn();

const CARD_STEPS: Partial<Record<ShortcutAction, CardStep>> = {
  moveUp: "up",
  moveDown: "down",
  moveLeft: "previousColumn",
  moveRight: "nextColumn",
};

const FOCUS_MOVES: Partial<Record<ShortcutAction, BoardDirection>> = {
  focusUp: "up",
  focusDown: "down",
  focusLeft: "left",
  focusRight: "right",
  focusFirst: "first",
  focusLast: "last",
};

const CARD_TYPE = "application/x-eisenhower-board-card";
const COLUMN_TYPE = "application/x-eisenhower-board-column";

/**
 * A board's columns and cards (decision 15), as columns of cards side by side or as a list grouped by
 * column: jerome's plot board and list (PlotList.tsx), made generic. Cards outside every column are a column
 * of their own, "No column", first when it has cards; while a card is dragged and it has none, it is offered
 * after the other columns on the board (first in the list). A column's name reads as text with a pencil; New
 * column makes one at once, open for its name. Columns move by dragging their heading, by Alt and the arrows
 * on it, or with their menu, which also deletes them, as the Delete key does; deleting one with cards asks
 * where they go. Cards move by dragging (onto a card to go before it, onto a column to go at its end), by Alt
 * and the arrows (up and down within the column, left and right to the column before or after; the focus
 * stays on the card and its new place is announced), or by their menu; the arrows, Home and End move the
 * focus; Enter opens a card, F2 renames it, and Delete asks first.
 */
export function Board({ strings, t, locale, theme, className, ...props }: BoardProps) {
  return (
    <ViewRoot strings={strings} t={t} locale={locale} theme={theme} className={classNames("eh-board", className)}>
      <BoardContent {...props} />
    </ViewRoot>
  );
}

function BoardContent({
  value,
  onChange,
  layout = "board",
  readOnly = false,
  badge,
  renderCard,
  onOpenCard,
  selectedId,
}: Omit<BoardProps, keyof EisenhowerSettings | "className">) {
  const t = useTranslate();
  const { message, announce } = useAnnouncer();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [deletingCard, setDeletingCard] = useState<string | null>(null);
  const [deletingColumn, setDeletingColumn] = useState<string | null>(null);
  const [movingCard, setMovingCard] = useState<string | null>(null);
  const [renamingCard, setRenamingCard] = useState<string | null>(null);
  const [dialog, setDialog] = useState<CardDialogSubject | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [drop, setDrop] = useState<Drop>(null);
  const [draggingCard, setDraggingCard] = useState(false);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  // A column whose name opens for editing once it is drawn (a new column, or F2).
  const [naming, setNaming] = useState<{ id: string; request: number } | null>(null);
  const requests = useRef(0);
  const dragged = useRef<{ kind: "card" | "column"; id: string } | null>(null);
  const dragTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const root = useRef<HTMLElement>(null);
  const newCardButton = useRef<HTMLButtonElement>(null);
  const newColumnButton = useRef<HTMLButtonElement>(null);
  const board = layout === "board";
  const selected = selectedId === undefined ? opened : selectedId;

  useEffect(() => () => clearTimeout(dragTimer.current), []);

  // Once the board is drawn again with the change, the focus goes where the change asked (the moved card…).
  useEffect(() => {
    if (!focus || (focus.base !== null && value === focus.base)) return;
    setFocus(null);
    const { target } = focus;
    if (target === "newCard") newCardButton.current?.focus();
    else if (target === "newColumn") newColumnButton.current?.focus();
    else if ("card" in target) {
      const element = [...(root.current?.querySelectorAll<HTMLElement>("[data-card-id]") ?? [])].find(
        (one) => one.dataset.cardId === target.card,
      );
      element?.querySelector<HTMLElement>(".eh-board-card-title")?.focus();
    } else {
      const element = [...(root.current?.querySelectorAll<HTMLElement>("[data-column-id]") ?? [])].find(
        (one) => one.dataset.columnId === target.column,
      );
      element?.querySelector<HTMLElement>(".eh-board-more")?.focus();
    }
  }, [focus, value]);

  const groups = boardGroups(value);
  const cardOf = (id: string) => value.cards.find((card) => card.id === id);
  const columnOf = (id: string) => value.columns.find((column) => column.id === id);
  const groupName = (current: BoardValue, columnId: string | null) =>
    columnId === null ? t("board.noColumn") : (current.columns.find((column) => column.id === columnId)?.name ?? "");

  /** Focuses a target now, or once the host has drawn the board changed from `base`. */
  function focusLater(target: FocusTarget, base: BoardValue | null = null) {
    setFocus({ target, base });
  }

  /** Makes one change: hands the new board to the host, or shows why it was refused. */
  function change(edit: (current: BoardValue) => EditResult<BoardValue>): BoardValue | null {
    const result = edit(value);
    if (!result.ok) {
      setProblem(result.reason);
      return null;
    }
    setProblem(null);
    onChange(result.value);
    return result.value;
  }

  /** Moves a card where `target` says, then announces where it went and keeps the focus on it. */
  function moveCardTo(id: string, target: CardTarget | null) {
    const moved = target && change((current) => moveCard(current, id, target.columnId, target.index));
    focusLater({ card: id }, moved ? value : null);
    if (!moved) return;
    const where = cardPlace(moved, id)!;
    const group = boardGroups(moved)[where.group]!;
    announce(
      t("board.movedTo", {
        name: moved.cards.find((one) => one.id === id)!.title,
        group: groupName(moved, group.columnId),
        position: where.index + 1,
        total: group.cards.length,
      }),
    );
  }

  function step(id: string, way: CardStep) {
    const target = cardStepTarget(value, id, way);
    if (target) moveCardTo(id, target);
  }

  function open(id: string) {
    setOpened(id);
    if (onOpenCard) {
      onOpenCard(id);
      return;
    }
    const card = cardOf(id);
    if (card) setDialog({ kind: "card", card });
  }

  /** New card: the board's dialog for a card not yet on it, or (for a host's editor) a card added at once. */
  function newCard() {
    const spot = newCardSpot(value, selected);
    const card = blankCard(
      newId(),
      freeName(
        value.cards.map((one) => ({ name: one.title })),
        t("board.newCardTitle"),
      ),
      spot.columnId,
    );
    if (!onOpenCard) {
      setDialog({ kind: "new", card });
      return;
    }
    if (!change((current) => addCardAt(current, card, spot))) return;
    setOpened(card.id);
    focusLater({ card: card.id }, value);
    onOpenCard(card.id);
  }

  function closeDialog(focusOn: string | null, changed: boolean) {
    setDialog(null);
    focusLater(focusOn === null ? "newCard" : { card: focusOn }, changed ? value : null);
  }

  function saveCard(subject: CardDialogSubject, card: BoardCard): boolean {
    if (subject.kind === "card") return change((current) => editCard(current, card)) !== null;
    const saved = change((current) => addCardAt(current, card, newCardSpot(current, selected))) !== null;
    if (saved) setOpened(card.id);
    return saved;
  }

  /** Closes the question about deleting a card and goes back to the card. */
  function keepCard(id: string) {
    setDeletingCard(null);
    focusLater({ card: id });
  }

  /** Deletes a card; the focus goes to the card after it in its group, or before, or to New card. */
  function removeCard(card: BoardCard) {
    const { cards } = groups[cardPlace(value, card.id)?.group ?? 0]!;
    const index = cards.findIndex((one) => one.id === card.id);
    const neighbour = cards[index + 1] ?? cards[index - 1] ?? null;
    if (!change((current) => deleteCard(current, card.id))) return;
    setDeletingCard(null);
    setDialog(null);
    focusLater(neighbour ? { card: neighbour.id } : "newCard", value);
  }

  function renameCard(card: BoardCard, title: string) {
    setRenamingCard(null);
    const renamed = change((current) => editCard(current, { ...card, title }));
    focusLater({ card: card.id }, renamed ? value : null);
  }

  /** Closes the question about deleting a column and goes back to the column's heading. */
  function keepColumn(id: string) {
    setDeletingColumn(null);
    focusLater({ column: id });
  }

  /** Deletes a column without cards at once, or asks where its cards go. */
  function askDeleteColumn(id: string) {
    const column = columnOf(id);
    if (!column) return;
    if (cardsInColumn(value, id) > 0) setDeletingColumn(id);
    else removeColumn(column, "delete");
  }

  /** Deletes a column; the focus goes to the column after it, or before, or to New column. */
  function removeColumn(column: BoardColumn, disposal: ColumnDisposal) {
    const index = value.columns.findIndex((one) => one.id === column.id);
    const neighbour = value.columns[index + 1] ?? value.columns[index - 1] ?? null;
    if (!change((current) => deleteColumn(current, column.id, disposal))) return;
    setDeletingColumn(null);
    focusLater(neighbour ? { column: neighbour.id } : "newColumn", value);
  }

  async function renameColumnTo(id: string, name: string): Promise<string | null> {
    const checked = renameColumn(value, id, name);
    if (!checked.ok) return t(BOARD_PROBLEM_LABELS[checked.reason]);
    change(() => checked);
    return null;
  }

  function shiftColumn(id: string, by: number) {
    const index = value.columns.findIndex((column) => column.id === id);
    if (index < 0 || index + by < 0 || index + by >= value.columns.length) return;
    const moved = change((current) => moveColumn(current, id, index + by));
    focusLater({ column: id }, moved ? value : null);
    if (moved) {
      announce(
        t("board.columnMovedTo", {
          name: value.columns[index]!.name,
          position: index + by + 1,
          total: value.columns.length,
        }),
      );
    }
  }

  function newColumn() {
    const id = newId();
    const name = freeName(value.columns, t("board.newColumnName"));
    if (change((current) => addColumn(current, id, name))) {
      requests.current += 1;
      setNaming({ id, request: requests.current });
    }
  }

  function renameColumnLater(id: string) {
    requests.current += 1;
    setNaming({ id, request: requests.current });
  }

  function openMenu(kind: Menu["kind"], id: string, place: MenuPlace, returnTo: HTMLElement | null) {
    setMenu({ kind, id, place, returnTo });
  }

  function closeMenu() {
    const returnTo = menu?.returnTo ?? null;
    setMenu(null);
    returnTo?.focus();
  }

  function chooseCard(action: CardAction, id: string) {
    setMenu(null);
    switch (action) {
      case "open":
        open(id);
        break;
      case "rename":
        setRenamingCard(id);
        break;
      case "up":
      case "down":
        step(id, action);
        break;
      case "moveTo":
        setMovingCard(id);
        break;
      case "delete":
        setDeletingCard(id);
        break;
    }
  }

  function chooseColumn(action: ColumnAction, id: string) {
    setMenu(null);
    switch (action) {
      case "rename":
        renameColumnLater(id);
        break;
      case "up":
        shiftColumn(id, -1);
        break;
      case "down":
        shiftColumn(id, 1);
        break;
      case "delete":
        askDeleteColumn(id);
        break;
    }
  }

  function cardItems(id: string): MenuItem<CardAction>[] {
    const items: MenuItem<CardAction>[] = [{ id: "open", label: t("board.open") }];
    if (readOnly) return items;
    return [
      ...items,
      { id: "rename", label: t("common.rename") },
      { id: "up", label: t("common.moveUp"), disabled: !cardStepTarget(value, id, "up") },
      { id: "down", label: t("common.moveDown"), disabled: !cardStepTarget(value, id, "down") },
      { id: "moveTo", label: t("board.moveToColumn") },
      { id: "delete", label: t("board.deleteCard"), separated: true },
    ];
  }

  function columnItems(id: string): MenuItem<ColumnAction>[] {
    const index = value.columns.findIndex((column) => column.id === id);
    return [
      { id: "rename", label: t("common.rename") },
      { id: "up", label: t(board ? "board.moveLeft" : "common.moveUp"), disabled: index <= 0 },
      {
        id: "down",
        label: t(board ? "board.moveRight" : "common.moveDown"),
        disabled: index >= value.columns.length - 1,
      },
      { id: "delete", label: t("board.deleteColumn"), separated: true },
    ];
  }

  /** The card the focus goes to: the board's neighbour, or in the list the card before or after in order. */
  function neighbour(id: string, direction: BoardDirection): string | null {
    if (board) return boardNeighbour(value, id, direction);
    const order = groups.flatMap((group) => group.cards.map((card) => card.id));
    const index = order.indexOf(id);
    const to = { up: index - 1, down: index + 1, first: 0, last: order.length - 1, left: -1, right: -1 }[direction];
    return to >= 0 && to < order.length && to !== index ? order[to]! : null;
  }

  function cardKey(event: KeyboardEvent<HTMLButtonElement>, card: BoardCard) {
    const action = actionOf(event.nativeEvent, SHORTCUTS);
    if (!action) return;
    const way = CARD_STEPS[action];
    const direction = FOCUS_MOVES[action];
    if (way) {
      if (!readOnly) step(card.id, way);
    } else if (direction) {
      const next = neighbour(card.id, direction);
      if (next) focusLater({ card: next });
    } else if (action === "open") {
      open(card.id);
    } else if (action === "menu") {
      openMenu("card", card.id, placeBelow(event.currentTarget), event.currentTarget);
    } else if (action === "rename" && !readOnly) {
      setRenamingCard(card.id);
    } else if (action === "delete" && !readOnly) {
      setDeletingCard(card.id);
    } else {
      return;
    }
    event.preventDefault();
  }

  function columnKey(event: KeyboardEvent<HTMLElement>, column: BoardColumn) {
    if (readOnly) return;
    const from = event.target instanceof HTMLElement ? event.target : event.currentTarget;
    if (from.closest("input, textarea, select, [role='alertdialog']")) return;
    const action = actionOf(event.nativeEvent, SHORTCUTS);
    if (action === "moveUp" || action === "moveLeft") shiftColumn(column.id, -1);
    else if (action === "moveDown" || action === "moveRight") shiftColumn(column.id, 1);
    else if (action === "menu") openMenu("column", column.id, placeBelow(from), from);
    else if (action === "delete") askDeleteColumn(column.id);
    else if (action === "rename") renameColumnLater(column.id);
    else return;
    event.preventDefault();
  }

  function endDrag() {
    clearTimeout(dragTimer.current);
    dragged.current = null;
    setDrop(null);
    setDraggingCard(false);
  }

  function takeDragged(kind: "card" | "column"): string | null {
    const current = dragged.current;
    endDrag();
    return current?.kind === kind ? current.id : null;
  }

  function cardDrag(card: BoardCard) {
    return {
      draggable: !readOnly,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        event.stopPropagation();
        dragged.current = { kind: "card", id: card.id };
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(CARD_TYPE, card.id);
        // Shown after the drag has begun: changing the page while it starts would end it.
        clearTimeout(dragTimer.current);
        dragTimer.current = setTimeout(() => {
          if (dragged.current?.kind === "card") setDraggingCard(true);
        }, 0);
      },
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (dragged.current?.kind !== "card") return;
        event.preventDefault();
        event.stopPropagation();
        setDrop({ card: card.id });
      },
      onDragLeave: () => setDrop((old) => (old && "card" in old && old.card === card.id ? null : old)),
      onDrop: (event: DragEvent<HTMLElement>) => {
        if (dragged.current?.kind !== "card") return;
        event.preventDefault();
        event.stopPropagation();
        const id = takeDragged("card");
        if (id && id !== card.id) moveCardTo(id, placeBefore(value, id, card.id));
      },
      onDragEnd: endDrag,
    };
  }

  function columnDrag(column: BoardColumn, index: number) {
    return {
      draggable: !readOnly,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        // The name is a text field while it is edited: a drag there selects text rather than moving the column.
        if (event.target instanceof HTMLInputElement) {
          event.preventDefault();
          return;
        }
        dragged.current = { kind: "column", id: column.id };
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(COLUMN_TYPE, column.id);
      },
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (dragged.current?.kind !== "column") return;
        event.preventDefault();
        event.stopPropagation();
        setDrop({ column: index });
      },
      onDragLeave: () => setDrop((old) => (old && "column" in old && old.column === index ? null : old)),
      onDrop: (event: DragEvent<HTMLElement>) => {
        if (dragged.current?.kind !== "column") return;
        event.preventDefault();
        event.stopPropagation();
        const id = takeDragged("column");
        if (id && id !== column.id) {
          const from = value.columns.findIndex((one) => one.id === id);
          shiftColumn(id, index - from);
        }
      },
      onDragEnd: endDrag,
    };
  }

  /** A group takes a dragged card at its end. */
  function groupDrop(columnId: string | null) {
    return {
      "data-drop": drop && "group" in drop && drop.group === columnId ? "inside" : undefined,
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (dragged.current?.kind !== "card") return;
        event.preventDefault();
        setDrop({ group: columnId });
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        setDrop((old) => (old && "group" in old && old.group === columnId ? null : old));
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        if (dragged.current?.kind !== "card") return;
        event.preventDefault();
        const id = takeDragged("card");
        if (id) moveCardTo(id, { columnId, index: Number.MAX_SAFE_INTEGER });
      },
    };
  }

  function cardItem(card: BoardCard) {
    const Item = board ? CardTile : CardRow;
    return (
      <Item
        key={card.id}
        card={card}
        selected={selected === card.id}
        drop={drop !== null && "card" in drop && drop.card === card.id}
        badge={badge?.(card)}
        content={renderCard?.(card)}
        renaming={renamingCard === card.id}
        onRename={(title) => renameCard(card, title)}
        onRenameCancel={() => {
          setRenamingCard(null);
          focusLater({ card: card.id });
        }}
        onOpen={() => open(card.id)}
        onKeyDown={(event) => cardKey(event, card)}
        onMenu={(event: MouseEvent<HTMLElement>) => {
          event.preventDefault();
          event.stopPropagation();
          openMenu(
            "card",
            card.id,
            { left: event.clientX, top: event.clientY },
            event.currentTarget.querySelector<HTMLElement>(".eh-board-card-title"),
          );
        }}
        onMore={(button) => openMenu("card", card.id, placeBelow(button), button)}
        drag={cardDrag(card)}
      >
        {deletingCard === card.id && (
          <InlineQuestion
            label={t("board.deleteCardNamed", { name: card.title })}
            question={t("board.deleteCardWarning")}
            onEscape={() => keepCard(card.id)}
            actions={
              <>
                <Button autoFocus variant="danger" onClick={() => removeCard(card)}>
                  {t("board.confirmDeleteCard")}
                </Button>
                <Button onClick={() => keepCard(card.id)}>{t("common.cancel")}</Button>
              </>
            }
          />
        )}
      </Item>
    );
  }

  const loose = groups[0]!;
  const hasColumns = value.columns.length > 0;
  const menuCard = menu?.kind === "card" ? cardOf(menu.id) : undefined;
  const menuColumn = menu?.kind === "column" ? columnOf(menu.id) : undefined;
  const moving = movingCard ? cardOf(movingCard) : undefined;
  const groupClass = board ? "eh-board-group eh-board-column" : "eh-board-group";
  const cardsClass = board ? "eh-board-cards" : "eh-board-rows";
  // On the board, "No column" shown only while a card is dragged comes after the columns; with cards it stays
  // first (decision 15, and the owner's decision of 27 October 2026: a card dropped there makes it first).
  const looseAfterColumns = board && hasColumns && draggingCard && loose.cards.length === 0;
  const looseDrop = (
    <section className={groupClass} aria-label={t("board.noColumn")} {...groupDrop(null)}>
      <h3 className="eh-board-group-heading">{t("board.noColumn")}</h3>
      <Notice>{t("board.dropOutside")}</Notice>
    </section>
  );

  return (
    <section
      ref={root}
      className={board ? "eh-board-view eh-board-layout" : "eh-board-view"}
      aria-label={t("board.label")}
    >
      {!readOnly && (
        <div className="eh-board-tools">
          <Button ref={newCardButton} onClick={newCard}>
            {t("board.newCard")}
          </Button>
          <Button ref={newColumnButton} onClick={newColumn}>
            {t("board.newColumn")}
          </Button>
        </div>
      )}
      {!hasColumns && value.cards.length === 0 && <Notice>{t("board.empty")}</Notice>}
      <div className={board ? "eh-board-columns" : "eh-board-groups"}>
        {!looseAfterColumns &&
          (loose.cards.length > 0 || (draggingCard && hasColumns)) &&
          (hasColumns || board ? (
            <section className={groupClass} aria-label={t("board.noColumn")} {...groupDrop(null)}>
              <h3 className="eh-board-group-heading">{t("board.noColumn")}</h3>
              {loose.cards.length > 0 ? (
                <ol className={cardsClass}>{loose.cards.map(cardItem)}</ol>
              ) : (
                <Notice>{t("board.dropOutside")}</Notice>
              )}
            </section>
          ) : (
            <div className={groupClass} {...groupDrop(null)}>
              <ol className={cardsClass}>{loose.cards.map(cardItem)}</ol>
            </div>
          ))}
        {value.columns.map((column, index) => {
          const { cards } = groups[index + 1]!;
          const before = value.columns[index - 1];
          const after = value.columns[index + 1];
          return (
            <section key={column.id} className={groupClass} aria-label={column.name} {...groupDrop(column.id)}>
              <ColumnHeading
                column={column}
                index={index}
                count={cards.length}
                readOnly={readOnly}
                drop={drop !== null && "column" in drop && drop.column === index}
                editRequest={naming?.id === column.id ? naming.request : undefined}
                onRename={(name) => renameColumnTo(column.id, name)}
                onKeyDown={(event) => columnKey(event, column)}
                onMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (readOnly) return;
                  openMenu(
                    "column",
                    column.id,
                    { left: event.clientX, top: event.clientY },
                    event.currentTarget.querySelector<HTMLElement>(".eh-board-more"),
                  );
                }}
                onMore={(button) => openMenu("column", column.id, placeBelow(button), button)}
                drag={columnDrag(column, index)}
              >
                {deletingColumn === column.id && (
                  <InlineQuestion
                    label={t("board.deleteColumnNamed", { name: column.name })}
                    question={t("board.deleteColumnWarning")}
                    onEscape={() => keepColumn(column.id)}
                    actions={
                      <>
                        {before && (
                          <Button onClick={() => removeColumn(column, "before")}>
                            {t("board.moveCardsTo", { name: before.name })}
                          </Button>
                        )}
                        {after && (
                          <Button onClick={() => removeColumn(column, "after")}>
                            {t("board.moveCardsTo", { name: after.name })}
                          </Button>
                        )}
                        {!before && !after && (
                          <Button onClick={() => removeColumn(column, "outside")}>{t("board.moveCardsOutside")}</Button>
                        )}
                        <Button variant="danger" onClick={() => removeColumn(column, "delete")}>
                          {t("board.deleteWithCards")}
                        </Button>
                        <Button autoFocus onClick={() => keepColumn(column.id)}>
                          {t("common.cancel")}
                        </Button>
                      </>
                    }
                  />
                )}
              </ColumnHeading>
              {cards.length > 0 ? (
                <ol className={cardsClass}>{cards.map(cardItem)}</ol>
              ) : (
                <Notice>{t("board.columnEmpty")}</Notice>
              )}
            </section>
          );
        })}
        {looseAfterColumns && looseDrop}
      </div>
      {!readOnly && (hasColumns || value.cards.length > 0) && (
        <Notice>{t(board ? "board.boardHelp" : "board.listHelp")}</Notice>
      )}
      {problem && !dialog && <Notice tone="problem">{t(BOARD_PROBLEM_LABELS[problem])}</Notice>}
      <LiveRegion message={message} />
      {menu && menuCard && (
        <ContextMenu
          label={t("board.cardMenu", { name: menuCard.title })}
          items={cardItems(menuCard.id)}
          place={menu.place}
          onChoose={(action) => chooseCard(action, menuCard.id)}
          onClose={closeMenu}
        />
      )}
      {menu && menuColumn && (
        <ContextMenu
          label={t("board.columnMenu", { name: menuColumn.name })}
          items={columnItems(menuColumn.id)}
          place={menu.place}
          onChoose={(action) => chooseColumn(action, menuColumn.id)}
          onClose={closeMenu}
        />
      )}
      {moving && (
        <MoveToDialog
          itemTitle={moving.title}
          targets={[
            { id: null, title: t("board.noColumn"), depth: 0 },
            ...value.columns.map((column) => ({ id: column.id, title: column.name, depth: 0 })),
          ]}
          current={moving.columnId}
          onMove={(columnId) => {
            setMovingCard(null);
            moveCardTo(moving.id, { columnId, index: Number.MAX_SAFE_INTEGER });
          }}
          onClose={() => {
            setMovingCard(null);
            focusLater({ card: moving.id });
          }}
        />
      )}
      {dialog && (
        <CardDialog
          board={value}
          subject={dialog}
          readOnly={readOnly}
          problem={problem}
          onSave={(card) => saveCard(dialog, card)}
          onDelete={() => removeCard(dialog.card)}
          onClose={closeDialog}
        />
      )}
    </section>
  );
}
