import { DocumentError, memoryStorage, StorageError, serialiseDocument, todoDocument } from "@eisenhower/model";
import { describe, expect, it } from "vitest";

import { emptyDocument, loadAnyDocument, NEW_TYPES, parseAnyDocument, saveAnyDocument } from "../src/documents";

/** The problem a text is refused with, or null when it is read. */
function problemOf(text: string) {
  try {
    parseAnyDocument(text);
  } catch (error) {
    return error instanceof DocumentError ? error.problem : error;
  }
  return null;
}

describe("the documents of any view", () => {
  it("makes an empty document of each type, which saves and reads back as it was", async () => {
    const storage = memoryStorage();
    for (const type of NEW_TYPES) {
      const document = emptyDocument(type);
      await saveAnyDocument(storage, `/plans/${type}.json`, document);
      const loaded = await loadAnyDocument(storage, `/plans/${type}.json`);
      expect(loaded?.document).toEqual(document);
    }
    expect(emptyDocument("timeline-dates")).toMatchObject({ kind: "timeline", data: { kind: "dates" } });
    expect(emptyDocument("timeline-sequence")).toMatchObject({ kind: "timeline", data: { kind: "sequence" } });
    expect(emptyDocument("todo")).toEqual({ kind: "todo", data: { items: [] } });
  });

  it("reads a document's kind from its text", () => {
    const text = serialiseDocument(todoDocument, { items: [] });
    expect(parseAnyDocument(text)).toEqual({ kind: "todo", data: { items: [] } });
  });

  it("refuses a text that is not a document it knows, saying why", () => {
    expect(problemOf("{")).toBe("notJson");
    expect(problemOf("[]")).toBe("notEisenhower");
    expect(problemOf("null")).toBe("notEisenhower");
    expect(problemOf(JSON.stringify({ format: "other", kind: "board" }))).toBe("notEisenhower");
    expect(problemOf(JSON.stringify({ format: "eisenhower", kind: "calendar", version: 1 }))).toBe("wrongKind");
    expect(problemOf(JSON.stringify({ format: "eisenhower", kind: "toString", version: 1 }))).toBe("wrongKind");
    expect(problemOf(JSON.stringify({ format: "eisenhower", kind: "board", version: 1, data: { cards: 3 } }))).toBe(
      "invalid",
    );
  });

  it("answers null for a path with nothing stored", async () => {
    expect(await loadAnyDocument(memoryStorage(), "/nothing.json")).toBeNull();
  });

  it("quotes the revision it read, so a document changed since is not overwritten", async () => {
    const storage = memoryStorage();
    const first = await saveAnyDocument(storage, "/a.json", emptyDocument("board"));
    await saveAnyDocument(storage, "/a.json", emptyDocument("gantt"), first);
    const refused = await saveAnyDocument(storage, "/a.json", emptyDocument("todo"), first).catch(
      (error: unknown) => error,
    );
    expect(refused).toBeInstanceOf(StorageError);
    expect((refused as StorageError).problem).toBe("changed");
  });
});
