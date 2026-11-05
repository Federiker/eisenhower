/** The board layout, from jerome's plot-board.test.tsx, made generic. */
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import { drag, moveOver, nudge, press, release } from "../pointer";
import { announcement, cardOf, columns, headingOf, layout, NO_LOOSE, renderBoard, t, titleButton } from "./host";

const key = (element: Element, keyName: string, options: { altKey?: boolean; shiftKey?: boolean } = {}) =>
  fireEvent.keyDown(element, { key: keyName, ...options });

describe("the board", () => {
  it("has a column per group, No column first only when it has cards, and a card with its colour named, summary and badge", () => {
    const { view } = renderBoard({ badge: (one) => (one.id === "draft" ? "Drafted" : null) });
    expect(columns(view)).toEqual([t("board.noColumn"), "To do", "Doing", "Done"]);
    const outline = cardOf(view, "Outline");
    // The colour is an inline custom property; read it from the element's style.
    expect(outline.querySelector<HTMLElement>(".eh-board-card-stripe")!.style.background).toBe("var(--eh-colour-1)");
    expect(outline).toHaveTextContent(`OutlineTwo pages at most.${t("common.colour.skyBlue")}`);
    expect(cardOf(view, "Draft")).toHaveTextContent("DraftFirst pass.Drafted");
    expect(cardOf(view, "Review")).toHaveTextContent(/^Review$/);
    expect(within(view).getByRole("region", { name: "Done" })).toHaveTextContent(t("board.columnEmpty"));
    expect(within(view).getByRole("region", { name: "Doing" })).toHaveTextContent(t("board.cards", { count: 2 }));
    // Column names are text on the board.
    expect(within(view).queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      within(within(view).getByRole("region", { name: "To do" })).getByRole("heading", { name: "To do" }),
    ).toBeInTheDocument();
    expect(within(view).getByText(t("board.boardHelp"))).toBeInTheDocument();

    // Moving the loose card away leaves no No column.
    titleButton(view, "Ideas").focus();
    key(titleButton(view, "Ideas"), "ArrowRight", { altKey: true });
    expect(columns(view)).toEqual(["To do", "Doing", "Done"]);
  });

  it("moves the focus with the arrow keys, Home and End, opens a card with Enter, and moves it with Alt and the arrows", () => {
    const { view, board } = renderBoard();
    titleButton(view, "Outline").focus();
    key(document.activeElement!, "ArrowDown");
    expect(titleButton(view, "Sources")).toHaveFocus();
    key(document.activeElement!, "ArrowRight");
    expect(titleButton(view, "Review")).toHaveFocus();
    key(document.activeElement!, "Home");
    expect(titleButton(view, "Draft")).toHaveFocus();
    key(document.activeElement!, "End");
    expect(titleButton(view, "Review")).toHaveFocus();
    key(document.activeElement!, "ArrowUp");
    expect(titleButton(view, "Draft")).toHaveFocus();
    // Done has no cards: the focus stays.
    key(document.activeElement!, "ArrowRight");
    expect(titleButton(view, "Draft")).toHaveFocus();
    key(document.activeElement!, "ArrowLeft");
    key(document.activeElement!, "ArrowLeft");
    expect(titleButton(view, "Ideas")).toHaveFocus();
    key(document.activeElement!, "Enter");
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Ideas");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(titleButton(view, "Ideas")).toHaveFocus();
    expect(titleButton(view, "Ideas")).toHaveAttribute("aria-current", "true");

    titleButton(view, "Outline").focus();
    key(titleButton(view, "Outline"), "ArrowRight", { altKey: true });
    expect(layout(board())[2]).toEqual(["Doing", "Outline", "Draft", "Review"]);
    expect(announcement()).toBe(t("board.movedTo", { name: "Outline", group: "Doing", position: 1, total: 3 }));
    expect(titleButton(view, "Outline")).toHaveFocus();
    key(titleButton(view, "Outline"), "ArrowDown", { altKey: true });
    expect(layout(board())[2]).toEqual(["Doing", "Draft", "Outline", "Review"]);
    expect(titleButton(view, "Outline")).toHaveFocus();
    key(titleButton(view, "Outline"), "ArrowUp", { altKey: true });
    expect(layout(board())[2]).toEqual(["Doing", "Outline", "Draft", "Review"]);
    // The same move twice is announced twice.
    key(titleButton(view, "Outline"), "ArrowDown", { altKey: true });
    key(titleButton(view, "Outline"), "ArrowUp", { altKey: true });
    expect(announcement()).toContain(t("board.movedTo", { name: "Outline", group: "Doing", position: 1, total: 3 }));
    // Nothing above the first card: no change.
    const changes = board();
    key(titleButton(view, "Outline"), "ArrowUp", { altKey: true });
    expect(board()).toBe(changes);
  });

  it("asks on the card before Delete removes it, and has the card's and the column's menus", () => {
    const { view, board } = renderBoard();
    titleButton(view, "Review").focus();
    key(titleButton(view, "Review"), "Delete");
    const question = within(cardOf(view, "Review")).getByRole("alertdialog", {
      name: t("board.deleteCardNamed", { name: "Review" }),
    });
    expect(question).toHaveTextContent(t("board.deleteCardWarning"));
    fireEvent.click(within(question).getByRole("button", { name: t("board.confirmDeleteCard") }));
    expect(layout(board())[2]).toEqual(["Doing", "Draft"]);
    expect(titleButton(view, "Draft")).toHaveFocus();

    fireEvent.click(within(view).getByRole("button", { name: t("board.moreActionsNamed", { name: "Draft" }) }));
    const menu = screen.getByRole("menu", { name: t("board.cardMenu", { name: "Draft" }) });
    fireEvent.click(within(menu).getByRole("menuitem", { name: t("board.moveToColumn") }));
    const dialog = screen.getByRole("dialog", { name: t("common.moveTitleNamed", { name: "Draft" }) });
    fireEvent.click(within(dialog).getByRole("radio", { name: "Done" }));
    fireEvent.click(within(dialog).getByRole("button", { name: t("common.moveConfirm") }));
    expect(layout(board())[3]).toEqual(["Done", "Draft"]);
    expect(titleButton(view, "Draft")).toHaveFocus();

    fireEvent.contextMenu(cardOf(view, "Outline"));
    fireEvent.click(
      within(screen.getByRole("menu", { name: t("board.cardMenu", { name: "Outline" }) })).getByRole("menuitem", {
        name: t("board.open"),
      }),
    );
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Outline");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    // A column's name reads as text; its pencil makes it a field, and Enter saves it.
    fireEvent.click(within(view).getByRole("button", { name: t("board.editColumn", { name: "Doing" }) }));
    const field = within(view).getByRole("textbox", { name: t("board.columnName", { number: 2 }) });
    expect(field).toHaveFocus();
    fireEvent.change(field, { target: { value: "Underway" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(board().columns[1]!.name).toBe("Underway");

    fireEvent.click(within(view).getByRole("button", { name: t("board.moreActionsNamed", { name: "Underway" }) }));
    const columnMenu = screen.getByRole("menu", { name: t("board.columnMenu", { name: "Underway" }) });
    expect(
      within(columnMenu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([t("common.rename"), t("board.moveLeft"), t("board.moveRight"), t("board.deleteColumn")]);
    fireEvent.click(within(columnMenu).getByRole("menuitem", { name: t("board.moveLeft") }));
    expect(board().columns.map((column) => column.name)).toEqual(["Underway", "To do", "Done"]);
    expect(columns(view)).toEqual([t("board.noColumn"), "Underway", "To do", "Done"]);
    expect(announcement()).toBe(t("board.columnMovedTo", { name: "Underway", position: 1, total: 3 }));
    expect(within(view).getByRole("button", { name: t("board.moreActionsNamed", { name: "Underway" }) })).toHaveFocus();
  });

  it("moves a card dragged onto a card or onto a column, and a column dragged onto another", () => {
    const { view, board } = renderBoard();
    drag(cardOf(view, "Ideas"), cardOf(view, "Review"));
    expect(layout(board())).toEqual([
      ["-"],
      ["To do", "Outline", "Sources"],
      ["Doing", "Draft", "Ideas", "Review"],
      ["Done"],
    ]);
    expect(announcement()).toBe(t("board.movedTo", { name: "Ideas", group: "Doing", position: 2, total: 3 }));
    expect(columns(view)).toEqual(["To do", "Doing", "Done"]);
    drag(cardOf(view, "Outline"), within(view).getByRole("region", { name: "Done" }));
    expect(layout(board())[3]).toEqual(["Done", "Outline"]);
    // Dropped on itself, a card stays.
    const before = board();
    drag(cardOf(view, "Outline"), cardOf(view, "Outline"));
    expect(board()).toBe(before);

    drag(headingOf(view, "Done"), headingOf(view, "To do"));
    expect(board().columns.map((column) => column.name)).toEqual(["Done", "To do", "Doing"]);
    expect(announcement()).toBe(t("board.columnMovedTo", { name: "Done", position: 1, total: 3 }));
    expect(within(view).getByRole("button", { name: t("board.moreActionsNamed", { name: "Done" }) })).toHaveFocus();
    // A column is not dragged from its name's field, where a drag chooses text.
    fireEvent.click(within(view).getByRole("button", { name: t("board.editColumn", { name: "Done" }) }));
    const field = within(view).getByRole("textbox", { name: t("board.columnName", { number: 1 }) });
    const moved = board();
    press(field);
    moveOver(field, headingOf(view, "Doing"));
    expect(headingOf(view, "Doing")).not.toHaveAttribute("data-drop");
    release(field);
    expect(board()).toBe(moved);
  });

  it("draws where a dragged card or column would go, and drops nothing where nothing takes it", () => {
    const { view, onChange } = renderBoard();
    const ideas = cardOf(view, "Ideas");
    press(ideas);
    moveOver(ideas, titleButton(view, "Review"));
    // A line above the card it would go before; the card dragged is drawn faint.
    expect(cardOf(view, "Review")).toHaveAttribute("data-drop", "before");
    expect(ideas).toHaveAttribute("data-moving", "true");
    expect(view).toHaveAttribute("data-dragging", "true");
    // A border round the column it would go to the end of.
    const done = within(view).getByRole("region", { name: "Done" });
    moveOver(ideas, within(done).getByText(t("board.columnEmpty")));
    expect(cardOf(view, "Review")).not.toHaveAttribute("data-drop");
    expect(done).toHaveAttribute("data-drop", "inside");
    // Over a column's heading, the card would go to the column's end too.
    moveOver(ideas, headingOf(view, "Doing"));
    expect(within(view).getByRole("region", { name: "Doing" })).toHaveAttribute("data-drop", "inside");
    // Over itself, over nothing or outside the board, it would go nowhere.
    for (const place of [ideas, null, document.body]) {
      moveOver(ideas, place);
      expect(view.querySelectorAll("[data-drop]")).toHaveLength(0);
    }
    release(ideas);
    expect(onChange).not.toHaveBeenCalled();
    expect(view).not.toHaveAttribute("data-dragging");
    expect(ideas).not.toHaveAttribute("data-moving");

    // A column's heading is drawn with its line above it, and the column dragged faint.
    const heading = headingOf(view, "Done");
    press(heading);
    moveOver(heading, within(headingOf(view, "Doing")).getByRole("heading", { name: "Doing" }));
    expect(headingOf(view, "Doing")).toHaveAttribute("data-drop", "before");
    expect(heading).toHaveAttribute("data-moving", "true");
    // Not over a card, a column's cards or its own heading.
    for (const place of [cardOf(view, "Draft"), within(view).getByRole("region", { name: "Doing" }), heading]) {
      moveOver(heading, place);
      expect(view.querySelectorAll("[data-drop]")).toHaveLength(0);
    }
    release(heading);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("cancels a drag with Escape, keeps a press without a move a click, and makes nothing of the click after a drag", () => {
    const opened: string[] = [];
    const { view, onChange } = renderBoard({ onOpenCard: (id) => opened.push(id) });
    const review = titleButton(view, "Review");
    press(review);
    moveOver(review, cardOf(view, "Outline"));
    expect(cardOf(view, "Outline")).toHaveAttribute("data-drop", "before");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(cardOf(view, "Outline")).not.toHaveAttribute("data-drop");
    // The pointer moved on and let go after Escape drops nothing, and its click opens nothing.
    moveOver(review, cardOf(view, "Outline"));
    expect(cardOf(view, "Outline")).not.toHaveAttribute("data-drop");
    release(review);
    fireEvent.click(review);
    expect(onChange).not.toHaveBeenCalled();
    expect(opened).toEqual([]);

    // Dropped, the card moves, and the click on its title as the pointer is let go does not open it.
    press(review);
    moveOver(review, cardOf(view, "Outline"));
    release(review);
    fireEvent.click(titleButton(view, "Review"));
    expect(opened).toEqual([]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(titleButton(view, "Review")).toHaveFocus();

    // Less than 4 pixels is a click: it opens the card and moves nothing.
    nudge(titleButton(view, "Draft"));
    fireEvent.click(titleButton(view, "Draft"));
    expect(opened).toEqual(["draft"]);
    expect(onChange).toHaveBeenCalledTimes(1);

    // A lost pointer ends the drag, dropping nothing.
    const draft = cardOf(view, "Draft");
    press(draft);
    moveOver(draft, cardOf(view, "Sources"));
    fireEvent.pointerCancel(draft, { pointerId: 1 });
    expect(cardOf(view, "Sources")).not.toHaveAttribute("data-drop");
    release(draft);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("drags nothing with another button or another pointer, or from the question asked on a card", () => {
    const { view, onChange } = renderBoard();
    const ideas = cardOf(view, "Ideas");
    press(ideas, { button: 2 });
    moveOver(ideas, cardOf(view, "Review"));
    release(ideas);
    // Only the pointer that pressed moves the drag, and lets it go.
    press(ideas);
    fireEvent.pointerMove(ideas, { clientX: 40, clientY: 60, pointerId: 2 });
    fireEvent.pointerUp(ideas, { pointerId: 2 });
    expect(view.querySelectorAll("[data-drop]")).toHaveLength(0);
    release(ideas);
    // Not from the question asked before a card is deleted.
    fireEvent.keyDown(titleButton(view, "Ideas"), { key: "Delete" });
    const question = within(view).getByRole("alertdialog");
    drag(within(question).getByRole("button", { name: t("common.cancel") }), cardOf(view, "Review"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not drag on a read-only board", () => {
    const { view, onChange } = renderBoard({ readOnly: true });
    const ideas = cardOf(view, "Ideas");
    press(ideas);
    moveOver(ideas, cardOf(view, "Review"));
    expect(cardOf(view, "Review")).not.toHaveAttribute("data-drop");
    expect(view).not.toHaveAttribute("data-dragging");
    release(ideas);
    drag(headingOf(view, "Done"), headingOf(view, "To do"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("offers New card and New column, naming the new column in place", async () => {
    const { view, board } = renderBoard({ initial: NO_LOOSE });
    fireEvent.click(within(view).getByRole("button", { name: t("board.newColumn") }));
    expect(board().columns.map((column) => column.name)).toEqual(["To do", "Doing", "Done", "New column"]);
    const field = within(view).getByRole("textbox", { name: t("board.columnName", { number: 4 }) }) as HTMLInputElement;
    expect(field).toHaveFocus();
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, "New column".length]);
    fireEvent.change(field, { target: { value: "Later" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(board().columns[3]!.name).toBe("Later");
    await waitFor(() => expect(within(view).queryByRole("textbox")).not.toBeInTheDocument());
    fireEvent.click(within(view).getByRole("button", { name: t("board.newColumn") }));
    expect(board().columns[4]!.name).toBe("New column");
    fireEvent.keyDown(within(view).getByRole("textbox"), { key: "Escape" });

    // A new card goes at the end of the last column, named New card in its dialog.
    fireEvent.click(within(view).getByRole("button", { name: t("board.newCard") }));
    const dialog = screen.getByRole("dialog", { name: t("board.newCard") });
    expect(within(dialog).getByLabelText(t("board.card.title"))).toHaveValue("New card");
    fireEvent.change(within(dialog).getByLabelText(t("board.card.title")), { target: { value: "Last" } });
    fireEvent.submit(dialog);
    expect(layout(board())[5]).toEqual(["New column", "Last"]);
    expect(titleButton(view, "Last")).toHaveFocus();
  });
});
