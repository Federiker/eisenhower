/**
 * The "No column" column (decision 15 and the owner's note after decision 18): first when it has cards; while
 * a card is dragged and it has none, offered after the other columns on the board (first in the list); a card
 * dropped there makes it first. jerome's 6cece75, checked case by case.
 */
import { fireEvent, screen, within } from "@testing-library/react";

import { drag, moveOver, nudge, press, release } from "../pointer";
import { BOARD, card, cardOf, columns, groups, headingOf, layout, NO_LOOSE, renderBoard, t, titleButton } from "./host";

const NO_COLUMN = t("board.noColumn");
const noColumns = (view: HTMLElement) => within(view).queryAllByRole("region", { name: NO_COLUMN });

describe("the No column column on the board", () => {
  it("is offered after the columns while a card is dragged, and once dropped there it is first (jerome 6cece75)", () => {
    const { view, board } = renderBoard();
    // Moving the only loose card away leaves no No column.
    drag(cardOf(view, "Ideas"), cardOf(view, "Draft"));
    expect(layout(board())[0]).toEqual(["-"]);
    expect(columns(view)).toEqual(["To do", "Doing", "Done"]);

    const review = cardOf(view, "Review");
    press(review);
    moveOver(review, null);
    const outside = within(view).getByRole("region", { name: NO_COLUMN });
    expect(outside).toHaveClass("eh-board-column");
    expect(outside).toHaveTextContent(t("board.dropOutside"));
    expect(columns(view)).toEqual(["To do", "Doing", "Done", NO_COLUMN]);
    moveOver(review, within(outside).getByText(t("board.dropOutside")));
    expect(outside).toHaveAttribute("data-drop", "inside");
    release(review);
    expect(layout(board())[0]).toEqual(["-", "Review"]);
    expect(columns(view)).toEqual([NO_COLUMN, "To do", "Doing", "Done"]);
    expect(noColumns(view)).toHaveLength(1);
    expect(titleButton(view, "Review")).toHaveFocus();
  });

  it("stays first while its only card is the one dragged, and goes once that card is dropped elsewhere", () => {
    const { view, board } = renderBoard();
    expect(columns(view)).toEqual([NO_COLUMN, "To do", "Doing", "Done"]);
    const ideas = cardOf(view, "Ideas");
    press(ideas);
    moveOver(ideas, null);
    expect(columns(view)).toEqual([NO_COLUMN, "To do", "Doing", "Done"]);
    expect(noColumns(view)).toHaveLength(1);
    // The card is still in it, not a notice to drop one there.
    expect(within(noColumns(view)[0]!).queryByText(t("board.dropOutside"))).not.toBeInTheDocument();
    moveOver(ideas, within(view).getByRole("region", { name: "Done" }));
    release(ideas);
    expect(layout(board())[3]).toEqual(["Done", "Ideas"]);
    expect(columns(view)).toEqual(["To do", "Doing", "Done"]);
  });

  it("is the only column of a board without columns, first, and not offered twice while a card is dragged", () => {
    const { view } = renderBoard({
      initial: { columns: [], cards: [card("a", "Alpha", null), card("b", "Beta", null)] },
    });
    expect(columns(view)).toEqual([NO_COLUMN]);
    expect(within(noColumns(view)[0]!).getByRole("heading", { name: NO_COLUMN })).toBeInTheDocument();
    const alpha = cardOf(view, "Alpha");
    press(alpha);
    moveOver(alpha, null);
    expect(columns(view)).toEqual([NO_COLUMN]);
    release(alpha);
    expect(columns(view)).toEqual([NO_COLUMN]);
  });

  it("is not there on an empty board, which says so", () => {
    const { view } = renderBoard({ initial: { columns: [], cards: [] } });
    expect(columns(view)).toEqual([]);
    expect(within(view).getByText(t("board.empty"))).toBeInTheDocument();
  });

  it("is not offered while a column is dragged", () => {
    const { view, board } = renderBoard({ initial: NO_LOOSE });
    const heading = headingOf(view, "Done");
    press(heading);
    moveOver(heading, null);
    expect(noColumns(view)).toHaveLength(0);
    // A dragged column is not taken by a column's card area either.
    const doing = within(view).getByRole("region", { name: "Doing" });
    moveOver(heading, doing);
    expect(doing).not.toHaveAttribute("data-drop");
    const target = headingOf(view, "To do");
    moveOver(heading, target);
    expect(target).toHaveAttribute("data-drop", "before");
    release(heading);
    expect(board().columns.map((column) => column.name)).toEqual(["Done", "To do", "Doing"]);
    expect(noColumns(view)).toHaveLength(0);
  });

  it("goes when the drag ends without a drop (the pointer let go elsewhere, or Escape), changing nothing", () => {
    const { view, onChange } = renderBoard({ initial: NO_LOOSE });
    const review = cardOf(view, "Review");
    press(review);
    moveOver(review, null);
    const outside = within(view).getByRole("region", { name: NO_COLUMN });
    moveOver(review, outside);
    moveOver(review, document.body);
    expect(outside).not.toHaveAttribute("data-drop");
    release(review);
    expect(noColumns(view)).toHaveLength(0);
    expect(columns(view)).toEqual(["To do", "Doing", "Done"]);

    press(review);
    moveOver(review, null);
    moveOver(review, within(view).getByRole("region", { name: NO_COLUMN }));
    expect(within(view).getByRole("region", { name: NO_COLUMN })).toHaveAttribute("data-drop", "inside");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(noColumns(view)).toHaveLength(0);
    release(review);
    expect(columns(view)).toEqual(["To do", "Doing", "Done"]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("is shown only once the press has become a drag, and not at all for a click", () => {
    const { view } = renderBoard({ initial: NO_LOOSE });
    const review = cardOf(view, "Review");
    press(review);
    // Less than 4 pixels is not yet a drag.
    fireEvent.pointerMove(review, { clientX: 12, clientY: 13, pointerId: 1 });
    expect(noColumns(view)).toHaveLength(0);
    moveOver(review, null);
    expect(columns(view)).toEqual(["To do", "Doing", "Done", NO_COLUMN]);
    release(review);
    expect(noColumns(view)).toHaveLength(0);

    nudge(review);
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

  it("is never offered to a read-only board, whose cards are not dragged", () => {
    const { view } = renderBoard({ initial: NO_LOOSE, readOnly: true });
    const review = cardOf(view, "Review");
    press(review);
    moveOver(review, null);
    expect(noColumns(view)).toHaveLength(0);
    release(review);
  });
});

describe("the No column group in the list", () => {
  it("is offered first while a card is dragged, and keeps its place once it has the card", () => {
    const { view, board } = renderBoard({ initial: NO_LOOSE, layout: "list" });
    expect(groups(view)).toEqual(["To do", "Doing", "Done"]);
    const review = cardOf(view, "Review");
    press(review);
    moveOver(review, null);
    const outside = within(view).getByRole("region", { name: NO_COLUMN });
    expect(outside).not.toHaveClass("eh-board-column");
    expect(groups(view)).toEqual([NO_COLUMN, "To do", "Doing", "Done"]);
    moveOver(review, outside);
    release(review);
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
