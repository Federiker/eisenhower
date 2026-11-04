import { describe, expect, it } from "vitest";

import { type AppCommand, appCommand } from "../src/keys";

/** The command a key press on `target` is, as the window's listener sees it. */
function press(key: string, init: KeyboardEventInit = {}, target: Element = document.body): AppCommand | null {
  let command: AppCommand | null = null;
  const listen = (event: KeyboardEvent) => {
    command = appCommand(event);
  };
  window.addEventListener("keydown", listen);
  target.dispatchEvent(new KeyboardEvent("keydown", { key, ctrlKey: true, bubbles: true, cancelable: true, ...init }));
  window.removeEventListener("keydown", listen);
  return command;
}

describe("the app's keys", () => {
  it("gives each command its key, with Ctrl or ⌘", () => {
    expect(press("n")).toBe("new");
    expect(press("o")).toBe("open");
    expect(press("s")).toBe("save");
    expect(press("S", { shiftKey: true })).toBe("saveAs");
    expect(press("z")).toBe("undo");
    expect(press("Z", { shiftKey: true })).toBe("redo");
    expect(press("y")).toBe("redo");
    expect(press("s", { ctrlKey: false, metaKey: true })).toBe("save");
  });

  it("leaves other keys alone", () => {
    expect(press("s", { ctrlKey: false })).toBeNull();
    expect(press("s", { altKey: true })).toBeNull();
    expect(press("N", { shiftKey: true })).toBeNull();
    expect(press("O", { shiftKey: true })).toBeNull();
    expect(press("Y", { shiftKey: true })).toBeNull();
    expect(press("q")).toBeNull();
  });

  it("leaves undo to a field and every key to a dialogue", () => {
    const field = document.body.appendChild(document.createElement("input"));
    expect(press("z", {}, field)).toBeNull();
    expect(press("s", {}, field)).toBe("save");
    const dialog = document.body.appendChild(document.createElement("dialog"));
    const button = dialog.appendChild(document.createElement("button"));
    expect(press("s", {}, button)).toBeNull();
    field.remove();
    dialog.remove();
  });

  it("leaves a key a view has taken", () => {
    const taking = (event: Event) => event.preventDefault();
    document.body.addEventListener("keydown", taking);
    expect(press("s")).toBeNull();
    document.body.removeEventListener("keydown", taking);
  });
});
