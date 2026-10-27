/**
 * The "No column" column (decision 15 and the owner's note after decision 18): first when it has cards; while
 * a card is dragged and it has none, offered after the other columns on the board (first in the list); a card
 * dropped there makes it first. jerome's 6cece75, checked case by case.
 */
import { act, fireEvent, screen, within } from "@testing-library/react";

import {
  BOARD,
  card,
  cardOf,
  columns,
  drag,
  groups,
  layout,
  NO_LOOSE,
  renderBoard,
  t,
  tick,
  titleButton,
  transfer,
} from "./host";

const NO_COLUMN = t("board.noColumn");
const noColumns = (view: HTMLElement) => within(view).queryAllByRole("region", { name: NO_COLUMN });

describe("the No column column on the board", () => {
  it("is offered after the columns while a card is dragged, and once dropped there it is first (jerome 6cece75)", async () => {
    const { view, board } = renderBoard();
    // Moving the only loose card away leaves no No column.
    drag(cardOf(view, "Ideas"), cardOf(view, "Draft"));
    expect(layout(board())[0]).toEqual(["-"]);
    expect(columns(view)).toEqual(["To do", "Doing", "Done"]);

    const dataTransfer = transfer();
    fireEvent.dragStart(cardOf(view, "Review"), { dataTransfer });
    const outside = await within(view).findByRole("region", { name: NO_COLUMN });
    expect(outside).toHaveClass("eh-board-column");
    expect(outside).toHaveTextContent(t("board.dropOutside"));
    expect(columns(view)).toEqual(["To do", "Doing", "Done", NO_COLUMN]);
    fireEvent.dragOver(outside, { dataTransfer });
    expect(outside).toHaveAttribute("data-drop", "inside");
    fireEvent.drop(outside, { dataTransfer });
    expect(layout(board())[0]).toEqual(["-", "Review"]);
    expect(columns(view)).toEqual([NO_COLUMN, "To do", "Doing", "Done"]);
    expect(noColumns(view)).toHaveLength(1);
  });

  it("stays first while its only card is the one dragged, and goes once that card is dropped elsewhere", async () => {
    const { view, board } = renderBoard();
    expect(columns(view)).toEqual([NO_COLUMN, "To do", "Doing", "Done"]);
    const dataTransfer = transfer();
    const ideas = cardOf(view, "Ideas");
    fireEvent.dragStart(ideas, { dataTransfer });
    await act(tick);
    expect(columns(view)).toEqual([NO_COLUMN, "To do", "Doing", "Done"]);
    expect(noColumns(view)).toHaveLength(1);
    // The card is still in it, not a notice to drop one there.
    expect(within(noColumns(view)[0]!).queryByText(t("board.dropOutside"))).not.toBeInTheDocument();
    const done = within(view).getByRole("region", { name: "Done" });
    fireEvent.dragOver(done, { dataTransfer });
    fireEvent.drop(done, { dataTransfer });
    fireEvent.dragEnd(ideas, { dataTransfer });
    expect(layout(board())[3]).toEqual(["Done", "Ideas"]);
    expect(columns(view)).toEqual(["To do", "Doing", "Done"]);
  });

  it("is the only column of a board without columns, first, and not offered twice while a card is dragged", async () => {
    const { view } = renderBoard({
      initial: { columns: [], cards: [card("a", "Alpha", null), card("b", "Beta", null)] },
    });
    expect(columns(view)).toEqual([NO_COLUMN]);
    expect(within(noColumns(view)[0]!).getByRole("heading", { name: NO_COLUMN })).toBeInTheDocument();
    fireEvent.dragStart(cardOf(view, "Alpha"), { dataTransfer: transfer() });
    await act(tick);
    expect(columns(view)).toEqual([NO_COLUMN]);
    fireEvent.dragEnd(cardOf(view, "Alpha"));
    expect(columns(view)).toEqual([NO_COLUMN]);
  });

  it("is not there on an empty board, which says so", () => {
    const { view } = renderBoard({ initial: { columns: [], cards: [] } });
    expect(columns(view)).toEqual([]);
    expect(within(view).getByText(t("board.empty"))).toBeInTheDocument();
  });

  it("is not offered while a column is dragged", async () => {
    const { view, board } = renderBoard({ initial: NO_LOOSE });
    const heading = within(view).getByRole("region", { name: "Done" }).querySelector(".eh-board-column-heading")!;
    const dataTransfer = transfer();
    fireEvent.dragStart(heading, { dataTransfer });
    await act(tick);
    expect(noColumns(view)).toHaveLength(0);
    // A dragged column is not taken by a column's card area either.
    const doing = within(view).getByRole("region", { name: "Doing" });
    fireEvent.dragOver(doing, { dataTransfer });
    expect(doing).not.toHaveAttribute("data-drop");
    const target = within(view).getByRole("region", { name: "To do" }).querySelector(".eh-board-column-heading")!;
    fireEvent.dragOver(target, { dataTransfer });
    expect(target).toHaveAttribute("data-drop", "before");
    fireEvent.drop(target, { dataTransfer });
    fireEvent.dragEnd(heading, { dataTransfer });
    expect(board().columns.map((column) => column.name)).toEqual(["Done", "To do", "Doing"]);
    expect(noColumns(view)).toHaveLength(0);
  });

  it("goes when the drag ends without a drop (the pointer let go elsewhere, or Escape), changing nothing", async () => {
    const { view, onChange } = renderBoard({ initial: NO_LOOSE });
    const review = cardOf(view, "Review");
    const dataTransfer = transfer();
    fireEvent.dragStart(review, { dataTransfer });
    const outside = await within(view).findByRole("region", { name: NO_COLUMN });
    fireEvent.dragOver(outside, { dataTransfer });
    fireEvent.dragLeave(outside, { dataTransfer });
    expect(outside).not.toHaveAttribute("data-drop");
    // A browser ends a drag cancelled with Escape, or let go outside any target, with dragend alone.
    fireEvent.dragEnd(review, { dataTransfer });
    expect(noColumns(view)).toHaveLength(0);
    expect(columns(view)).toEqual(["To do", "Doing", "Done"]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("is shown only once the drag has begun, and not at all when it ended first", async () => {
    const { view } = renderBoard({ initial: NO_LOOSE });
    const review = cardOf(view, "Review");
    fireEvent.dragStart(review, { dataTransfer: transfer() });
    // Not in the dragstart itself: changing the page while a drag starts would end it.
    expect(noColumns(view)).toHaveLength(0);
    await act(tick);
    expect(columns(view)).toEqual(["To do", "Doing", "Done", NO_COLUMN]);
    fireEvent.dragEnd(review);

    fireEvent.dragStart(review, { dataTransfer: transfer() });
    fireEvent.dragEnd(review);
    await act(tick);
    expect(noColumns(view)).toHaveLength(0);
  });

  it("takes a card moved with Alt+Left from the first column, and is then first, the focus staying on the card", () => {
    const { view, board } = renderBoard({ initial: NO_LOOSE });
    titleButton(view, "Outline").focus();
    fireEvent.keyDown(titleButton(view, "Outline"), { key: "ArrowLeft", altKey: true });
    expect(layout(board())[0]).toEqual(["-", "Outline"]);
    expect(columns(view)).toEqual([NO_COLUMN, "To do", "Doing", "Done"]);
    expect(titleButton(view, "Outline")).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(
      t("board.movedTo", { name: "Outline", group: NO_COLUMN, position: 1, total: 1 }),
    );
    // Nothing is before it: Alt+Left there changes nothing.
    fireEvent.keyDown(titleButton(view, "Outline"), { key: "ArrowLeft", altKey: true });
    expect(layout(board())[0]).toEqual(["-", "Outline"]);
    // Alt+Right takes it back to the start of the first column, and No column goes.
    fireEvent.keyDown(titleButton(view, "Outline"), { key: "ArrowRight", altKey: true });
    expect(layout(board())[1]).toEqual(["To do", "Outline", "Ideas", "Sources"]);
    expect(columns(view)).toEqual(["To do", "Doing", "Done"]);
  });

  it("is never offered to a read-only board, whose cards are not draggable", () => {
    const { view } = renderBoard({ initial: NO_LOOSE, readOnly: true });
    expect(cardOf(view, "Review")).toHaveAttribute("draggable", "false");
  });
});

describe("the No column group in the list", () => {
  it("is offered first while a card is dragged, and keeps its place once it has the card", async () => {
    const { view, board } = renderBoard({ initial: NO_LOOSE, layout: "list" });
    expect(groups(view)).toEqual(["To do", "Doing", "Done"]);
    const dataTransfer = transfer();
    fireEvent.dragStart(cardOf(view, "Review"), { dataTransfer });
    const outside = await within(view).findByRole("region", { name: NO_COLUMN });
    expect(outside).not.toHaveClass("eh-board-column");
    expect(groups(view)).toEqual([NO_COLUMN, "To do", "Doing", "Done"]);
    fireEvent.dragOver(outside, { dataTransfer });
    fireEvent.drop(outside, { dataTransfer });
    expect(layout(board())[0]).toEqual(["-", "Review"]);
    expect(groups(view)).toEqual([NO_COLUMN, "To do", "Doing", "Done"]);
  });

  it("is an unnamed group in a board without columns", () => {
    const { view } = renderBoard({ initial: { columns: [], cards: BOARD.cards.slice(0, 1) }, layout: "list" });
    expect(groups(view)).toEqual([""]);
    expect(within(view).queryByRole("region", { name: NO_COLUMN })).not.toBeInTheDocument();
    expect(within(view).getAllByRole("listitem")).toHaveLength(1);
  });
});
