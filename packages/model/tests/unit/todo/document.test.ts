import { DocumentError, parseDocument, serialiseDocument, type TodoList, todoDocument } from "../../../src";
import { item, LIST } from "./fixtures";

const wrap = (data: unknown) => JSON.stringify({ format: "eisenhower", kind: "todo", version: 1, data });

function details(data: unknown): readonly string[] {
  try {
    parseDocument(todoDocument, wrap(data));
  } catch (error) {
    expect(error).toBeInstanceOf(DocumentError);
    expect((error as DocumentError).problem).toBe("invalid");
    return (error as DocumentError).details;
  }
  throw new Error("the document was accepted");
}

describe("the todo document", () => {
  it("writes a list and reads it back unchanged", () => {
    const text = serialiseDocument(todoDocument, LIST);
    expect(JSON.parse(text)).toMatchObject({ format: "eisenhower", kind: "todo", version: 1 });
    expect(parseDocument(todoDocument, text)).toEqual(LIST);
    expect(parseDocument(todoDocument, serialiseDocument(todoDocument, { items: [] }))).toEqual({ items: [] });
  });

  it("refuses items that break the schema", () => {
    expect(details({ items: [{ ...item("x", "Title"), title: " Title" }] })[0]).toMatch(/^items\.0\.title/);
    expect(details({ items: [item("x", "")] })[0]).toMatch(/title/);
    expect(details({ items: [item("x", "Title", { notes: "x".repeat(251) })] })[0]).toMatch(/notes/);
    expect(details({ items: [item("x", "Title", { tags: [" spaced"] })] })[0]).toMatch(/tags/);
    expect(details({ items: [item("x", "Title", { tags: ["x".repeat(41)] })] })[0]).toMatch(/tags/);
    expect(details({ items: [item("x", "Title", { due: "2026-13-01" })] })[0]).toMatch(/due/);
    expect(details({ items: [{ ...item("x", "Title"), colour: 1 }] })[0]).toMatch(/items\.0/);
    expect(details({ items: [], extra: true })).toHaveLength(1);
  });

  it("refuses ids twice, subtasks of nothing or of subtasks, and a tag twice", () => {
    const list: TodoList = {
      items: [
        item("x", "One"),
        item("x", "Two"),
        item("s", "Sub", { parentId: "x" }),
        item("t", "Deeper", { parentId: "s" }),
        item("o", "Orphan", { parentId: "gone" }),
        item("m", "Myself", { parentId: "m" }),
        item("g", "Tags", { tags: ["Home", "HOME"] }),
      ],
    };
    expect(details(list)).toEqual([
      "item x appears twice",
      "item t is a subtask of a subtask",
      "item o is a subtask of no item",
      "item m is a subtask of no item",
      "item g has a tag twice",
    ]);
  });
});
