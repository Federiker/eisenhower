import {
  addItem,
  addItemTag,
  deleteItem,
  indentItem,
  MAX_TAGS,
  MAX_TODO_NOTES_LENGTH,
  MAX_TODO_TITLE_LENGTH,
  moveItem,
  outdentItem,
  removeItemTag,
  renameItem,
  setItemDone,
  setItemDue,
  setItemNotes,
  setItemQuadrant,
  setItemTags,
  stepItem,
  type TodoList,
  todoDocument,
  toggleItemDone,
} from "../../../src";
import { item, LIST, ok, titles } from "./fixtures";

const find = (list: TodoList, id: string) => list.items.find((one) => one.id === id)!;

/** Every edit's result is a list its document kind still accepts. */
function valid(list: TodoList): TodoList {
  expect(todoDocument.schema.safeParse(list).success).toBe(true);
  expect(todoDocument.problems?.(list)).toEqual([]);
  return list;
}

describe("adding an item", () => {
  it("adds at the end, trimmed, with plain fields", () => {
    const list = valid(ok(addItem(LIST, { id: "n", title: "  Water the plants " })));
    expect(titles(list).at(-1)).toBe("Water the plants");
    expect(find(list, "n")).toEqual(item("n", "Water the plants"));
  });

  it("adds a subtask at the end of its parent's, with the parent's flags unless told", () => {
    const list = valid(ok(addItem(LIST, { id: "n", title: "Clean brushes" }, { parentId: "a" })));
    expect(titles(list)).toEqual([
      "Paint the shed",
      "-Buy paint",
      "-Sand the walls",
      "-Clean brushes",
      "Book flights",
      "Read a novel",
    ]);
    expect(find(list, "n")).toMatchObject({ parentId: "a", urgent: false, important: true });
    const urgent = ok(addItem(LIST, { id: "n", title: "Clean brushes", urgent: true }, { parentId: "b" }));
    expect(find(urgent, "n")).toMatchObject({ parentId: "b", urgent: true, important: true });
  });

  it("adds just after an item, after a top-level item's subtasks", () => {
    expect(titles(ok(addItem(LIST, { id: "n", title: "New" }, { after: "a" })))).toEqual([
      "Paint the shed",
      "-Buy paint",
      "-Sand the walls",
      "New",
      "Book flights",
      "Read a novel",
    ]);
    expect(titles(ok(addItem(LIST, { id: "n", title: "New" }, { after: "a1" })))).toEqual([
      "Paint the shed",
      "-Buy paint",
      "-New",
      "-Sand the walls",
      "Book flights",
      "Read a novel",
    ]);
  });

  it("keeps the fields it is given, cleaned", () => {
    const list = valid(
      ok(
        addItem(LIST, {
          id: "n",
          title: "Call the bank",
          done: true,
          due: "2026-11-30",
          notes: " Ask about\r\nthe card ",
          tags: [" Money", "money", " "],
          urgent: true,
          important: false,
        }),
      ),
    );
    expect(find(list, "n")).toEqual(
      item("n", "Call the bank", {
        done: true,
        due: "2026-11-30",
        notes: "Ask about\nthe card",
        tags: ["Money"],
        urgent: true,
      }),
    );
  });

  it("refuses what it cannot add, saying why", () => {
    expect(addItem(LIST, { id: "", title: "New" })).toEqual({ ok: false, reason: "invalid" });
    expect(addItem(LIST, { id: "a", title: "New" })).toEqual({ ok: false, reason: "duplicate" });
    expect(addItem(LIST, { id: "n", title: "  " })).toEqual({ ok: false, reason: "blank" });
    expect(addItem(LIST, { id: "n", title: "x".repeat(MAX_TODO_TITLE_LENGTH + 1) })).toEqual({
      ok: false,
      reason: "tooLong",
    });
    expect(addItem(LIST, { id: "n", title: "New", notes: "x".repeat(MAX_TODO_NOTES_LENGTH + 1) })).toEqual({
      ok: false,
      reason: "tooLong",
    });
    expect(addItem(LIST, { id: "n", title: "New", tags: ["a\nb"] })).toEqual({ ok: false, reason: "invalid" });
    expect(addItem(LIST, { id: "n", title: "New", due: "2026-02-30" })).toEqual({ ok: false, reason: "invalid" });
    expect(addItem(LIST, { id: "n", title: "New" }, { after: "gone" })).toEqual({ ok: false, reason: "missing" });
    expect(addItem(LIST, { id: "n", title: "New" }, { parentId: "gone" })).toEqual({ ok: false, reason: "missing" });
    expect(addItem(LIST, { id: "n", title: "New" }, { parentId: "a1" })).toEqual({ ok: false, reason: "limit" });
  });
});

describe("editing an item's fields", () => {
  it("renames, trimmed", () => {
    expect(find(ok(renameItem(LIST, "b", " Book trains ")), "b").title).toBe("Book trains");
    expect(renameItem(LIST, "b", "")).toEqual({ ok: false, reason: "blank" });
    expect(renameItem(LIST, "gone", "Title")).toEqual({ ok: false, reason: "missing" });
  });

  it("sets notes of several lines, up to the limit", () => {
    expect(find(ok(setItemNotes(LIST, "b", "Window seat\r\nAisle if not")), "b").notes).toBe(
      "Window seat\nAisle if not",
    );
    expect(find(ok(setItemNotes(LIST, "b", "😀".repeat(MAX_TODO_NOTES_LENGTH))), "b").notes).toHaveLength(
      MAX_TODO_NOTES_LENGTH * 2,
    );
    expect(setItemNotes(LIST, "b", "x".repeat(MAX_TODO_NOTES_LENGTH + 1))).toEqual({ ok: false, reason: "tooLong" });
  });

  it("sets and clears the due day", () => {
    expect(find(ok(setItemDue(LIST, "c", "2027-01-01")), "c").due).toBe("2027-01-01");
    expect(find(ok(setItemDue(LIST, "b", null)), "b").due).toBeNull();
    expect(setItemDue(LIST, "b", "tomorrow")).toEqual({ ok: false, reason: "invalid" });
    expect(setItemDue(LIST, "gone", null)).toEqual({ ok: false, reason: "missing" });
  });

  it("sets the tags, each once ignoring case", () => {
    expect(find(ok(setItemTags(LIST, "b", ["Work", " work", "", "Abroad "])), "b").tags).toEqual(["Work", "Abroad"]);
    expect(setItemTags(LIST, "b", ["x".repeat(41)])).toEqual({ ok: false, reason: "tooLong" });
    const many = Array.from({ length: MAX_TAGS + 1 }, (_, n) => `tag ${n}`);
    expect(setItemTags(LIST, "b", many)).toEqual({ ok: false, reason: "limit" });
  });

  it("adds and removes one tag", () => {
    expect(find(ok(addItemTag(LIST, "b", " Work ")), "b").tags).toEqual(["Travel", "Work"]);
    expect(addItemTag(LIST, "b", "travel")).toEqual({ ok: false, reason: "duplicate" });
    expect(addItemTag(LIST, "b", " ")).toEqual({ ok: false, reason: "blank" });
    expect(addItemTag(LIST, "gone", "Work")).toEqual({ ok: false, reason: "missing" });
    const full = { items: [item("f", "Full", { tags: Array.from({ length: MAX_TAGS }, (_, n) => `t${n}`) })] };
    expect(addItemTag(full, "f", "one more")).toEqual({ ok: false, reason: "limit" });
    expect(find(ok(removeItemTag(LIST, "a2", "HOME")), "a2").tags).toEqual(["Weekend"]);
    expect(removeItemTag(LIST, "a2", "Travel")).toEqual({ ok: false, reason: "missing" });
    expect(removeItemTag(LIST, "gone", "Travel")).toEqual({ ok: false, reason: "missing" });
  });

  it("ticks only the item: a parent's subtasks keep theirs", () => {
    const ticked = valid(ok(setItemDone(LIST, "a", true)));
    expect(ticked.items.map((one) => one.done)).toEqual([true, true, false, false, true]);
    expect(find(ok(toggleItemDone(LIST, "c")), "c").done).toBe(false);
    expect(find(ok(toggleItemDone(LIST, "b")), "b").done).toBe(true);
    expect(toggleItemDone(LIST, "gone")).toEqual({ ok: false, reason: "missing" });
  });

  it("moves an item between quadrants by its flags, not its subtasks'", () => {
    const list = ok(setItemQuadrant(LIST, "a", "delegate"));
    expect(find(list, "a")).toMatchObject({ urgent: true, important: false });
    expect(find(list, "a1")).toMatchObject({ urgent: false, important: true });
    expect(find(ok(setItemQuadrant(LIST, "b", "drop")), "b")).toMatchObject({ urgent: false, important: false });
  });
});

describe("moving an item", () => {
  it("steps a top-level item past the one beside it, with its subtasks", () => {
    expect(titles(valid(ok(stepItem(LIST, "b", "up"))))).toEqual([
      "Book flights",
      "Paint the shed",
      "-Buy paint",
      "-Sand the walls",
      "Read a novel",
    ]);
    expect(titles(ok(stepItem(LIST, "a", "down")))).toEqual([
      "Book flights",
      "Paint the shed",
      "-Buy paint",
      "-Sand the walls",
      "Read a novel",
    ]);
    expect(stepItem(LIST, "a", "up")).toEqual({ ok: false, reason: "order" });
    expect(stepItem(LIST, "c", "down")).toEqual({ ok: false, reason: "order" });
    expect(stepItem(LIST, "gone", "down")).toEqual({ ok: false, reason: "missing" });
  });

  it("steps a subtask among its parent's only", () => {
    expect(titles(ok(stepItem(LIST, "a2", "up")))).toEqual([
      "Paint the shed",
      "-Sand the walls",
      "-Buy paint",
      "Book flights",
      "Read a novel",
    ]);
    expect(stepItem(LIST, "a1", "up")).toEqual({ ok: false, reason: "order" });
    expect(stepItem(LIST, "a2", "down")).toEqual({ ok: false, reason: "order" });
  });

  it("moves an item to a place under any parent, as dragging does", () => {
    expect(titles(valid(ok(moveItem(LIST, "c", "a", 1))))).toEqual([
      "Paint the shed",
      "-Buy paint",
      "-Read a novel",
      "-Sand the walls",
      "Book flights",
    ]);
    expect(titles(ok(moveItem(LIST, "a1", null, 0)))).toEqual([
      "Buy paint",
      "Paint the shed",
      "-Sand the walls",
      "Book flights",
      "Read a novel",
    ]);
    expect(titles(ok(moveItem(LIST, "b", "a", 99)))).toEqual([
      "Paint the shed",
      "-Buy paint",
      "-Sand the walls",
      "-Book flights",
      "Read a novel",
    ]);
    expect(titles(ok(moveItem(LIST, "a", null, -3)))).toEqual(titles(LIST));
    expect(titles(ok(moveItem(LIST, "c", "b", 0)))).toEqual([
      "Paint the shed",
      "-Buy paint",
      "-Sand the walls",
      "Book flights",
      "-Read a novel",
    ]);
  });

  it("refuses a move that would make subtasks of subtasks", () => {
    expect(moveItem(LIST, "a", "b", 0)).toEqual({ ok: false, reason: "limit" });
    expect(moveItem(LIST, "c", "a1", 0)).toEqual({ ok: false, reason: "limit" });
    expect(moveItem(LIST, "a", "a", 0)).toEqual({ ok: false, reason: "missing" });
    expect(moveItem(LIST, "c", "gone", 0)).toEqual({ ok: false, reason: "missing" });
    expect(moveItem(LIST, "gone", null, 0)).toEqual({ ok: false, reason: "missing" });
  });

  it("indents an item under the one above, and outdents it after its parent's subtasks", () => {
    const indented = valid(ok(indentItem(LIST, "c")));
    expect(titles(indented)).toEqual([
      "Paint the shed",
      "-Buy paint",
      "-Sand the walls",
      "Book flights",
      "-Read a novel",
    ]);
    expect(titles(ok(indentItem(LIST, "b")))).toEqual([
      "Paint the shed",
      "-Buy paint",
      "-Sand the walls",
      "-Book flights",
      "Read a novel",
    ]);
    expect(titles(valid(ok(outdentItem(LIST, "a1"))))).toEqual([
      "Paint the shed",
      "-Sand the walls",
      "Buy paint",
      "Book flights",
      "Read a novel",
    ]);
    expect(titles(ok(outdentItem(indented, "c")))).toEqual(titles(LIST));
  });

  it("refuses to indent the first item, a subtask or a parent, or to outdent a top-level item", () => {
    expect(indentItem(LIST, "a")).toEqual({ ok: false, reason: "limit" });
    expect(indentItem(LIST, "a1")).toEqual({ ok: false, reason: "limit" });
    expect(indentItem({ items: [item("x", "First")] }, "x")).toEqual({ ok: false, reason: "order" });
    expect(indentItem(LIST, "gone")).toEqual({ ok: false, reason: "missing" });
    expect(outdentItem(LIST, "b")).toEqual({ ok: false, reason: "order" });
    expect(outdentItem(LIST, "gone")).toEqual({ ok: false, reason: "missing" });
  });
});

describe("deleting an item", () => {
  it("deletes an item, and a parent with its subtasks", () => {
    expect(titles(valid(ok(deleteItem(LIST, "b"))))).toEqual([
      "Paint the shed",
      "-Buy paint",
      "-Sand the walls",
      "Read a novel",
    ]);
    expect(titles(ok(deleteItem(LIST, "a")))).toEqual(["Book flights", "Read a novel"]);
    expect(titles(ok(deleteItem(LIST, "a1")))).toEqual([
      "Paint the shed",
      "-Sand the walls",
      "Book flights",
      "Read a novel",
    ]);
  });

  it("keeps a parent's subtasks at the top level where they were, when asked", () => {
    expect(titles(valid(ok(deleteItem(LIST, "a", "keep"))))).toEqual([
      "Buy paint",
      "Sand the walls",
      "Book flights",
      "Read a novel",
    ]);
    expect(deleteItem(LIST, "gone")).toEqual({ ok: false, reason: "missing" });
  });
});
