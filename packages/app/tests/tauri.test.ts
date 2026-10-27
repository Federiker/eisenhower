import { type Board, boardDocument, DocumentError, serialiseDocument, StorageError } from "@eisenhower/model";
import { EisenhowerPluginError } from "@eisenhower/tauri";
import { describe, expect, it } from "vitest";

import { Cancelled, type OpenDocument } from "../src/host/host";
import { messageOf, storedProblem } from "../src/host/messages";
import { fileName } from "../src/host/names";
import { tauriHost } from "../src/host/tauri";
import { type Call, mockTauri } from "./ipc";

const HASH = "a".repeat(64);
const NEW_HASH = "b".repeat(64);
const board: Board = {
  columns: [{ id: "c1", name: "Ideas" }],
  cards: [{ id: "k1", title: "Paint the fence", columnId: "c1", summary: "", colour: null }],
};
const text = serialiseDocument(boardDocument, board);
const path = "C:\\Plans\\Garden.json";
const onDisk: OpenDocument<Board> = { data: board, name: "Garden.json", key: path, revision: HASH };
const filters = [{ name: "Eisenhower documents", extensions: ["json"] }];
const changed = { code: "changed_on_disk", params: { path, expectedHash: HASH, actualHash: "c".repeat(64) } };

const commands = (calls: Call[]) => calls.map((call) => call.command);

describe("the Tauri host", () => {
  it("starts each view on its sample, on no file", async () => {
    const calls = mockTauri(() => null);
    const sample = { data: board, name: "Sample" };
    expect(await tauriHost().start("board", boardDocument, sample)).toBe(sample);
    expect(calls).toEqual([]);
  });

  it("opens a document chosen in the dialog, keeping its path and hash", async () => {
    const calls = mockTauri(({ command }) => (command === "plugin:dialog|open" ? path : { text, hash: HASH }));
    expect(await tauriHost().open?.(boardDocument)).toEqual(onDisk);
    expect(calls[0]?.args).toEqual({ options: { multiple: false, directory: false, filters } });
    expect(calls[1]).toMatchObject({ command: "plugin:eisenhower|read_document", args: { path } });
  });

  it("opens nothing when the dialog is cancelled", async () => {
    const calls = mockTauri(() => null);
    expect(await tauriHost().open?.(boardDocument)).toBeNull();
    expect(commands(calls)).toEqual(["plugin:dialog|open"]);
  });

  it("refuses a document of another view, saying why in words", async () => {
    const gantt = JSON.stringify({ format: "eisenhower", kind: "gantt", version: 1, data: { groups: [], tasks: [] } });
    mockTauri(({ command }) => (command === "plugin:dialog|open" ? path : { text: gantt, hash: HASH }));
    const error = await tauriHost()
      .open?.(boardDocument)
      .catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(DocumentError);
    expect(messageOf(error, "Garden.json", "")).toBe(
      "Garden.json could not be opened. It is a document of another view; open it on that view's tab.",
    );
  });

  it("says when a file is not text, or is no longer there", async () => {
    mockTauri(({ command }) => {
      if (command === "plugin:dialog|open") return path;
      throw { code: "not_text", params: { path } };
    });
    let error = await tauriHost()
      .open?.(boardDocument)
      .catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(StorageError);
    expect(messageOf(error, "Garden.json", "")).toBe("Garden.json is not a text file.");

    mockTauri(({ command }) => (command === "plugin:dialog|open" ? path : null));
    error = await tauriHost()
      .open?.(boardDocument)
      .catch((cause: unknown) => cause);
    expect(messageOf(error, "Garden.json", "")).toBe("Garden.json could not be read.");
  });

  it("saves where the document was read, quoting its hash", async () => {
    const calls = mockTauri(() => NEW_HASH);
    expect(await tauriHost().save(onDisk, boardDocument)).toEqual({ ...onDisk, revision: NEW_HASH });
    expect(calls).toMatchObject([
      { command: "plugin:eisenhower|write_document", args: { path, text, expectedHash: HASH } },
    ]);
  });

  it("asks before overwriting a file another program changed, and overwrites it on yes", async () => {
    let writes = 0;
    const calls = mockTauri(({ command }) => {
      if (command === "plugin:dialog|message") return "Overwrite";
      writes += 1;
      if (writes === 1) throw changed;
      return NEW_HASH;
    });
    expect((await tauriHost().save(onDisk, boardDocument)).revision).toBe(NEW_HASH);
    expect(commands(calls)).toEqual([
      "plugin:eisenhower|write_document",
      "plugin:dialog|message",
      "plugin:eisenhower|write_document",
    ]);
    expect(calls[1]?.args).toMatchObject({
      title: "The file has changed",
      kind: "warning",
      buttons: { OkCancelCustom: ["Overwrite", "Cancel"] },
    });
    expect(calls[2]?.args).toEqual({ path, text });
  });

  it("leaves a file another program changed alone when the user says no", async () => {
    const calls = mockTauri(({ command }) => {
      if (command === "plugin:dialog|message") return "Cancel";
      throw changed;
    });
    const error = await tauriHost()
      .save(onDisk, boardDocument)
      .catch((cause: unknown) => cause);
    expect(error).toMatchObject({ problem: "changed" });
    expect(messageOf(error, "Garden.json", "")).toBe(
      "Garden.json was changed by another program, so it was not overwritten.",
    );
    expect(commands(calls)).toEqual(["plugin:eisenhower|write_document", "plugin:dialog|message"]);
  });

  it("passes other failures on without asking, with a message from their code", async () => {
    const calls = mockTauri(() => {
      throw { code: "write_failed", params: { path, detail: "Access is denied." } };
    });
    const error = await tauriHost()
      .save(onDisk, boardDocument)
      .catch((cause: unknown) => cause);
    expect(error).toMatchObject({ problem: "writeFailed" });
    expect(messageOf(error, "Garden.json", "")).toBe("Garden.json could not be written; the file is as it was.");
    expect(commands(calls)).toEqual(["plugin:eisenhower|write_document"]);
  });

  it("asks where to save a document that has no file yet, and writes it whatever is there", async () => {
    const calls = mockTauri(({ command }) => (command === "plugin:dialog|save" ? "D:\\Out\\Moving.json" : NEW_HASH));
    const stored = await tauriHost().save({ data: board, name: "Moving house" }, boardDocument);
    expect(stored).toEqual({ data: board, name: "Moving.json", key: "D:\\Out\\Moving.json", revision: NEW_HASH });
    expect(calls[0]?.args).toEqual({ options: { defaultPath: "Moving house.json", filters } });
    expect(calls[1]?.args).toEqual({ path: "D:\\Out\\Moving.json", text });
  });

  it("offers the document's own file for Save as, and saves nothing when it is cancelled", async () => {
    const calls = mockTauri(() => null);
    await expect(tauriHost().saveAs?.(onDisk, boardDocument)).rejects.toBeInstanceOf(Cancelled);
    expect(calls[0]?.args).toEqual({ options: { defaultPath: path, filters } });
    expect(commands(calls)).toEqual(["plugin:dialog|save"]);
  });

  it("asks its questions with Tauri's dialog", async () => {
    const calls = mockTauri(() => "Discard");
    const question = { title: "Unsaved changes", message: "Discard them?", ok: "Discard", cancel: "Cancel" };
    expect(await tauriHost().ask(question)).toBe(true);
    expect(calls[0]?.args).toMatchObject({
      message: "Discard them?",
      buttons: { OkCancelCustom: ["Discard", "Cancel"] },
    });
  });
});

describe("the messages", () => {
  it("say what failed from the plugin's code, the storage's problem, or the fallback", () => {
    expect(messageOf(new EisenhowerPluginError("internal", { detail: "x" }), "a.json", "")).toBe(
      "The work could not be finished.",
    );
    expect(messageOf(new StorageError("unavailable", "board"), "Moving house", "")).toBe(
      "This browser does not let the app keep documents.",
    );
    expect(messageOf(new Error("boom"), "a.json", "{name} could not be saved.")).toBe("a.json could not be saved.");
  });

  it("say why a stored copy could not be read", () => {
    expect(storedProblem(new DocumentError("notJson"), "Moving house")).toBe(
      "The stored copy of Moving house could not be read. It is not JSON. The sample is shown; Reset to the sample to replace the stored copy.",
    );
    expect(storedProblem(new Error("?"), "Moving house")).toBe(
      "The stored copy of Moving house could not be read. The sample is shown; Reset to the sample to replace the stored copy.",
    );
  });

  it("name files from documents", () => {
    expect(fileName("Moving house")).toBe("Moving house.json");
    expect(fileName('What: "next"?')).toBe("What next.json");
    expect(fileName("plan.JSON")).toBe("plan.JSON");
    expect(fileName("///")).toBe("document.json");
  });
});
