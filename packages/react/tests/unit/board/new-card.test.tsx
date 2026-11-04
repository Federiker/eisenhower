/** New card at the foot of each column (the owner's decision of 4 November 2026). */
import { type Board as BoardValue, MAX_BOARD_CARDS } from "@eisenhower/model";
import { act, fireEvent, screen, within } from "@testing-library/react";

import { announcement, BOARD, card, layout, NO_LOOSE, renderBoard, t, titleButton } from "./host";

const footButton = (view: HTMLElement, group: string) =>
  within(view).getByRole("button", { name: t("board.newCardIn", { group }) });
const footField = (view: HTMLElement, group: string) =>
  within(view).getByRole("textbox", { name: t("board.newCardField", { group }) });

/** Types a title into an open field and presses Enter. */
function enter(field: HTMLElement, title: string) {
  fireEvent.change(field, { target: { value: title } });
  fireEvent.keyDown(field, { key: "Enter" });
}

describe("New card at a column's foot", () => {
  it("adds cards one after another at the end of its column, keeping the field open and empty, and announces each", () => {
    const onOpenCard = vi.fn();
    const { view, board } = renderBoard({ onOpenCard });
    const button = footButton(view, "To do");
    expect(button).toHaveTextContent(t("board.newCard"));
    fireEvent.click(button);
    const field = footField(view, "To do");
    expect(field).toHaveFocus();

    enter(field, "  Fix the gate ");
    expect(layout(board())[1]).toEqual(["To do", "Outline", "Sources", "Fix the gate"]);
    expect(announcement()).toBe(t("board.cardAdded", { name: "Fix the gate", group: "To do", position: 3, total: 3 }));
    expect(footField(view, "To do")).toHaveValue("");
    expect(footField(view, "To do")).toHaveFocus();

    enter(footField(view, "To do"), "Paint the fence");
    expect(layout(board())[1]).toEqual(["To do", "Outline", "Sources", "Fix the gate", "Paint the fence"]);
    expect(announcement()).toBe(
      t("board.cardAdded", { name: "Paint the fence", group: "To do", position: 4, total: 4 }),
    );
    // The other columns are untouched, and the new cards are not opened.
    expect(layout(board())[2]).toEqual(["Doing", "Draft", "Review"]);
    expect(onOpenCard).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // The toolbar's New card is still there, on its own.
    expect(within(view).getByRole("button", { name: t("board.newCard") })).toBeInTheDocument();
  });

  it("adds to an empty column, and to No column from its own foot", () => {
    const { view, board } = renderBoard();
    fireEvent.click(footButton(view, "Done"));
    enter(footField(view, "Done"), "Ship it");
    expect(layout(board())[3]).toEqual(["Done", "Ship it"]);

    fireEvent.click(footButton(view, t("board.noColumn")));
    enter(footField(view, t("board.noColumn")), "Someday");
    expect(layout(board())[0]).toEqual(["-", "Ideas", "Someday"]);
    expect(announcement()).toBe(
      t("board.cardAdded", { name: "Someday", group: t("board.noColumn"), position: 2, total: 2 }),
    );
  });

  it("offers No column's foot only while No column is shown", () => {
    const { view } = renderBoard({ initial: NO_LOOSE });
    expect(
      within(view).queryByRole("button", { name: t("board.newCardIn", { group: t("board.noColumn") }) }),
    ).toBeNull();
    expect(footButton(view, "To do")).toBeInTheDocument();
  });

  it("closes on Escape, or on Enter or leaving it while empty, giving the focus back to the button", () => {
    const { view, onChange } = renderBoard();
    fireEvent.click(footButton(view, "Doing"));
    fireEvent.change(footField(view, "Doing"), { target: { value: "Half typed" } });
    fireEvent.keyDown(footField(view, "Doing"), { key: "Escape" });
    expect(within(view).queryByRole("textbox")).not.toBeInTheDocument();
    expect(footButton(view, "Doing")).toHaveFocus();

    // A blank title adds nothing and closes the field.
    fireEvent.click(footButton(view, "Doing"));
    enter(footField(view, "Doing"), "   ");
    expect(within(view).queryByRole("textbox")).not.toBeInTheDocument();
    expect(footButton(view, "Doing")).toHaveFocus();

    // Leaving it empty closes it; leaving it with a title keeps it, and the title.
    fireEvent.click(footButton(view, "Doing"));
    fireEvent.blur(footField(view, "Doing"));
    expect(within(view).queryByRole("textbox")).not.toBeInTheDocument();
    expect(footButton(view, "Doing")).toHaveFocus();
    fireEvent.click(footButton(view, "Doing"));
    fireEvent.change(footField(view, "Doing"), { target: { value: "Kept" } });
    fireEvent.blur(footField(view, "Doing"));
    expect(footField(view, "Doing")).toHaveValue("Kept");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("leaves the focus where it went when the empty field is left for another control", () => {
    const { view } = renderBoard();
    fireEvent.click(footButton(view, "Doing"));
    expect(footField(view, "Doing")).toHaveFocus();
    act(() => titleButton(view, "Draft").focus());
    expect(within(view).queryByRole("textbox")).not.toBeInTheDocument();
    expect(titleButton(view, "Draft")).toHaveFocus();
  });

  it("keeps a refused title in the field and says why, until it is changed", () => {
    const { view, onChange } = renderBoard();
    fireEvent.click(footButton(view, "To do"));
    const long = "x".repeat(121);
    enter(footField(view, "To do"), long);
    expect(onChange).not.toHaveBeenCalled();
    const field = footField(view, "To do");
    expect(field).toHaveValue(long);
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(t("board.problem.tooLong"));
    expect(within(view).getByRole("alert")).toHaveTextContent(t("board.problem.tooLong"));

    fireEvent.change(field, { target: { value: "Shorter" } });
    expect(within(view).queryByRole("alert")).not.toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "false");
  });

  it("says when the board is full", () => {
    const full: BoardValue = {
      columns: BOARD.columns,
      cards: Array.from({ length: MAX_BOARD_CARDS }, (_, index) => card(`c${index}`, `Card ${index}`, "todo")),
    };
    const { view, onChange } = renderBoard({ initial: full });
    fireEvent.click(footButton(view, "Done"));
    enter(footField(view, "Done"), "One more");
    expect(onChange).not.toHaveBeenCalled();
    expect(within(view).getByRole("alert")).toHaveTextContent(t("board.problem.limit"));
    expect(footField(view, "Done")).toHaveValue("One more");
  });

  it("is there in the list layout too, and for the cards of a board without columns", () => {
    const { view, board } = renderBoard({ layout: "list" });
    fireEvent.click(footButton(view, "Doing"));
    enter(footField(view, "Doing"), "Proofread");
    expect(layout(board())[2]).toEqual(["Doing", "Draft", "Review", "Proofread"]);
    expect(announcement()).toBe(t("board.cardAdded", { name: "Proofread", group: "Doing", position: 3, total: 3 }));
    expect(footButton(view, t("board.noColumn"))).toBeInTheDocument();
  });

  it("adds to a list without columns", () => {
    const { view, board } = renderBoard({
      layout: "list",
      initial: { columns: [], cards: [card("a", "Alpha", null)] },
    });
    fireEvent.click(footButton(view, t("board.noColumn")));
    enter(footField(view, t("board.noColumn")), "Beta");
    expect(board().cards.map((one) => one.title)).toEqual(["Alpha", "Beta"]);
  });

  it.each(["board", "list"] as const)("is not offered on a read-only board (%s layout)", (shape) => {
    const { view } = renderBoard({ readOnly: true, layout: shape });
    expect(within(view).queryAllByRole("button", { name: /^New card/ })).toHaveLength(0);
  });
});
