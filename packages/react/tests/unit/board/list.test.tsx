/** The list layout, columns and cards, from jerome's plot-list.test.tsx, made generic. */
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import { announcement, BOARD, cardOf, groups, layout, renderBoard, t, titleButton } from "./host";

const key = (element: Element, keyName: string, options: { altKey?: boolean; shiftKey?: boolean } = {}) =>
  fireEvent.keyDown(element, { key: keyName, ...options });
const more = (view: HTMLElement, name: string) =>
  within(view).getByRole("button", { name: t("board.moreActionsNamed", { name }) });
const menuTexts = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole("menuitem")
    .map((item) => item.textContent);
const dialog = () => screen.getByRole("dialog");
const field = (label: string) => within(dialog()).getByLabelText(label);

function columnMenu(view: HTMLElement, name: string) {
  fireEvent.click(more(view, name));
  return screen.getByRole("menu", { name: t("board.columnMenu", { name }) });
}

function deleteColumn(view: HTMLElement, name: string) {
  fireEvent.click(within(columnMenu(view, name)).getByRole("menuitem", { name: t("board.deleteColumn") }));
  return within(view).getByRole("alertdialog", { name: t("board.deleteColumnNamed", { name }) });
}

describe("a board's columns", () => {
  it("are reordered with Alt and the arrows on their heading and from their menu, renamed with F2, and refused a blank name", async () => {
    const { view, board } = renderBoard({ layout: "list" });
    expect(groups(view)).toEqual([t("board.noColumn"), "To do", "Doing", "Done"]);
    const menu = columnMenu(view, "To do");
    expect(menuTexts(menu)).toEqual([
      t("common.rename"),
      t("common.moveUp"),
      t("common.moveDown"),
      t("board.deleteColumn"),
    ]);
    expect(within(menu).getByRole("menuitem", { name: t("common.moveUp") })).toBeDisabled();
    fireEvent.click(within(menu).getByRole("menuitem", { name: t("common.moveDown") }));
    expect(board().columns.map((column) => column.name)).toEqual(["Doing", "To do", "Done"]);
    expect(more(view, "To do")).toHaveFocus();

    key(more(view, "To do"), "ArrowDown", { altKey: true });
    expect(board().columns.map((column) => column.name)).toEqual(["Doing", "Done", "To do"]);
    expect(more(view, "To do")).toHaveFocus();
    key(more(view, "To do"), "ArrowLeft", { altKey: true });
    key(more(view, "To do"), "ArrowUp", { altKey: true });
    expect(board().columns.map((column) => column.name)).toEqual(["To do", "Doing", "Done"]);
    // Nothing before the first: no change.
    const before = board();
    key(more(view, "To do"), "ArrowUp", { altKey: true });
    key(more(view, "Done"), "ArrowRight", { altKey: true });
    expect(board()).toBe(before);

    // F2 on the heading opens the name; a blank name is refused in the field, and Escape puts it back.
    key(more(view, "Doing"), "F2");
    const name = within(view).getByRole("textbox", { name: t("board.columnName", { number: 2 }) });
    expect(name).toHaveFocus();
    fireEvent.change(name, { target: { value: "  " } });
    fireEvent.keyDown(name, { key: "Enter" });
    expect(await within(view).findByText(t("board.problem.blank"))).toHaveAttribute("role", "alert");
    fireEvent.keyDown(name, { key: "Escape" });
    expect(within(view).queryByRole("textbox")).not.toBeInTheDocument();
    expect(board().columns[1]!.name).toBe("Doing");

    // Rename in its menu, too; and Shift+F10 on the heading opens the menu.
    fireEvent.click(within(columnMenu(view, "Done")).getByRole("menuitem", { name: t("common.rename") }));
    expect(within(view).getByRole("textbox", { name: t("board.columnName", { number: 3 }) })).toHaveFocus();
    fireEvent.keyDown(within(view).getByRole("textbox"), { key: "Escape" });
    await waitFor(() => expect(within(view).queryByRole("textbox")).not.toBeInTheDocument());
    key(more(view, "Done"), "F10", { shiftKey: true });
    expect(screen.getByRole("menu", { name: t("board.columnMenu", { name: "Done" }) })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("menuitem", { name: t("common.rename") }), { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(more(view, "Done")).toHaveFocus();
    fireEvent.contextMenu(
      within(view).getByRole("region", { name: "Done" }).querySelector(".eh-board-column-heading")!,
    );
    expect(screen.getByRole("menu", { name: t("board.columnMenu", { name: "Done" }) })).toBeInTheDocument();
  });

  it("are deleted at once when empty, and otherwise ask where the cards go: before, after, outside or with it", () => {
    const { view, board } = renderBoard({ layout: "list" });
    // The Delete key on an empty column's heading deletes it at once; the focus goes to the column before.
    key(more(view, "Done"), "Delete");
    expect(board().columns.map((column) => column.name)).toEqual(["To do", "Doing"]);
    expect(more(view, "Doing")).toHaveFocus();

    key(more(view, "Doing"), "Delete");
    let question = within(view).getByRole("alertdialog", { name: t("board.deleteColumnNamed", { name: "Doing" }) });
    expect(question).toHaveTextContent(t("board.deleteColumnWarning"));
    expect(
      within(question)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual([t("board.moveCardsTo", { name: "To do" }), t("board.deleteWithCards"), t("common.cancel")]);
    // Escape, or Cancel, keeps it and goes back to its heading.
    fireEvent.keyDown(within(question).getByRole("button", { name: t("common.cancel") }), { key: "Escape" });
    expect(within(view).queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(more(view, "Doing")).toHaveFocus();
    question = deleteColumn(view, "Doing");
    fireEvent.click(within(question).getByRole("button", { name: t("common.cancel") }));
    expect(board().columns).toHaveLength(2);

    question = deleteColumn(view, "To do");
    fireEvent.click(within(question).getByRole("button", { name: t("board.moveCardsTo", { name: "Doing" }) }));
    expect(layout(board())).toEqual([
      ["-", "Ideas"],
      ["Doing", "Outline", "Sources", "Draft", "Review"],
    ]);
    expect(more(view, "Doing")).toHaveFocus();

    question = deleteColumn(view, "Doing");
    expect(
      within(question)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual([t("board.moveCardsOutside"), t("board.deleteWithCards"), t("common.cancel")]);
    fireEvent.click(within(question).getByRole("button", { name: t("board.moveCardsOutside") }));
    expect(layout(board())).toEqual([["-", "Ideas", "Outline", "Sources", "Draft", "Review"]]);
    expect(within(view).getByRole("button", { name: t("board.newColumn") })).toHaveFocus();
    // Without columns, the cards are a plain list.
    expect(within(view).queryByRole("region", { name: t("board.noColumn") })).not.toBeInTheDocument();
    expect(within(view).getAllByRole("listitem")).toHaveLength(5);
  });

  it("take their cards with them when deleted so, or give them to the column after", () => {
    const { view, board } = renderBoard({ layout: "list" });
    fireEvent.click(within(deleteColumn(view, "Doing")).getByRole("button", { name: t("board.deleteWithCards") }));
    expect(layout(board())).toEqual([["-", "Ideas"], ["To do", "Outline", "Sources"], ["Done"]]);
    fireEvent.click(
      within(deleteColumn(view, "To do")).getByRole("button", { name: t("board.moveCardsTo", { name: "Done" }) }),
    );
    expect(layout(board())).toEqual([
      ["-", "Ideas"],
      ["Done", "Outline", "Sources"],
    ]);
  });
});

describe("a board's cards", () => {
  it("are listed with their colour named, summary and badge, and open in a dialog by a click, Enter, a double-click or Open in their menu", () => {
    const { view, onChange } = renderBoard({ layout: "list", badge: () => "Due" });
    expect(cardOf(view, "Outline")).toHaveTextContent(`${t("common.colour.skyBlue")}OutlineTwo pages at most.Due`);
    expect(within(view).getByText(t("board.listHelp"))).toBeInTheDocument();

    fireEvent.click(titleButton(view, "Draft"));
    expect(dialog()).toHaveAttribute("aria-modal", "true");
    expect(dialog()).toHaveAccessibleName("Draft");
    expect(field(t("board.card.title"))).toHaveFocus();
    expect(field(t("board.card.title"))).toHaveValue("Draft");
    expect(field(t("board.card.summary"))).toHaveValue("First pass.");
    expect(field(t("board.card.column"))).toHaveValue("doing");
    expect(field(t("board.card.colour"))).toHaveValue("");
    // Unchanged, Cancel closes at once and the focus goes back to the card.
    fireEvent.click(within(dialog()).getByRole("button", { name: t("common.cancel") }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(titleButton(view, "Draft")).toHaveFocus();
    // Save unchanged closes too, changing nothing.
    fireEvent.click(titleButton(view, "Draft"));
    fireEvent.click(within(dialog()).getByRole("button", { name: t("common.save") }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.doubleClick(cardOf(view, "Review").querySelector(".eh-board-row-details")!);
    expect(dialog()).toHaveAccessibleName("Review");
    fireEvent.keyDown(dialog(), { key: "Escape" });
    // A double-click on the card's menu button does not open it.
    fireEvent.doubleClick(more(view, "Review"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.contextMenu(cardOf(view, "Ideas"));
    fireEvent.click(
      within(screen.getByRole("menu", { name: t("board.cardMenu", { name: "Ideas" }) })).getByRole("menuitem", {
        name: t("board.open"),
      }),
    );
    expect(dialog()).toHaveAccessibleName("Ideas");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keep the dialog's changes on Save, with the values as stored, then close it with the focus on the card", () => {
    const { view, board } = renderBoard({ layout: "list" });
    fireEvent.click(titleButton(view, "Draft"));
    fireEvent.change(field(t("board.card.summary")), { target: { value: " Everything turns. " } });
    fireEvent.change(field(t("board.card.column")), { target: { value: "todo" } });
    fireEvent.change(field(t("board.card.colour")), { target: { value: "5" } });
    expect(dialog().querySelector<HTMLElement>(".eh-board-swatch")!.style.background).toBe("var(--eh-colour-5)");
    fireEvent.click(within(dialog()).getByRole("button", { name: t("common.save") }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(board().cards.find((one) => one.id === "draft")).toEqual({
      id: "draft",
      title: "Draft",
      columnId: "todo",
      summary: "Everything turns.",
      colour: 5,
    });
    // Another column takes the card at its end.
    expect(layout(board())[1]).toEqual(["To do", "Outline", "Sources", "Draft"]);
    expect(titleButton(view, "Draft")).toHaveFocus();
    expect(cardOf(view, "Draft")).toHaveTextContent(`${t("common.colour.vermilion")}DraftEverything turns.`);

    fireEvent.keyDown(titleButton(view, "Draft"), { key: "Enter" });
    fireEvent.change(field(t("board.card.colour")), { target: { value: "" } });
    fireEvent.change(field(t("board.card.column")), { target: { value: "" } });
    fireEvent.submit(dialog());
    expect(board().cards.find((one) => one.id === "draft")).toMatchObject({ columnId: null, colour: null });
  });

  it("list every reason the dialog cannot be saved, saving nothing until it is put right", () => {
    const { view, onChange } = renderBoard({ layout: "list" });
    fireEvent.click(titleButton(view, "Draft"));
    fireEvent.change(field(t("board.card.title")), { target: { value: " " } });
    fireEvent.change(field(t("board.card.summary")), { target: { value: "x".repeat(501) } });
    // The reasons are given once Save is tried.
    expect(within(dialog()).queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole("button", { name: t("common.save") }));
    expect(
      within(dialog())
        .getAllByRole("alert")
        .map((alert) => alert.textContent),
    ).toEqual([t("board.card.problemTitleBlank"), t("board.card.problemSummaryTooLong")]);
    fireEvent.change(field(t("board.card.title")), { target: { value: "x".repeat(121) } });
    expect(
      within(dialog())
        .getAllByRole("alert")
        .map((alert) => alert.textContent),
    ).toEqual([t("board.card.problemTitleTooLong"), t("board.card.problemSummaryTooLong")]);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(field(t("board.card.title")), { target: { value: "Turn" } });
    fireEvent.change(field(t("board.card.summary")), { target: { value: "" } });
    expect(within(dialog()).queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole("button", { name: t("common.save") }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("ask before Cancel or Escape discards the dialog's changes: Keep editing goes on, Discard closes without saving", () => {
    const { view, onChange } = renderBoard({ layout: "list" });
    fireEvent.click(titleButton(view, "Draft"));
    fireEvent.change(field(t("board.card.summary")), { target: { value: "First pass. Then more." } });
    fireEvent.click(within(dialog()).getByRole("button", { name: t("common.cancel") }));
    let question = within(dialog()).getByRole("alertdialog", { name: t("board.card.discardChanges") });
    expect(within(question).getByRole("button", { name: t("board.card.discard") })).toHaveFocus();
    fireEvent.click(within(question).getByRole("button", { name: t("board.card.keepEditing") }));
    expect(within(dialog()).queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(field(t("board.card.title"))).toHaveFocus();

    fireEvent.keyDown(dialog(), { key: "Escape" });
    expect(within(dialog()).getByRole("alertdialog", { name: t("board.card.discardChanges") })).toBeInTheDocument();
    // Escape while asking keeps editing; typing on closes the question too.
    fireEvent.keyDown(dialog(), { key: "Escape" });
    expect(within(dialog()).queryByRole("alertdialog")).not.toBeInTheDocument();
    fireEvent.keyDown(dialog(), { key: "Escape" });
    fireEvent.change(field(t("board.card.summary")), { target: { value: "Again." } });
    expect(within(dialog()).queryByRole("alertdialog")).not.toBeInTheDocument();
    fireEvent.keyDown(dialog(), { key: "Escape" });
    question = within(dialog()).getByRole("alertdialog", { name: t("board.card.discardChanges") });
    fireEvent.click(within(question).getByRole("button", { name: t("board.card.discard") }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(titleButton(view, "Draft")).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("start from New card as New card, write nothing on Cancel, and are made after the card last opened", () => {
    const { view, board, onChange } = renderBoard({ layout: "list" });
    const newCard = within(view).getByRole("button", { name: t("board.newCard") });
    fireEvent.click(newCard);
    expect(dialog()).toHaveAccessibleName(t("board.newCard"));
    expect(field(t("board.card.title"))).toHaveValue("New card");
    expect(field(t("board.card.column"))).toHaveValue("done");
    expect(within(dialog()).queryByRole("button", { name: t("board.deleteCard") })).not.toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole("button", { name: t("common.cancel") }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(newCard).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();

    // Left as it opened, it is made as New card.
    fireEvent.click(newCard);
    fireEvent.click(within(dialog()).getByRole("button", { name: t("common.save") }));
    expect(layout(board())[3]).toEqual(["Done", "New card"]);
    expect(titleButton(view, "New card")).toHaveFocus();
    expect(titleButton(view, "New card")).toHaveAttribute("aria-current", "true");

    // After the card last opened, in its column; New card 2 since New card is taken.
    fireEvent.click(titleButton(view, "Outline"));
    fireEvent.keyDown(dialog(), { key: "Escape" });
    fireEvent.click(newCard);
    expect(field(t("board.card.title"))).toHaveValue("New card 2");
    fireEvent.change(field(t("board.card.title")), { target: { value: "Hook" } });
    fireEvent.submit(dialog());
    expect(layout(board())[1]).toEqual(["To do", "Outline", "Hook", "Sources"]);
  });

  it("are deleted after asking, from the dialog or with Delete on the row, the focus going to the next card or New card", () => {
    const { view, board } = renderBoard({ layout: "list" });
    fireEvent.click(titleButton(view, "Draft"));
    fireEvent.click(within(dialog()).getByRole("button", { name: t("board.deleteCard") }));
    let question = within(dialog()).getByRole("alertdialog", { name: t("board.deleteCard") });
    expect(question).toHaveTextContent(t("board.deleteCardWarning"));
    // Escape closes the question first, back to the title.
    fireEvent.keyDown(dialog(), { key: "Escape" });
    expect(field(t("board.card.title"))).toHaveFocus();
    fireEvent.click(within(dialog()).getByRole("button", { name: t("board.deleteCard") }));
    fireEvent.click(
      within(within(dialog()).getByRole("alertdialog")).getByRole("button", { name: t("common.cancel") }),
    );
    expect(within(dialog()).queryByRole("alertdialog")).not.toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole("button", { name: t("board.deleteCard") }));
    question = within(dialog()).getByRole("alertdialog", { name: t("board.deleteCard") });
    fireEvent.click(within(question).getByRole("button", { name: t("board.confirmDeleteCard") }));
    expect(layout(board())[2]).toEqual(["Doing", "Review"]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(titleButton(view, "Review")).toHaveFocus();

    key(titleButton(view, "Review"), "Delete");
    let row = within(view).getByRole("alertdialog", { name: t("board.deleteCardNamed", { name: "Review" }) });
    fireEvent.click(within(row).getByRole("button", { name: t("common.cancel") }));
    expect(within(view).queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(titleButton(view, "Review")).toHaveFocus();
    key(titleButton(view, "Review"), "Delete");
    row = within(view).getByRole("alertdialog", { name: t("board.deleteCardNamed", { name: "Review" }) });
    fireEvent.keyDown(within(row).getByRole("button", { name: t("common.cancel") }), { key: "Escape" });
    expect(titleButton(view, "Review")).toHaveFocus();
    fireEvent.click(
      within(more(view, "Review").closest("li")!).getByRole("button", {
        name: t("board.moreActionsNamed", { name: "Review" }),
      }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: t("board.deleteCard") }));
    row = within(view).getByRole("alertdialog", { name: t("board.deleteCardNamed", { name: "Review" }) });
    fireEvent.click(within(row).getByRole("button", { name: t("board.confirmDeleteCard") }));
    expect(layout(board())[2]).toEqual(["Doing"]);
    expect(within(view).getByRole("button", { name: t("board.newCard") })).toHaveFocus();
  });

  it("are renamed in place with F2 or Rename in their menu: Enter saves, Escape keeps the title, too long is refused", () => {
    const { view, board } = renderBoard({ layout: "list" });
    key(titleButton(view, "Draft"), "F2");
    let name = within(view).getByRole("textbox", { name: t("board.renameCard", { name: "Draft" }) });
    expect(name).toHaveFocus();
    fireEvent.change(name, { target: { value: "First draft" } });
    fireEvent.keyDown(name, { key: "Enter" });
    expect(board().cards.find((one) => one.id === "draft")!.title).toBe("First draft");
    expect(titleButton(view, "First draft")).toHaveFocus();

    fireEvent.click(more(view, "First draft"));
    fireEvent.click(screen.getByRole("menuitem", { name: t("common.rename") }));
    name = within(view).getByRole("textbox", { name: t("board.renameCard", { name: "First draft" }) });
    fireEvent.keyDown(name, { key: "Escape" });
    expect(titleButton(view, "First draft")).toHaveFocus();

    key(titleButton(view, "First draft"), "F2");
    name = within(view).getByRole("textbox");
    fireEvent.change(name, { target: { value: "x".repeat(121) } });
    fireEvent.keyDown(name, { key: "Enter" });
    expect(within(view).getByRole("alert")).toHaveTextContent(t("board.problem.tooLong"));
    expect(titleButton(view, "First draft")).toHaveFocus();
  });
});

describe("moving cards in the list", () => {
  it("by Alt and the arrows, within a column and to the column before or after, and the arrows move the focus in order", () => {
    const { view, board } = renderBoard({ layout: "list" });
    titleButton(view, "Outline").focus();
    key(titleButton(view, "Outline"), "ArrowDown", { altKey: true });
    expect(layout(board())[1]).toEqual(["To do", "Sources", "Outline"]);
    expect(announcement()).toBe(t("board.movedTo", { name: "Outline", group: "To do", position: 2, total: 2 }));
    expect(titleButton(view, "Outline")).toHaveFocus();
    key(titleButton(view, "Outline"), "ArrowRight", { altKey: true });
    expect(layout(board())[2]).toEqual(["Doing", "Outline", "Draft", "Review"]);
    key(titleButton(view, "Outline"), "ArrowLeft", { altKey: true });
    expect(layout(board())[1]).toEqual(["To do", "Sources", "Outline"]);

    // In the list, the arrows go through the cards in order; left and right do nothing.
    key(titleButton(view, "Outline"), "ArrowDown");
    expect(titleButton(view, "Draft")).toHaveFocus();
    key(document.activeElement!, "ArrowRight");
    expect(titleButton(view, "Draft")).toHaveFocus();
    key(document.activeElement!, "Home");
    expect(titleButton(view, "Ideas")).toHaveFocus();
    key(document.activeElement!, "ArrowUp");
    expect(titleButton(view, "Ideas")).toHaveFocus();
    key(document.activeElement!, "End");
    expect(titleButton(view, "Review")).toHaveFocus();
    key(document.activeElement!, "ArrowDown");
    expect(titleButton(view, "Review")).toHaveFocus();
    // Keys the board does not use are left alone.
    expect(fireEvent.keyDown(titleButton(view, "Review"), { key: "a" })).toBe(true);
  });

  it("by the card's menu: Move up, Move down and Move to column…", () => {
    const { view, board } = renderBoard({ layout: "list" });
    fireEvent.click(more(view, "Review"));
    const menu = screen.getByRole("menu", { name: t("board.cardMenu", { name: "Review" }) });
    expect(menuTexts(menu)).toEqual([
      t("board.open"),
      t("common.rename"),
      t("common.moveUp"),
      t("common.moveDown"),
      t("board.moveToColumn"),
      t("board.deleteCard"),
    ]);
    expect(within(menu).getByRole("menuitem", { name: t("common.moveDown") })).toBeDisabled();
    fireEvent.click(within(menu).getByRole("menuitem", { name: t("common.moveUp") }));
    expect(layout(board())[2]).toEqual(["Doing", "Review", "Draft"]);
    fireEvent.click(more(view, "Review"));
    fireEvent.click(screen.getByRole("menuitem", { name: t("common.moveDown") }));
    expect(layout(board())[2]).toEqual(["Doing", "Draft", "Review"]);

    titleButton(view, "Review").focus();
    key(titleButton(view, "Review"), "F10", { shiftKey: true });
    fireEvent.click(screen.getByRole("menuitem", { name: t("board.moveToColumn") }));
    const move = screen.getByRole("dialog", { name: t("common.moveTitleNamed", { name: "Review" }) });
    expect(
      within(move)
        .getAllByRole("radio")
        .map((radio) => radio.closest("label")!.textContent),
    ).toEqual([t("board.noColumn"), "To do", "Doing", "Done"]);
    expect(within(move).getByRole("radio", { name: "Doing" })).toBeChecked();
    // Cancel moves nothing and gives the focus back.
    fireEvent.click(within(move).getByRole("button", { name: t("common.cancel") }));
    expect(titleButton(view, "Review")).toHaveFocus();
    key(titleButton(view, "Review"), "ContextMenu");
    fireEvent.click(screen.getByRole("menuitem", { name: t("board.moveToColumn") }));
    fireEvent.click(screen.getByRole("radio", { name: t("board.noColumn") }));
    fireEvent.click(screen.getByRole("button", { name: t("common.moveConfirm") }));
    expect(layout(board())[0]).toEqual(["-", "Ideas", "Review"]);
    expect(announcement()).toBe(
      t("board.movedTo", { name: "Review", group: t("board.noColumn"), position: 2, total: 2 }),
    );
    expect(titleButton(view, "Review")).toHaveFocus();
  });

  it("by dragging a card before another, to the end of a column, and a column before another", () => {
    const { view, board } = renderBoard({ layout: "list" });
    const dataTransfer = { setData: () => undefined, effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(cardOf(view, "Ideas"), { dataTransfer });
    fireEvent.dragOver(cardOf(view, "Review"), { dataTransfer });
    expect(cardOf(view, "Review")).toHaveAttribute("data-drop", "before");
    fireEvent.dragLeave(cardOf(view, "Review"), { dataTransfer });
    expect(cardOf(view, "Review")).not.toHaveAttribute("data-drop");
    fireEvent.dragOver(cardOf(view, "Review"), { dataTransfer });
    fireEvent.drop(cardOf(view, "Review"), { dataTransfer });
    expect(layout(board())[2]).toEqual(["Doing", "Draft", "Ideas", "Review"]);
    // A drop with nothing dragged from this board is not taken.
    const before = board();
    fireEvent.dragOver(cardOf(view, "Review"), { dataTransfer });
    fireEvent.drop(cardOf(view, "Review"), { dataTransfer });
    fireEvent.drop(within(view).getByRole("region", { name: "Done" }), { dataTransfer });
    const heading = within(view).getByRole("region", { name: "Done" }).querySelector(".eh-board-column-heading")!;
    fireEvent.dragOver(heading, { dataTransfer });
    fireEvent.drop(heading, { dataTransfer });
    expect(board()).toBe(before);
    expect(groups(view)).toEqual(["To do", "Doing", "Done"]);
  });
});

describe("the board's props", () => {
  it("lets a host open cards in its own editor, New card adding the card first", () => {
    const opened: string[] = [];
    const { view, board } = renderBoard({ onOpenCard: (id) => opened.push(id) });
    fireEvent.click(titleButton(view, "Draft"));
    fireEvent.keyDown(titleButton(view, "Review"), { key: "Enter" });
    expect(opened).toEqual(["draft", "review"]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(within(view).getByRole("button", { name: t("board.newCard") }));
    const added = board().cards.find((one) => one.title === "New card")!;
    expect(added.columnId).toBe("doing");
    expect(layout(board())[2]).toEqual(["Doing", "Draft", "Review", "New card"]);
    expect(opened.at(-1)).toBe(added.id);
    expect(titleButton(view, "New card")).toHaveFocus();
  });

  it("shows the host's chosen card, and its own content for a card's details", () => {
    const { view } = renderBoard({
      selectedId: "review",
      renderCard: (one) => <em>{`${one.title} by the host`}</em>,
    });
    expect(titleButton(view, "Review")).toHaveAttribute("aria-current", "true");
    expect(cardOf(view, "Review")).toHaveAttribute("data-selected", "true");
    fireEvent.click(titleButton(view, "Draft"));
    fireEvent.keyDown(dialog(), { key: "Escape" });
    // The host's choice wins over the card last opened.
    expect(titleButton(view, "Draft")).not.toHaveAttribute("aria-current");
    expect(cardOf(view, "Outline")).toHaveTextContent("OutlineOutline by the host");
    expect(cardOf(view, "Outline")).not.toHaveTextContent("Two pages at most.");
  });

  it("read-only, offers no editing: no tools, no moves, no deletes, a menu with Open and a dialog that only shows", () => {
    const { view, onChange } = renderBoard({ readOnly: true, layout: "list" });
    expect(within(view).queryByRole("button", { name: t("board.newCard") })).not.toBeInTheDocument();
    expect(within(view).queryByRole("button", { name: t("board.moreActionsNamed", { name: "To do" }) })).toBeNull();
    expect(within(view).queryByRole("button", { name: t("board.editColumn", { name: "To do" }) })).toBeNull();
    for (const [name, options] of [
      ["ArrowDown", { altKey: true }],
      ["ArrowRight", { altKey: true }],
      ["Delete", {}],
      ["F2", {}],
    ] as const) {
      fireEvent.keyDown(titleButton(view, "Outline"), { key: name, ...options });
    }
    fireEvent.keyDown(within(view).getByRole("region", { name: "To do" }).querySelector(".eh-board-column-heading")!, {
      key: "Delete",
    });
    fireEvent.contextMenu(
      within(view).getByRole("region", { name: "To do" }).querySelector(".eh-board-column-heading")!,
    );
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(within(view).queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(within(view).queryByRole("textbox")).not.toBeInTheDocument();
    // The arrows still move the focus.
    fireEvent.keyDown(titleButton(view, "Outline"), { key: "ArrowDown" });
    expect(titleButton(view, "Sources")).toHaveFocus();

    fireEvent.click(more(view, "Outline"));
    expect(menuTexts(screen.getByRole("menu"))).toEqual([t("board.open")]);
    fireEvent.click(screen.getByRole("menuitem", { name: t("board.open") }));
    expect(field(t("board.card.title"))).toHaveAttribute("readonly");
    expect(field(t("board.card.column"))).toBeDisabled();
    expect(within(dialog()).queryByRole("button", { name: t("common.save") })).not.toBeInTheDocument();
    fireEvent.submit(dialog());
    expect(dialog()).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole("button", { name: t("board.card.close") }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("takes the host's strings (No part for No column), translator, theme and class", () => {
    const { view } = renderBoard({
      strings: { "board.noColumn": "No part" },
      t: (key) => (key === "board.newColumn" ? "Add a part" : ""),
      theme: "dark",
      className: "host-board",
    });
    expect(within(view).getByRole("region", { name: "No part" })).toBeInTheDocument();
    expect(within(view).getByRole("button", { name: "Add a part" })).toBeInTheDocument();
    const root = view.closest(".eh-root")!;
    expect(root).toHaveClass("eh-board", "host-board");
    expect(root).toHaveAttribute("data-theme", "dark");
  });

  it("says why a change the board cannot take was refused", () => {
    const full = {
      ...BOARD,
      columns: Array.from({ length: 50 }, (_, n) => ({ id: `c${n}`, name: `Column ${n}` })),
      cards: [],
    };
    const { view, onChange } = renderBoard({ initial: full });
    fireEvent.click(within(view).getByRole("button", { name: t("board.newColumn") }));
    expect(within(view).getByRole("alert")).toHaveTextContent(t("board.problem.limit"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
