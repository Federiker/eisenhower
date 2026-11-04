import { boardDocument, emptyBoard, serialiseDocument } from "@eisenhower/model";
import { mockWindows } from "@tauri-apps/api/mocks";
import { describe, expect, it, vi } from "vitest";

import type { Unsaved } from "../src/host/host";
import { tauriHost } from "../src/host/tauri";
import { type Call, mockTauri } from "./ipc";

const HASH = "a".repeat(64);
const path = "C:\\Plans\\Garden.json";
const filters = [{ name: "Eisenhower documents", extensions: ["json"] }];

describe("the Tauri host", () => {
  it("chooses a file to open, or nothing when the dialogue is cancelled", async () => {
    let calls = mockTauri(() => path);
    expect(await tauriHost().chooseFile()).toBe(path);
    expect(calls).toMatchObject([
      { command: "plugin:dialog|open", args: { options: { multiple: false, directory: false, filters } } },
    ]);
    calls = mockTauri(() => null);
    expect(await tauriHost().chooseFile()).toBeNull();
  });

  it("asks where to save, suggesting the file's name", async () => {
    const calls = mockTauri(() => path);
    expect(await tauriHost().chooseNewFile("Garden.json")).toBe(path);
    expect(calls).toMatchObject([
      { command: "plugin:dialog|save", args: { options: { defaultPath: "Garden.json", filters } } },
    ]);
  });

  it("reads and writes the documents through the plugin, with the file's hash", async () => {
    const text = serialiseDocument(boardDocument, emptyBoard());
    const calls = mockTauri(({ command }) =>
      command === "plugin:eisenhower|read_document" ? { text, hash: HASH } : HASH,
    );
    const storage = tauriHost().storage;
    expect(await storage.read(path)).toEqual({ text, revision: HASH });
    expect(await storage.write(path, text, HASH)).toBe(HASH);
    expect(calls.map((call) => call.command)).toEqual([
      "plugin:eisenhower|read_document",
      "plugin:eisenhower|write_document",
    ]);
  });

  it("asks a question with the dialogue's buttons", async () => {
    const calls = mockTauri(() => "Overwrite");
    const question = { title: "The file has changed", message: "Overwrite?", ok: "Overwrite", cancel: "Cancel" };
    expect(await tauriHost().ask(question)).toBe(true);
    expect(calls[0]).toMatchObject({
      command: "plugin:dialog|message",
      args: { title: "The file has changed", message: "Overwrite?", kind: "warning" },
    });
  });

  it("names the window", async () => {
    const calls = mockTauri(() => null);
    mockWindows("main");
    await tauriHost().setTitle("Garden.json – Eisenhower");
    expect(calls).toMatchObject([
      { command: "plugin:window|set_title", args: { label: "main", value: "Garden.json – Eisenhower" } },
    ]);
  });
});

type Internals = { runCallback: (id: number, data: unknown) => void };

/** Lets the handler finish: every dialogue and command it waits for is answered at once. */
async function settle() {
  for (let turn = 0; turn < 20; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Asks the window to close, as its close button does, through the listener the host registered. */
function closeRequest(calls: Call[]): () => Promise<void> {
  const listen = calls.find((call) => call.command === "plugin:event|listen");
  expect(listen?.args).toMatchObject({ event: "tauri://close-requested", target: { kind: "Window", label: "main" } });
  const { handler } = (listen?.args ?? {}) as { handler: number };
  const internals = (window as unknown as { __TAURI_INTERNALS__: Internals }).__TAURI_INTERNALS__;
  return async () => {
    internals.runCallback(handler, { event: "tauri://close-requested", id: 1, payload: null });
    await settle();
  };
}

/** An unsaved document whose save answers `saved`, counting its saves. */
function unsaved(saved = true): Unsaved & { saves: number } {
  const document = {
    name: "Garden.json",
    saves: 0,
    save: async () => {
      document.saves += 1;
      return saved;
    },
  };
  return document;
}

/** The window with the host guarding its close: `answer` is what the question's button gives back. */
async function guardedWindow(answer: unknown, document: () => Unsaved | null, failed = vi.fn()) {
  const calls = mockTauri(({ command }) => {
    if (command === "plugin:event|listen") return 1;
    if (command === "plugin:dialog|message") {
      if (answer instanceof Error) throw answer;
      return answer;
    }
    return null;
  });
  mockWindows("main");
  const stop = await tauriHost().guardClose?.(document, failed);
  return { calls, close: closeRequest(calls), stop };
}

const commands = (calls: Call[]) => calls.map((call) => call.command).filter((one) => one !== "plugin:event|listen");

describe("the window's close", () => {
  it("closes without asking when nothing is unsaved", async () => {
    const { calls, close } = await guardedWindow("Save", () => null);
    await close();
    expect(commands(calls)).toEqual(["plugin:window|destroy"]);
  });

  it("asks Save, Don't save or Cancel, naming the document; Save saves, then closes", async () => {
    const document = unsaved();
    const { calls, close } = await guardedWindow("Save", () => document);
    await close();
    expect(calls[1]?.args).toMatchObject({
      title: "Unsaved changes",
      message: "Garden.json has changes that are not saved. Save them before closing?",
      buttons: { YesNoCancelCustom: ["Save", "Don't save", "Cancel"] },
    });
    expect(document.saves).toBe(1);
    expect(commands(calls)).toEqual(["plugin:dialog|message", "plugin:window|destroy"]);
  });

  it("stays open when the save is cancelled, on Cancel, or when the question fails (saying so)", async () => {
    let window = await guardedWindow("Save", () => unsaved(false));
    await window.close();
    expect(commands(window.calls)).toEqual(["plugin:dialog|message"]);
    window = await guardedWindow("", () => unsaved());
    await window.close();
    expect(commands(window.calls)).toEqual(["plugin:dialog|message"]);
    const failed = vi.fn();
    const problem = new Error("not allowed");
    window = await guardedWindow(problem, () => unsaved(), failed);
    await window.close();
    expect(commands(window.calls)).toEqual(["plugin:dialog|message"]);
    expect(failed).toHaveBeenCalledWith(problem);
  });

  it("closes without saving on Don't save, and takes the default buttons' names too", async () => {
    const document = unsaved();
    for (const answer of ["Don't save", "No", "Yes"]) {
      const window = await guardedWindow(answer, () => document);
      await window.close();
      expect(commands(window.calls)).toEqual(["plugin:dialog|message", "plugin:window|destroy"]);
    }
    expect(document.saves).toBe(1);
  });

  it("asks only once while its question is open, and stops asking when told to", async () => {
    let answer: (value: string) => void = () => undefined;
    const calls = mockTauri(({ command }) => {
      if (command === "plugin:event|listen") return 1;
      if (command === "plugin:dialog|message") return new Promise<string>((resolve) => (answer = resolve));
      return null;
    });
    mockWindows("main");
    const stop = await tauriHost().guardClose?.(() => unsaved(), vi.fn());
    const close = closeRequest(calls);
    await close();
    await close();
    expect(commands(calls)).toEqual(["plugin:dialog|message"]);
    answer("Don't save");
    await settle();
    expect(commands(calls)).toEqual(["plugin:dialog|message", "plugin:window|destroy"]);
    await stop?.();
    expect(calls.map((call) => call.command)).toContain("plugin:event|unlisten");
  });
});
