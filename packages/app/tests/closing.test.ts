import { mockWindows } from "@tauri-apps/api/mocks";
import { describe, expect, it, vi } from "vitest";

import { type CloseChoice, mayClose, type Unsaved } from "../src/host/closing";
import { tauriHost } from "../src/host/tauri";
import { type Call, mockTauri } from "./ipc";

/** An unsaved document whose save answers `saved`, counting its saves. */
function unsaved(name: string, saved = true): Unsaved & { saves: number } {
  const document = {
    name,
    saves: 0,
    save: async () => {
      document.saves += 1;
      return saved;
    },
  };
  return document;
}

const answering = (choice: CloseChoice) => vi.fn(async (_names: readonly string[]) => choice);

describe("whether the window may close", () => {
  it("closes at once when nothing is unsaved", async () => {
    const choose = answering("cancel");
    expect(await mayClose([], choose)).toBe(true);
    expect(choose).not.toHaveBeenCalled();
  });

  it("asks once for every unsaved document; Don't save closes, Cancel stays, neither saves", async () => {
    const documents = [unsaved("Moving house"), unsaved("This week")];
    const discard = answering("discard");
    expect(await mayClose(documents, discard)).toBe(true);
    expect(discard).toHaveBeenCalledWith(["Moving house", "This week"]);
    expect(await mayClose(documents, answering("cancel"))).toBe(false);
    expect(documents.map((one) => one.saves)).toEqual([0, 0]);
  });

  it("saves each on Save, and closes when all are saved", async () => {
    const documents = [unsaved("Moving house"), unsaved("This week")];
    expect(await mayClose(documents, answering("save"))).toBe(true);
    expect(documents.map((one) => one.saves)).toEqual([1, 1]);
  });

  it("stays open, and stops saving, at the first document not saved (Save as… cancelled or a failure)", async () => {
    const documents = [unsaved("Moving house"), unsaved("A sample", false), unsaved("This week")];
    expect(await mayClose(documents, answering("save"))).toBe(false);
    expect(documents.map((one) => one.saves)).toEqual([1, 1, 0]);
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

/**
 * The window with the host guarding its close: `answer` is what the question's button gives back. Returns
 * the calls, a close request (which waits for the window to be destroyed or left open) and the stop.
 */
async function guardedWindow(answer: unknown, documents: () => Unsaved[], failed = vi.fn()) {
  const calls = mockTauri(({ command }) => {
    if (command === "plugin:event|listen") return 1;
    if (command === "plugin:dialog|message") {
      if (answer instanceof Error) throw answer;
      return answer;
    }
    return null;
  });
  mockWindows("main");
  const stop = await tauriHost().guardClose?.(documents, failed);
  return { calls, close: closeRequest(calls), stop };
}

const commands = (calls: Call[]) => calls.map((call) => call.command).filter((one) => one !== "plugin:event|listen");

describe("the window's close", () => {
  it("closes without asking when nothing is unsaved", async () => {
    const { calls, close } = await guardedWindow("Save", () => []);
    await close();
    expect(commands(calls)).toEqual(["plugin:window|destroy"]);
  });

  it("asks Save, Don't save or Cancel, naming the documents", async () => {
    const { calls, close } = await guardedWindow("Cancel", () => [unsaved("Moving house"), unsaved("This week")]);
    await close();
    expect(commands(calls)).toEqual(["plugin:dialog|message"]);
    expect(calls[1]?.args).toMatchObject({
      title: "Unsaved changes",
      message: "Moving house and This week have changes that are not saved. Save them before closing?",
      kind: "warning",
      buttons: { YesNoCancelCustom: ["Save", "Don't save", "Cancel"] },
    });
  });

  it("saves every document, then closes, on Save", async () => {
    const documents = [unsaved("Moving house"), unsaved("This week")];
    const { calls, close } = await guardedWindow("Save", () => documents);
    await close();
    expect(documents.map((one) => one.saves)).toEqual([1, 1]);
    expect(commands(calls)).toEqual(["plugin:dialog|message", "plugin:window|destroy"]);
  });

  it("stays open when a save is cancelled", async () => {
    const documents = [unsaved("A sample", false)];
    const { calls, close } = await guardedWindow("Save", () => documents);
    await close();
    expect(calls[1]?.args).toMatchObject({
      message: "A sample has changes that are not saved. Save them before closing?",
    });
    expect(documents[0]?.saves).toBe(1);
    expect(commands(calls)).toEqual(["plugin:dialog|message"]);
  });

  it("closes without saving on Don't save, and takes the default buttons' names too", async () => {
    const documents = [unsaved("Moving house")];
    let window = await guardedWindow("Don't save", () => documents);
    await window.close();
    expect(commands(window.calls)).toEqual(["plugin:dialog|message", "plugin:window|destroy"]);
    window = await guardedWindow("No", () => documents);
    await window.close();
    expect(commands(window.calls)).toEqual(["plugin:dialog|message", "plugin:window|destroy"]);
    window = await guardedWindow("Yes", () => documents);
    await window.close();
    expect(commands(window.calls)).toEqual(["plugin:dialog|message", "plugin:window|destroy"]);
    expect(documents[0]?.saves).toBe(1);
  });

  it("stays open when the question is closed, or fails (saying so)", async () => {
    let window = await guardedWindow("", () => [unsaved("Moving house")]);
    await window.close();
    expect(commands(window.calls)).toEqual(["plugin:dialog|message"]);
    const failed = vi.fn();
    const problem = new Error("not allowed");
    window = await guardedWindow(problem, () => [unsaved("Moving house")], failed);
    await window.close();
    expect(commands(window.calls)).toEqual(["plugin:dialog|message"]);
    expect(failed).toHaveBeenCalledWith(problem);
  });

  it("asks only once while its question is open", async () => {
    let answer: (value: string) => void = () => undefined;
    const calls = mockTauri(({ command }) => {
      if (command === "plugin:event|listen") return 1;
      if (command === "plugin:dialog|message") return new Promise<string>((resolve) => (answer = resolve));
      return null;
    });
    mockWindows("main");
    await tauriHost().guardClose?.(() => [unsaved("Moving house")], vi.fn());
    const close = closeRequest(calls);
    await close();
    await close();
    expect(commands(calls)).toEqual(["plugin:dialog|message"]);
    answer("Don't save");
    await settle();
    expect(commands(calls)).toEqual(["plugin:dialog|message", "plugin:window|destroy"]);
  });

  it("stops asking when told to", async () => {
    const { calls, stop } = await guardedWindow("Save", () => []);
    await stop?.();
    expect(calls.map((call) => call.command)).toContain("plugin:event|unlisten");
  });
});
