import type { Board as BoardValue, BoardCard } from "@eisenhower/model";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { type Mock, vi } from "vitest";

import { Board, type BoardProps, createTranslate } from "../../../src";

export const t = createTranslate();

export function card(id: string, title: string, columnId: string | null, extra: Partial<BoardCard> = {}): BoardCard {
  return { id, title, columnId, summary: "", colour: null, ...extra };
}

/** A loose card, two cards in each of To do and Doing, and an empty Done. */
export const BOARD: BoardValue = {
  columns: [
    { id: "todo", name: "To do" },
    { id: "doing", name: "Doing" },
    { id: "done", name: "Done" },
  ],
  cards: [
    card("ideas", "Ideas", null),
    card("outline", "Outline", "todo", { colour: 1, summary: "Two pages at most." }),
    card("sources", "Sources", "todo"),
    card("draft", "Draft", "doing", { summary: "First pass." }),
    card("review", "Review", "doing"),
  ],
};

/** The same board with no card outside the columns: Ideas is in To do. */
export const NO_LOOSE: BoardValue = {
  ...BOARD,
  cards: BOARD.cards.map((one) => (one.id === "ideas" ? { ...one, columnId: "todo" } : one)),
};

/**
 * Draws a board as a host does, keeping each change it is given; `board()` is the board as it now is and
 * `onChange` the host's handler.
 */
export function renderBoard({ initial = BOARD, ...props }: Partial<BoardProps> & { initial?: BoardValue } = {}): {
  view: HTMLElement;
  board: () => BoardValue;
  onChange: Mock<(next: BoardValue) => void>;
} {
  const state = { value: initial };
  const onChange = vi.fn<(next: BoardValue) => void>();
  render(<Host initial={initial} state={state} onChange={onChange} props={props} />);
  const view = screen.getByRole("region", { name: t("board.label") });
  return { view, board: () => state.value, onChange };
}

/** A host of the board: it keeps the board in its state and hands each change back. */
function Host({
  initial,
  state,
  onChange,
  props,
}: {
  initial: BoardValue;
  state: { value: BoardValue };
  onChange: (next: BoardValue) => void;
  props: Partial<BoardProps>;
}) {
  const [value, setValue] = useState(initial);
  state.value = value;
  return (
    <Board
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
      {...props}
    />
  );
}

/** The board as groups: "-" for the cards outside every column, then each column's name, with its cards' titles. */
export function layout(board: BoardValue) {
  return [null, ...board.columns.map((column) => column.id)].map((id) => [
    id === null ? "-" : board.columns.find((column) => column.id === id)!.name,
    ...board.cards.filter((one) => one.columnId === id).map((one) => one.title),
  ]);
}

/** The columns drawn on the board, by their names, in order. */
export const columns = (view: HTMLElement) =>
  [...view.querySelectorAll(".eh-board-column")].map((column) => column.getAttribute("aria-label"));

/** The groups drawn in the list, by their names ("" for the unnamed group of a board without columns). */
export const groups = (view: HTMLElement) =>
  [...view.querySelectorAll(".eh-board-group")].map((group) => group.getAttribute("aria-label") ?? "");

/** A card's title button, among the cards (not the tools above them, such as New card). */
export const titleButton = (view: HTMLElement, name: string) =>
  within(view.querySelector<HTMLElement>(".eh-board-columns, .eh-board-groups")!).getByRole("button", { name });
export const cardOf = (view: HTMLElement, name: string) => titleButton(view, name).closest("li") as HTMLElement;
export const announcement = () => screen.getByRole("status").textContent?.trim();

export const transfer = (): { setData: () => void; effectAllowed: string; dropEffect: string } => ({
  setData: () => undefined,
  effectAllowed: "",
  dropEffect: "",
});

/** A whole drag: start, over and drop on the target, end. */
export function drag(from: Element, to: Element) {
  const dataTransfer = transfer();
  fireEvent.dragStart(from, { dataTransfer });
  fireEvent.dragOver(to, { dataTransfer });
  fireEvent.drop(to, { dataTransfer });
  fireEvent.dragEnd(from, { dataTransfer });
}

/** Lets a timer of 0 ms run (the No column shown after a drag has begun). */
export const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
