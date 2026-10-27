import { z } from "zod";

import {
  DocumentError,
  type DocumentKind,
  loadDocument,
  localStorageAdapter,
  memoryStorage,
  parseDocument,
  saveDocument,
  serialiseDocument,
  StorageError,
  textRevision,
} from "../../src";

type Note = { title: string; parts: string[] };

const noteKind: DocumentKind<Note> = {
  kind: "todo",
  version: 2,
  schema: z.object({ title: z.string(), parts: z.array(z.string()) }).strict(),
  problems: (note) => (note.parts.includes(note.title) ? ["the title is also a part"] : []),
};

const note: Note = { title: "Plan", parts: ["one"] };

function errorOf(text: string): DocumentError | null {
  try {
    parseDocument(noteKind, text);
  } catch (error) {
    expect(error).toBeInstanceOf(DocumentError);
    return error as DocumentError;
  }
  return null;
}

const wrap = (fields: object) => JSON.stringify({ format: "eisenhower", kind: "todo", version: 2, ...fields });

describe("documents", () => {
  it("writes readable JSON and reads it back", () => {
    const text = serialiseDocument(noteKind, note);
    expect(text).toBe(`${JSON.stringify({ format: "eisenhower", kind: "todo", version: 2, data: note }, null, 2)}\n`);
    expect(parseDocument(noteKind, text)).toEqual(note);
  });

  it("reads documents of an older version", () => {
    expect(parseDocument(noteKind, wrap({ version: 1, data: note }))).toEqual(note);
  });

  it("refuses anything else, saying why", () => {
    expect(errorOf("{")?.problem).toBe("notJson");
    expect(errorOf("[]")?.problem).toBe("notEisenhower");
    expect(errorOf(JSON.stringify({ format: "other" }))?.problem).toBe("notEisenhower");
    expect(errorOf(wrap({ kind: "board" }))?.problem).toBe("wrongKind");
    expect(errorOf(wrap({ version: 3, data: note }))?.problem).toBe("newerVersion");
    expect(errorOf(wrap({ version: 0, data: note }))?.problem).toBe("invalid");
    expect(errorOf(wrap({ version: "2", data: note }))?.problem).toBe("invalid");
    expect(errorOf(wrap({ data: { title: 1, parts: [] } }))?.problem).toBe("invalid");
    expect(errorOf(wrap({ data: { title: "one", parts: ["one"] } }))?.details).toEqual(["the title is also a part"]);
  });

  it("keeps the schema's issues as details for logs", () => {
    const error = errorOf(wrap({ data: {} }));
    expect(error?.details.some((detail) => detail.startsWith("title:"))).toBe(true);
    expect(error?.message).toContain("invalid:");
    expect(errorOf(wrap({ data: 3 }))?.details[0]).toMatch(/^data:/);
  });
});

describe.each([
  ["memory", () => memoryStorage()],
  ["localStorage", () => localStorageAdapter("test:")],
])("%s storage", (_name, make) => {
  beforeEach(() => localStorage.clear());

  it("reads nothing under a new key", async () => {
    expect(await make().read("plan.json")).toBeNull();
    expect(await loadDocument(make(), "plan.json", noteKind)).toBeNull();
  });

  it("saves and loads a document with its revision", async () => {
    const storage = make();
    const revision = await saveDocument(storage, "plan.json", noteKind, note);
    expect(revision).toBe(await textRevision(serialiseDocument(noteKind, note)));
    expect(revision).toMatch(/^[0-9a-f]{64}$/);
    expect(await loadDocument(storage, "plan.json", noteKind)).toEqual({ data: note, revision });
  });

  it("refuses to overwrite a document changed since it was read", async () => {
    const storage = make();
    const first = await saveDocument(storage, "plan.json", noteKind, note);
    const second = await saveDocument(storage, "plan.json", noteKind, { ...note, title: "Other" }, first);
    await expect(saveDocument(storage, "plan.json", noteKind, note, first)).rejects.toMatchObject({
      problem: "changed",
      key: "plan.json",
    });
    await expect(storage.write("new.json", "{}", second)).rejects.toBeInstanceOf(StorageError);
    expect((await storage.read("plan.json"))?.revision).toBe(second);
  });
});

describe("localStorage storage", () => {
  it("keeps keys under its prefix", async () => {
    await localStorageAdapter("app:").write("plan", "text");
    expect(localStorage.getItem("app:plan")).toBe("text");
  });

  it("starts memory storage from the texts given", async () => {
    expect((await memoryStorage({ a: "text" }).read("a"))?.text).toBe("text");
  });

  it("reports a storage that fails", async () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("full");
      },
    } as unknown as Storage;
    const storage = localStorageAdapter("x:", broken);
    await expect(storage.read("a")).rejects.toMatchObject({ problem: "readFailed", detail: "Error: denied" });
    await expect(storage.write("a", "text")).rejects.toMatchObject({ problem: "writeFailed" });
  });

  it("reports a browser without localStorage", async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: undefined });
    try {
      await expect(localStorageAdapter().read("a")).rejects.toMatchObject({ problem: "unavailable" });
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
    }
  });

  it("reports a browser that forbids localStorage", async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("SecurityError");
      },
    });
    try {
      await expect(localStorageAdapter().write("a", "text")).rejects.toMatchObject({ problem: "unavailable" });
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
    }
  });
});
