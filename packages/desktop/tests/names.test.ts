import { DocumentError, StorageError } from "@eisenhower/model";
import { EisenhowerPluginError } from "@eisenhower/tauri";
import { describe, expect, it } from "vitest";

import { mayClose } from "../src/host/closing";
import { messageOf } from "../src/host/messages";
import { baseName, DOCUMENT_EXTENSION, documentName, fileName, folderOf, OPEN_EXTENSIONS } from "../src/host/names";

describe("names of files", () => {
  it("takes a path apart on every system", () => {
    expect(baseName("C:\\Plans\\Garden.json")).toBe("Garden.json");
    expect(baseName("/home/ada/Garden.json")).toBe("Garden.json");
    expect(folderOf("C:\\Plans\\Garden.json")).toBe("C:\\Plans");
    expect(folderOf("/home/ada/Garden.json")).toBe("/home/ada");
    expect(folderOf("/Garden.json")).toBe("/");
    expect(folderOf("Garden.json")).toBe("");
  });

  it("makes a .ike file name from a document's name or a file's", () => {
    expect(fileName("Garden: spring?")).toBe("Garden spring.ike");
    expect(fileName("plan.JSON")).toBe("plan.ike");
    expect(fileName("plan.ike")).toBe("plan.ike");
    expect(fileName("notes.v2")).toBe("notes.v2.ike");
    expect(fileName("***")).toBe("document.ike");
    expect(fileName(".json")).toBe("document.ike");
  });

  it("names a document without .ike or .json, and opens both", () => {
    expect(documentName("C:\\Plans\\Garden.ike")).toBe("Garden");
    expect(documentName("/home/ada/Garden.JSON")).toBe("Garden");
    expect(documentName("/home/ada/notes.v2.txt")).toBe("notes.v2.txt");
    expect(documentName("/home/ada/.ike")).toBe(".ike");
    expect(DOCUMENT_EXTENSION).toBe("ike");
    expect(OPEN_EXTENSIONS).toEqual(["ike", "json"]);
  });
});

describe("the failures, in words", () => {
  it("says what went wrong from the error", () => {
    expect(messageOf(new DocumentError("newerVersion"), "a.json", "")).toBe(
      "a.json could not be opened. It was written by a newer version of Eisenhower.",
    );
    const plugin = new EisenhowerPluginError("not_text", { path: "/a.json" });
    expect(messageOf(plugin, "a.json", "")).toBe("a.json is not a text file.");
    expect(messageOf(new StorageError("writeFailed", "/a.json", "x", { cause: plugin }), "a.json", "")).toBe(
      "a.json is not a text file.",
    );
    expect(messageOf(new StorageError("changed", "/a.json"), "a.json", "")).toBe(
      "a.json was changed elsewhere, so it was not overwritten.",
    );
    expect(messageOf(new Error("boom"), "a.json", "{name} could not be saved.")).toBe("a.json could not be saved.");
  });
});

describe("closing the window", () => {
  const unsaved = (saved: boolean) => ({ name: "a.json", save: async () => saved });

  it("closes at once with nothing unsaved, else as the user chooses", async () => {
    expect(await mayClose(null, async () => "cancel")).toBe(true);
    expect(await mayClose(unsaved(true), async () => "discard")).toBe(true);
    expect(await mayClose(unsaved(true), async () => "cancel")).toBe(false);
    expect(await mayClose(unsaved(true), async () => "save")).toBe(true);
    expect(await mayClose(unsaved(false), async () => "save")).toBe(false);
  });
});
