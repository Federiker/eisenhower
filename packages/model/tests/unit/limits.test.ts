import { describe, expect, it } from "vitest";

import {
  type Board,
  boardDocument,
  emptyTimeline,
  MAX_SUMMARY_LENGTH,
  MAX_TODO_NOTES_LENGTH,
  parseDocument,
  serialiseDocument,
  type Timeline,
  timelineDocument,
  type TodoList,
  todoDocument,
} from "../../src";

/** A document as written, read again: the stored shape's own check. */
const roundTrip = <T>(kind: Parameters<typeof serialiseDocument<T>>[0], data: T) =>
  parseDocument(kind, serialiseDocument(kind, data));

const board = (summary: string): Board => ({
  columns: [],
  cards: [{ id: "a", title: "Card", columnId: null, summary, colour: null }],
});

const timeline = (summary: string): Timeline => ({
  ...emptyTimeline("dates"),
  categories: [{ id: "c", name: "Lane", colour: 0, line: "solid" }],
  entries: [
    {
      id: "e",
      title: "Entry",
      categoryId: "c",
      start: { year: 1066, month: null, day: null, approximate: false },
      end: null,
      summary,
    },
  ],
});

const todo = (notes: string): TodoList => ({
  items: [
    {
      id: "i",
      title: "Item",
      done: false,
      due: null,
      notes,
      tags: [],
      urgent: false,
      important: false,
      parentId: null,
    },
  ],
});

// Owner, 25 November 2026: descriptions take up to 5,000 characters (summaries were 500, notes 250).
describe("the descriptions' limits", () => {
  it("are 5,000 characters for summaries and notes", () => {
    expect(MAX_SUMMARY_LENGTH).toBe(5000);
    expect(MAX_TODO_NOTES_LENGTH).toBe(5000);
  });

  it("keep a card's and an entry's summary of 5,000 characters, and refuse one longer", () => {
    expect(roundTrip(boardDocument, board("x".repeat(5000))).cards[0]?.summary).toHaveLength(5000);
    expect(() => roundTrip(boardDocument, board("x".repeat(5001)))).toThrow();
    expect(roundTrip(timelineDocument, timeline("x".repeat(5000))).entries[0]?.summary).toHaveLength(5000);
    expect(() => roundTrip(timelineDocument, timeline("x".repeat(5001)))).toThrow();
  });

  it("keep an item's notes of 5,000 characters, and refuse longer", () => {
    expect(roundTrip(todoDocument, todo("x\n".repeat(2500))).items[0]?.notes).toHaveLength(5000);
    expect(() => roundTrip(todoDocument, todo("x".repeat(5001)))).toThrow();
  });
});
