/** A card's dialog values, from jerome's plot-edit.test.ts ("a beat's dialog"), made generic. */
import { cardDraft, cardFromDraft } from "../../../src/board/draft";
import { BOARD, card } from "./host";

describe("a card's dialog", () => {
  it("lists every problem at once", () => {
    const draft = { ...cardDraft(card("x", "X", "todo")), title: " ", colour: "9", columnId: "gone" };
    expect(cardFromDraft(draft, "x", BOARD)).toEqual({ problems: ["titleBlank", "column", "colour"] });
    expect(
      cardFromDraft(
        { ...draft, title: "x".repeat(121), summary: "y".repeat(501), columnId: "", colour: "1.5" },
        "x",
        BOARD,
      ),
    ).toEqual({ problems: ["titleTooLong", "summaryTooLong", "colour"] });
  });

  it("stores a trimmed title, a summary on one line, the column or none, and a colour index", () => {
    expect(cardFromDraft({ title: " Turn ", summary: " a\r\nb ", columnId: "", colour: "3" }, "x", BOARD)).toEqual({
      card: { id: "x", title: "Turn", columnId: null, summary: "a b", colour: 3 },
    });
    expect(cardDraft(card("x", "X", null, { colour: 0, summary: "S" }))).toEqual({
      title: "X",
      summary: "S",
      columnId: "",
      colour: "0",
    });
    expect(cardFromDraft(cardDraft(BOARD.cards[1]!), "outline", BOARD)).toEqual({ card: BOARD.cards[1] });
  });
});
