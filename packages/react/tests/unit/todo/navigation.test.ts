import { describe, expect, it } from "vitest";

import { actionOf, describeShortcut, SHORTCUTS, shortcutsIn } from "../../../src";
import { listNeighbour, matrixNeighbour } from "../../../src/todo/navigation";

const press = (key: string, extra: Partial<KeyboardEvent> = {}) => ({
  key,
  code: "",
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  isComposing: false,
  ...extra,
});

describe("the todo list's keys", () => {
  it("add Space to tick, and leave the common keys as they are", () => {
    const keys = shortcutsIn("todo");
    expect(actionOf(press(" "), keys, false)).toBe("toggleDone");
    expect(actionOf(press(" "), shortcutsIn(), false)).toBeNull();
    expect(actionOf(press("ArrowRight", { altKey: true }), keys, false)).toBe("moveRight");
    const toggle = SHORTCUTS.find((one) => one.action === "toggleDone")!;
    expect(describeShortcut(toggle, false)).toBe("Space");
  });
});

describe("the focus in the list", () => {
  const ids = ["a", "b", "c"];

  it("goes to the item before or after, the first or the last", () => {
    expect(listNeighbour(ids, "b", "focusUp")).toBe("a");
    expect(listNeighbour(ids, "b", "focusDown")).toBe("c");
    expect(listNeighbour(ids, "b", "focusFirst")).toBe("a");
    expect(listNeighbour(ids, "b", "focusLast")).toBe("c");
  });

  it("goes nowhere past an end, sideways or from an item not shown", () => {
    expect(listNeighbour(ids, "a", "focusUp")).toBeNull();
    expect(listNeighbour(ids, "c", "focusDown")).toBeNull();
    expect(listNeighbour(ids, "a", "focusFirst")).toBeNull();
    expect(listNeighbour(ids, "b", "focusLeft")).toBeNull();
    expect(listNeighbour(ids, "z", "focusDown")).toBeNull();
  });
});

describe("the focus in the matrix", () => {
  const quadrants = { do: ["d1", "d2", "d3"], schedule: ["s1"], delegate: [], drop: ["p1", "p2"] };

  it("goes up and down a quadrant and on to the one above or below", () => {
    expect(matrixNeighbour(quadrants, "d1", "focusDown")).toBe("d2");
    expect(matrixNeighbour(quadrants, "d2", "focusUp")).toBe("d1");
    expect(matrixNeighbour(quadrants, "s1", "focusDown")).toBe("p1");
    expect(matrixNeighbour(quadrants, "p1", "focusUp")).toBe("s1");
    expect(matrixNeighbour(quadrants, "d3", "focusDown")).toBeNull();
    expect(matrixNeighbour(quadrants, "d1", "focusUp")).toBeNull();
  });

  it("goes across to the item at the same place, or the last, in the quadrant beside", () => {
    expect(matrixNeighbour(quadrants, "d3", "focusRight")).toBe("s1");
    expect(matrixNeighbour(quadrants, "s1", "focusLeft")).toBe("d1");
    expect(matrixNeighbour(quadrants, "p2", "focusLeft")).toBeNull();
    expect(matrixNeighbour(quadrants, "d1", "focusLeft")).toBeNull();
  });

  it("goes to the quadrant's first and last with Home and End", () => {
    expect(matrixNeighbour(quadrants, "d2", "focusFirst")).toBe("d1");
    expect(matrixNeighbour(quadrants, "d2", "focusLast")).toBe("d3");
    expect(matrixNeighbour(quadrants, "gone", "focusLast")).toBeNull();
  });
});
