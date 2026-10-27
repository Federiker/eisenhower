import { type Board, boardDocument, DocumentError, serialiseDocument } from "@eisenhower/model";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BROWSER_PREFIX, browserHost } from "../src/host/browser";
import { Cancelled } from "../src/host/host";
import { isUndoKey } from "../src/undoKeys";

const board: Board = { columns: [{ id: "c1", name: "Ideas" }], cards: [] };
const sample = { data: board, name: "Ideas board" };

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("the browser host", () => {
  it("starts on the sample when nothing is stored, and on what is stored after a save", async () => {
    const host = browserHost();
    const started = await host.start("board", boardDocument, sample);
    expect(started).toEqual({ ...sample, key: "board" });

    const changed: Board = { ...board, columns: [{ id: "c1", name: "Later" }] };
    const stored = await host.save({ ...started, data: changed }, boardDocument);
    expect(localStorage.getItem(`${BROWSER_PREFIX}board`)).toBe(serialiseDocument(boardDocument, changed));
    expect(await host.start("board", boardDocument, sample)).toEqual({ ...stored, data: changed });
  });

  it("refuses a stored text that is not a document of the view", async () => {
    localStorage.setItem(`${BROWSER_PREFIX}board`, "not json");
    await expect(browserHost().start("board", boardDocument, sample)).rejects.toBeInstanceOf(DocumentError);
  });

  it("asks before overwriting what another tab saved, and overwrites only on yes", async () => {
    const host = browserHost();
    const first = await host.save({ ...sample, key: "board" }, boardDocument);
    localStorage.setItem(`${BROWSER_PREFIX}board`, serialiseDocument(boardDocument, { columns: [], cards: [] }));

    // happy-dom has no confirm(); the window has one.
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    await expect(host.save(first, boardDocument)).rejects.toBeInstanceOf(Cancelled);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Ideas board was changed in another tab"));
    expect(localStorage.getItem(`${BROWSER_PREFIX}board`)).toContain('"columns": []');

    confirm.mockReturnValue(true);
    await host.save(first, boardDocument);
    expect(localStorage.getItem(`${BROWSER_PREFIX}board`)).toContain('"Ideas"');
  });
});

describe("the app's undo keys", () => {
  const press = (init: KeyboardEventInit, target: Element = document.body) => {
    const event = new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true });
    Object.defineProperty(event, "target", { value: target });
    return isUndoKey(event);
  };

  it("are Ctrl+Z to undo, and Ctrl+Y or Ctrl+Shift+Z to redo", () => {
    expect(press({ key: "z", ctrlKey: true })).toBe("undo");
    expect(press({ key: "z", metaKey: true })).toBe("undo");
    expect(press({ key: "Z", ctrlKey: true, shiftKey: true })).toBe("redo");
    expect(press({ key: "y", ctrlKey: true })).toBe("redo");
    expect(press({ key: "z" })).toBeNull();
    expect(press({ key: "z", ctrlKey: true, altKey: true })).toBeNull();
    expect(press({ key: "x", ctrlKey: true })).toBeNull();
  });

  it("leave fields and dialogues their own undo", () => {
    const field = document.createElement("input");
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const inside = dialog.appendChild(document.createElement("button"));
    expect(press({ key: "z", ctrlKey: true }, field)).toBeNull();
    expect(press({ key: "z", ctrlKey: true }, inside)).toBeNull();
  });
});
