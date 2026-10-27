import {
  addCard,
  addCardAt,
  addColumn,
  type Board,
  type BoardCard,
  blankCard,
  boardGroups,
  cardPlace,
  cardStepTarget,
  cardsInColumn,
  checkedBoard,
  deleteCard,
  deleteColumn,
  type EditResult,
  editCard,
  MAX_BOARD_CARDS,
  MAX_BOARD_COLUMNS,
  moveCard,
  moveColumn,
  newCardSpot,
  placeBefore,
  renameColumn,
  stepCard,
} from "../../../src";

const card = (n: number, columnId: string | null): BoardCard => blankCard(`card-${n}`, `C${n}`, columnId);

/** Cards kept out of group order on purpose: within a column, only the order of the array counts. */
const BOARD: Board = {
  columns: [
    { id: "one", name: "One" },
    { id: "two", name: "Two" },
  ],
  cards: [card(11, "one"), card(10, null), card(21, "two"), card(12, "one"), card(22, "two")],
};

/** Each card as "title:column", the column by its index ("-" for none), in the board's order. */
const titles = (result: EditResult<Board>) => {
  if (!result.ok) throw new Error(`refused: ${result.reason}`);
  return result.value.cards.map(
    (one) =>
      `${one.title}:${one.columnId === null ? "-" : result.value.columns.findIndex((column) => column.id === one.columnId)}`,
  );
};
const columnNames = (result: EditResult<Board>) => {
  if (!result.ok) throw new Error(`refused: ${result.reason}`);
  return result.value.columns.map((column) => column.name);
};

describe("a board's columns", () => {
  it("refuse blank and too long names, and keep names that repeat, trimmed", () => {
    expect(addColumn(BOARD, "three", " ")).toEqual({ ok: false, reason: "blank" });
    expect(renameColumn(BOARD, "one", "x".repeat(121))).toEqual({ ok: false, reason: "tooLong" });
    expect(renameColumn(BOARD, "nine", "One")).toEqual({ ok: false, reason: "missing" });
    expect(columnNames(addColumn(BOARD, "three", " One "))).toEqual(["One", "Two", "One"]);
    expect(columnNames(renameColumn(BOARD, "two", " Later "))).toEqual(["One", "Later"]);
  });

  it("refuse an id already used, and a column past the limit", () => {
    expect(addColumn(BOARD, "two", "Again")).toEqual({ ok: false, reason: "duplicate" });
    expect(addColumn(BOARD, "card-10", "Again")).toEqual({ ok: false, reason: "duplicate" });
    const full: Board = {
      columns: Array.from({ length: MAX_BOARD_COLUMNS }, (_, n) => ({ id: `c${n}`, name: `C${n}` })),
      cards: [],
    };
    expect(addColumn(full, "more", "More")).toEqual({ ok: false, reason: "limit" });
  });

  it("move to another place, clamped to the ends, their cards with them", () => {
    expect(columnNames(moveColumn(BOARD, "two", 0))).toEqual(["Two", "One"]);
    expect(columnNames(moveColumn(BOARD, "one", 9))).toEqual(["Two", "One"]);
    expect(columnNames(moveColumn(BOARD, "two", -3))).toEqual(["Two", "One"]);
    expect(moveColumn(BOARD, "nine", 0)).toEqual({ ok: false, reason: "missing" });
    expect(cardsInColumn(BOARD, "one")).toBe(2);
  });

  it("deleted move their cards to the end of the column before, the start of the one after, or out of every column", () => {
    expect(titles(deleteColumn(BOARD, "two", "before"))).toEqual(["C10:-", "C11:0", "C12:0", "C21:0", "C22:0"]);
    expect(titles(deleteColumn(BOARD, "one", "after"))).toEqual(["C10:-", "C11:0", "C12:0", "C21:0", "C22:0"]);
    expect(titles(deleteColumn(BOARD, "one", "outside"))).toEqual(["C10:-", "C11:-", "C12:-", "C21:0", "C22:0"]);
    expect(titles(deleteColumn(BOARD, "one", "delete"))).toEqual(["C10:-", "C21:0", "C22:0"]);
    expect(deleteColumn(BOARD, "one", "before")).toEqual({ ok: false, reason: "missing" });
    expect(deleteColumn(BOARD, "two", "after")).toEqual({ ok: false, reason: "missing" });
    expect(deleteColumn(BOARD, "nine", "delete")).toEqual({ ok: false, reason: "missing" });
  });
});

describe("a board's cards", () => {
  it("are grouped outside every column first, then column by column, every column with a group", () => {
    expect(boardGroups(BOARD).map((group) => [group.columnId, ...group.cards.map((one) => one.title)])).toEqual([
      [null, "C10"],
      ["one", "C11", "C12"],
      ["two", "C21", "C22"],
    ]);
    expect(boardGroups({ columns: [{ id: "x", name: "X" }], cards: [] })).toEqual([
      { columnId: null, cards: [] },
      { columnId: "x", cards: [] },
    ]);
    expect(cardPlace(BOARD, "card-12")).toEqual({ group: 1, index: 1 });
    expect(cardPlace(BOARD, "card-99")).toBeNull();
  });

  it("go after the selected card, else at the end of the last column, else out of every column", () => {
    expect(newCardSpot(BOARD, "card-11")).toEqual({ columnId: "one", after: "card-11" });
    expect(newCardSpot(BOARD, null)).toEqual({ columnId: "two", after: null });
    expect(newCardSpot(BOARD, "card-99")).toEqual({ columnId: "two", after: null });
    expect(newCardSpot({ columns: [], cards: [card(10, null)] }, null)).toEqual({ columnId: null, after: null });
    expect(titles(addCardAt(BOARD, card(13, "one"), { columnId: "one", after: "card-11" }))).toEqual([
      "C10:-",
      "C11:0",
      "C13:0",
      "C12:0",
      "C21:1",
      "C22:1",
    ]);
    // Given another column, or once the card it follows has gone, it goes at the column's end.
    expect(titles(addCardAt(BOARD, card(13, "two"), { columnId: "one", after: "card-11" }))).toEqual([
      "C10:-",
      "C11:0",
      "C12:0",
      "C21:1",
      "C22:1",
      "C13:1",
    ]);
    expect(titles(addCardAt(BOARD, card(13, "one"), { columnId: "one", after: "card-99" }))).toEqual([
      "C10:-",
      "C11:0",
      "C12:0",
      "C13:0",
      "C21:1",
      "C22:1",
    ]);
    expect(addCardAt(BOARD, card(13, "nine"), { columnId: "nine", after: null })).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(titles(addCard(BOARD, card(13, "one"), 1))).toEqual(["C10:-", "C11:0", "C13:0", "C12:0", "C21:1", "C22:1"]);
  });

  it("are refused a blank or long title, a long or broken summary, a taken id, a missing column and the limit", () => {
    expect(addCard(BOARD, { ...card(13, "one"), title: "  " }, 0)).toEqual({ ok: false, reason: "blank" });
    expect(addCard(BOARD, { ...card(13, "one"), title: "x".repeat(121) }, 0)).toEqual({
      ok: false,
      reason: "tooLong",
    });
    expect(addCard(BOARD, { ...card(13, "one"), summary: "x".repeat(501) }, 0)).toEqual({
      ok: false,
      reason: "tooLong",
    });
    expect(addCard(BOARD, { ...card(13, "one"), summary: "a\nb" }, 0)).toEqual({ ok: false, reason: "invalid" });
    expect(addCard(BOARD, { ...card(13, "one"), colour: 8 }, 0)).toEqual({ ok: false, reason: "invalid" });
    expect(addCard(BOARD, card(11, "one"), 0)).toEqual({ ok: false, reason: "duplicate" });
    expect(addCard(BOARD, card(13, "nine"), 0)).toEqual({ ok: false, reason: "missing" });
    const full: Board = { columns: [], cards: Array.from({ length: MAX_BOARD_CARDS }, (_, n) => card(n, null)) };
    expect(addCard(full, card(9999, null), 0)).toEqual({ ok: false, reason: "limit" });
    const added = addCard(BOARD, { ...card(13, null), title: " Trimmed " }, 0);
    expect(added.ok && added.value.cards[0]!.title).toBe("Trimmed");
  });

  it("edited keep their place in their column, and go to the end of another column given one", () => {
    expect(titles(editCard(BOARD, { ...card(11, "one"), title: " Renamed " }))).toEqual([
      "Renamed:0",
      "C10:-",
      "C21:1",
      "C12:0",
      "C22:1",
    ]);
    expect(titles(editCard(BOARD, card(11, "two")))).toEqual(["C10:-", "C12:0", "C21:1", "C22:1", "C11:1"]);
    expect(editCard(BOARD, card(99, "one"))).toEqual({ ok: false, reason: "missing" });
    expect(editCard(BOARD, card(11, "nine"))).toEqual({ ok: false, reason: "missing" });
    expect(editCard(BOARD, { ...card(11, "one"), title: "" })).toEqual({ ok: false, reason: "blank" });
    const coloured = editCard(BOARD, { ...card(11, "one"), summary: "A turn.", colour: 3 });
    expect(coloured.ok && coloured.value.cards[0]).toEqual({
      id: "card-11",
      title: "C11",
      columnId: "one",
      summary: "A turn.",
      colour: 3,
    });
  });

  it("are deleted", () => {
    expect(titles(deleteCard(BOARD, "card-21"))).toEqual(["C11:0", "C10:-", "C12:0", "C22:1"]);
    expect(deleteCard(BOARD, "card-99")).toEqual({ ok: false, reason: "missing" });
  });

  it("move into a group at a place counted without themselves, and before another card", () => {
    expect(titles(moveCard(BOARD, "card-12", "two", 0))).toEqual(["C10:-", "C11:0", "C12:1", "C21:1", "C22:1"]);
    expect(titles(moveCard(BOARD, "card-11", null, 99))).toEqual(["C10:-", "C11:-", "C12:0", "C21:1", "C22:1"]);
    expect(moveCard(BOARD, "card-99", null, 0)).toEqual({ ok: false, reason: "missing" });
    expect(moveCard(BOARD, "card-11", "nine", 0)).toEqual({ ok: false, reason: "missing" });
    expect(placeBefore(BOARD, "card-10", "card-22")).toEqual({ columnId: "two", index: 1 });
    expect(placeBefore(BOARD, "card-11", "card-12")).toEqual({ columnId: "one", index: 0 });
    expect(placeBefore(BOARD, "card-12", "card-11")).toEqual({ columnId: "one", index: 0 });
    expect(placeBefore(BOARD, "card-11", "card-99")).toBeNull();
    expect(placeBefore(BOARD, "card-99", "card-11")).toBeNull();
  });

  it("step within their column and across columns, the cards outside every column counting as the column before the first", () => {
    expect(cardStepTarget(BOARD, "card-11", "up")).toBeNull();
    expect(cardStepTarget(BOARD, "card-11", "down")).toEqual({ columnId: "one", index: 1 });
    expect(cardStepTarget(BOARD, "card-12", "up")).toEqual({ columnId: "one", index: 0 });
    expect(cardStepTarget(BOARD, "card-12", "down")).toBeNull();
    expect(cardStepTarget(BOARD, "card-11", "previousColumn")).toEqual({ columnId: null, index: 1 });
    expect(cardStepTarget(BOARD, "card-12", "nextColumn")).toEqual({ columnId: "two", index: 0 });
    expect(cardStepTarget(BOARD, "card-22", "nextColumn")).toBeNull();
    expect(cardStepTarget(BOARD, "card-10", "previousColumn")).toBeNull();
    expect(cardStepTarget(BOARD, "card-99", "up")).toBeNull();
    expect(titles(stepCard(BOARD, "card-11", "previousColumn"))).toEqual(["C10:-", "C11:-", "C12:0", "C21:1", "C22:1"]);
    expect(stepCard(BOARD, "card-10", "previousColumn")).toEqual({ ok: false, reason: "missing" });
  });
});

describe("checking a board", () => {
  it("passes a well-formed board and refuses one that is not", () => {
    expect(checkedBoard(BOARD)).toEqual({ ok: true, value: BOARD });
    expect(checkedBoard({ ...BOARD, cards: [card(1, "nine")] })).toEqual({ ok: false, reason: "invalid" });
    expect(checkedBoard({ ...BOARD, columns: [{ id: "one", name: "" }] })).toEqual({ ok: false, reason: "invalid" });
  });
});
