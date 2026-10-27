import {
  allTags,
  filterByTags,
  hasTag,
  isOverdue,
  itemsInQuadrant,
  QUADRANTS,
  quadrantFlags,
  quadrantOf,
  quadrantToward,
  shownItems,
  subtaskProgress,
  subtasksOf,
  todoOutline,
} from "../../../src";
import { item, LIST } from "./fixtures";

const ids = (items: readonly { id: string }[]) => items.map((one) => one.id);

describe("the matrix's quadrants", () => {
  it("places an item by its flags", () => {
    expect(quadrantOf({ urgent: true, important: true })).toBe("do");
    expect(quadrantOf({ urgent: false, important: true })).toBe("schedule");
    expect(quadrantOf({ urgent: true, important: false })).toBe("delegate");
    expect(quadrantOf({ urgent: false, important: false })).toBe("drop");
    for (const quadrant of QUADRANTS) expect(quadrantOf(quadrantFlags(quadrant))).toBe(quadrant);
  });

  it("finds the quadrant beside one in the grid, urgent on the left and important at the top", () => {
    expect(quadrantToward("do", "right")).toBe("schedule");
    expect(quadrantToward("do", "down")).toBe("delegate");
    expect(quadrantToward("drop", "up")).toBe("schedule");
    expect(quadrantToward("drop", "left")).toBe("delegate");
    expect(quadrantToward("do", "up")).toBeNull();
    expect(quadrantToward("do", "left")).toBeNull();
    expect(quadrantToward("drop", "down")).toBeNull();
    expect(quadrantToward("drop", "right")).toBeNull();
  });

  it("lists a quadrant's items in the list's order, subtasks by their own flags", () => {
    expect(ids(itemsInQuadrant(LIST, "do"))).toEqual(["b"]);
    expect(ids(itemsInQuadrant(LIST, "schedule"))).toEqual(["a", "a1"]);
    expect(ids(itemsInQuadrant(LIST, "delegate"))).toEqual(["a2"]);
    expect(ids(itemsInQuadrant(LIST, "drop"))).toEqual(["c"]);
  });
});

describe("the outline", () => {
  it("puts each subtask after its parent, wherever it is stored", () => {
    const list = { items: [item("s", "Sub", { parentId: "p" }), item("q", "Other"), item("p", "Parent")] };
    expect(ids(todoOutline(list))).toEqual(["q", "p", "s"]);
  });

  it("keeps the items of a list that is not valid, at the top level", () => {
    const list = {
      items: [
        item("x", "Orphan", { parentId: "gone" }),
        item("y", "Self", { parentId: "y" }),
        item("p", "Parent"),
        item("s", "Sub", { parentId: "p" }),
        item("t", "Deeper", { parentId: "s" }),
      ],
    };
    expect(ids(todoOutline(list))).toEqual(["x", "y", "p", "s", "t"]);
  });

  it("gives an item's subtasks and how many are done", () => {
    expect(ids(subtasksOf(LIST, "a"))).toEqual(["a1", "a2"]);
    expect(subtaskProgress(LIST, "a")).toEqual({ done: 1, total: 2 });
    expect(subtaskProgress(LIST, "b")).toEqual({ done: 0, total: 0 });
  });
});

describe("tags", () => {
  it("lists every tag once, ignoring case, in alphabetical order", () => {
    expect(allTags(LIST)).toEqual(["Home", "Leisure", "Travel", "Weekend"]);
    expect(allTags({ items: [] })).toEqual([]);
  });

  it("matches a tag ignoring case and the spaces around it", () => {
    expect(hasTag({ tags: ["Home"] }, " home ")).toBe(true);
    expect(hasTag({ tags: ["Home"] }, "Homes")).toBe(false);
  });

  it("keeps the items that have any of the tags given", () => {
    expect(ids(filterByTags(LIST.items, ["weekend"]))).toEqual(["a2", "c"]);
    expect(ids(filterByTags(LIST.items, ["weekend", "HOME"]))).toEqual(["a", "a2", "c"]);
    expect(ids(filterByTags(LIST.items, ["Travel", "leisure"]))).toEqual(["b", "c"]);
    expect(ids(filterByTags(LIST.items, []))).toEqual(ids(LIST.items));
  });
});

describe("due days", () => {
  it("says an item not done is overdue after its day", () => {
    const due = item("x", "Post the letter", { due: "2026-11-02" });
    expect(isOverdue(due, "2026-11-03")).toBe(true);
    expect(isOverdue(due, "2026-11-02")).toBe(false);
    expect(isOverdue({ ...due, done: true }, "2026-12-01")).toBe(false);
    expect(isOverdue({ ...due, due: null }, "2026-12-01")).toBe(false);
  });
});

describe("the items shown", () => {
  it("shows everything by default", () => {
    expect(ids(shownItems(LIST))).toEqual(["a", "a1", "a2", "b", "c"]);
  });

  it("hides done items, and keeps a done parent for the subtasks shown", () => {
    expect(ids(shownItems(LIST, { hideDone: true }))).toEqual(["a", "a2", "b"]);
    const list = { items: [item("p", "Parent", { done: true }), item("s", "Sub", { parentId: "p" })] };
    expect(ids(shownItems(list, { hideDone: true }))).toEqual(["p", "s"]);
  });

  it("filters by tags, keeping the parent of a subtask that matches", () => {
    expect(ids(shownItems(LIST, { tags: ["Weekend"] }))).toEqual(["a", "a2", "c"]);
    expect(ids(shownItems(LIST, { tags: ["Weekend"], hideDone: true }))).toEqual(["a", "a2"]);
    expect(ids(shownItems(LIST, { tags: ["Nothing"] }))).toEqual([]);
  });
});
