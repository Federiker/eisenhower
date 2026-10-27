import { type DocumentKind, loadDocument, StorageError, saveDocument, textRevision } from "@eisenhower/model";
import { clearMocks } from "@tauri-apps/api/mocks";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EisenhowerPluginError, tauriStorage } from "../src/index";
import { mockFiles, mockPlugin } from "./plugin";

type List = { items: string[] };

const listKind: DocumentKind<List> = {
  kind: "todo",
  version: 1,
  schema: z.object({ items: z.array(z.string()) }),
};

async function failure(promise: Promise<unknown>): Promise<StorageError> {
  const error = await promise.catch((cause: unknown) => cause);
  expect(error).toBeInstanceOf(StorageError);
  return error as StorageError;
}

describe("tauriStorage", () => {
  it("reads a file's text with its hash as the revision, and null for no file", async () => {
    mockFiles(new Map([["plan.json", "{}\n"]]));
    const storage = tauriStorage();
    expect(await storage.read("plan.json")).toEqual({ text: "{}\n", revision: await textRevision("{}\n") });
    expect(await storage.read("missing.json")).toBeNull();
  });

  it("loads and saves documents, refusing to overwrite one changed on disk", async () => {
    const files = mockFiles();
    const storage = tauriStorage();
    expect(await loadDocument(storage, "list.json", listKind)).toBeNull();

    const first = await saveDocument(storage, "list.json", listKind, { items: ["one"] });
    const loaded = await loadDocument(storage, "list.json", listKind);
    expect(loaded).toEqual({ data: { items: ["one"] }, revision: first });

    const second = await saveDocument(storage, "list.json", listKind, { items: ["one", "two"] }, first);
    expect(second).toBe(await textRevision(files.get("list.json") ?? ""));

    // Another program saved it, then the old revision is quoted.
    files.set("list.json", "theirs");
    const changed = await failure(saveDocument(storage, "list.json", listKind, { items: [] }, second));
    expect(changed.problem).toBe("changed");
    expect(changed.key).toBe("list.json");
    expect(changed.cause).toBeInstanceOf(EisenhowerPluginError);
    expect(files.get("list.json")).toBe("theirs");

    // A file removed since it was read has changed too.
    files.delete("list.json");
    expect((await failure(storage.write("list.json", "{}", second))).problem).toBe("changed");
    expect(files.has("list.json")).toBe(false);
  });

  it("makes the plugin's other failures read or write failures with the system's words", async () => {
    mockPlugin(() => {
      throw { code: "read_failed", params: { path: "plan.json", detail: "Access is denied." } };
    });
    const storage = tauriStorage();
    const read = await failure(storage.read("plan.json"));
    expect(read).toMatchObject({ problem: "readFailed", key: "plan.json", detail: "Access is denied." });
    expect(read.cause).toMatchObject({ code: "read_failed" });

    mockPlugin(() => {
      throw { code: "write_failed", params: { path: "plan.json", detail: "The disk is full." } };
    });
    expect(await failure(storage.write("plan.json", "{}"))).toMatchObject({
      problem: "writeFailed",
      detail: "The disk is full.",
    });

    mockPlugin(() => {
      throw { code: "not_text", params: { path: "plan.json" } };
    });
    expect(await failure(storage.read("plan.json"))).toMatchObject({
      problem: "readFailed",
      detail: 'not_text {"path":"plan.json"}',
    });
  });

  it("fails rather than answering when there is no Tauri", async () => {
    clearMocks();
    const storage = tauriStorage();
    expect((await failure(storage.read("plan.json"))).problem).toBe("readFailed");
    const write = await failure(storage.write("plan.json", "{}"));
    expect(write.problem).toBe("writeFailed");
    expect(write.cause).toMatchObject({ code: "unknown" });
  });
});
