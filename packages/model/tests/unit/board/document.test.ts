import {
  addCard,
  addColumn,
  type Board,
  blankCard,
  boardDocument,
  boardNeighbour,
  boardProblems,
  type DocumentError,
  deleteColumn,
  emptyBoard,
  moveCard,
  parseDocument,
  renameColumn,
  serialiseDocument,
} from "../../../src";

const BOARD: Board = {
  columns: [
    { id: "todo", name: "To do" },
    { id: "doing", name: "Doing" },
  ],
  cards: [
    { id: "a", title: "Write the outline", columnId: "todo", summary: "Two pages at most.", colour: 1 },
    { id: "b", title: "Find a printer", columnId: null, summary: "", colour: null },
    { id: "c", title: "Proofread", columnId: "doing", summary: "", colour: 7 },
  ],
};

function problemOf(data: unknown): DocumentError {
  const text = JSON.stringify({ format: "eisenhower", kind: "board", version: 1, data });
  try {
    parseDocument(boardDocument, text);
  } catch (error) {
    return error as DocumentError;
  }
  throw new Error("read");
}

describe("a board document", () => {
  it("is kind board, version 1, and round-trips", () => {
    expect(boardDocument.kind).toBe("board");
    expect(boardDocument.version).toBe(1);
    expect(parseDocument(boardDocument, serialiseDocument(boardDocument, BOARD))).toEqual(BOARD);
    expect(parseDocument(boardDocument, serialiseDocument(boardDocument, emptyBoard()))).toEqual({
      columns: [],
      cards: [],
    });
  });

  it("still validates and round-trips after every kind of edit", () => {
    let board = emptyBoard();
    const apply = (result: { ok: true; value: Board } | { ok: false }) => {
      if (!result.ok) throw new Error("refused");
      board = result.value;
      expect(parseDocument(boardDocument, serialiseDocument(boardDocument, board))).toEqual(board);
    };
    apply(addColumn(board, "todo", "To do"));
    apply(addColumn(board, "done", "Done"));
    apply(addCard(board, blankCard("x", "Plan", "todo"), 0));
    apply(addCard(board, { ...blankCard("y", "Ship", null), summary: "Soon.", colour: 5 }, 0));
    apply(moveCard(board, "x", "done", 0));
    apply(renameColumn(board, "done", "Finished"));
    apply(deleteColumn(board, "done", "before"));
    expect(board.cards.map((one) => [one.id, one.columnId])).toEqual([
      ["y", null],
      ["x", "todo"],
    ]);
  });

  it("is refused, with the reasons, when its data breaks the schema or the rules between ids", () => {
    expect(problemOf({ columns: [], cards: [], extra: 1 }).problem).toBe("invalid");
    expect(problemOf({ columns: [{ id: "", name: "A" }], cards: [] }).problem).toBe("invalid");
    expect(problemOf({ ...BOARD, cards: [{ ...BOARD.cards[0], colour: 8 }] }).problem).toBe("invalid");
    expect(problemOf({ ...BOARD, cards: [{ ...BOARD.cards[0], summary: "a\nb" }] }).problem).toBe("invalid");
    expect(problemOf({ ...BOARD, cards: [{ ...BOARD.cards[0], title: " " }] }).problem).toBe("invalid");
    expect(problemOf({ ...BOARD, cards: [{ ...BOARD.cards[0], columnId: "gone" }] }).details).toEqual([
      "The card a is in a column that is not on the board.",
    ]);
    expect(problemOf({ ...BOARD, columns: [...BOARD.columns, { id: "a", name: "Again" }] }).details).toEqual([
      "The id a is used more than once.",
    ]);
  });

  it("has no problems when well formed", () => {
    expect(boardProblems(BOARD)).toEqual([]);
  });
});

describe("moving between the board's cards", () => {
  const board: Board = {
    columns: [
      { id: "one", name: "One" },
      { id: "empty", name: "Empty" },
      { id: "three", name: "Three" },
    ],
    cards: [
      blankCard("loose", "Loose", null),
      blankCard("a", "A", "one"),
      blankCard("b", "B", "one"),
      blankCard("c", "C", "one"),
      blankCard("x", "X", "three"),
    ],
  };

  it("goes up and down a column, to its ends, and sideways to the nearest card, past empty columns", () => {
    expect(boardNeighbour(board, "a", "down")).toBe("b");
    expect(boardNeighbour(board, "b", "up")).toBe("a");
    expect(boardNeighbour(board, "a", "up")).toBeNull();
    expect(boardNeighbour(board, "c", "down")).toBeNull();
    expect(boardNeighbour(board, "b", "first")).toBe("a");
    expect(boardNeighbour(board, "a", "first")).toBeNull();
    expect(boardNeighbour(board, "b", "last")).toBe("c");
    expect(boardNeighbour(board, "c", "last")).toBeNull();
    expect(boardNeighbour(board, "c", "right")).toBe("x");
    expect(boardNeighbour(board, "c", "left")).toBe("loose");
    expect(boardNeighbour(board, "x", "left")).toBe("a");
    expect(boardNeighbour(board, "x", "right")).toBeNull();
    expect(boardNeighbour(board, "loose", "left")).toBeNull();
    expect(boardNeighbour(board, "gone", "down")).toBeNull();
  });
});
