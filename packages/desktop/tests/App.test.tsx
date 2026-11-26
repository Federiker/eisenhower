import { boardDocument, emptyBoard, serialiseDocument } from "@eisenhower/model";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";
import type { Host } from "../src/host/host";
import { PREVIEW_PREFIX, previewHost } from "../src/host/preview";
import { RECENT_KEY, type RecentDocument } from "../src/recent";
import { SETTINGS_KEY } from "../src/settings";

const prompt = vi.fn<typeof window.prompt>();
const confirm = vi.fn<typeof window.confirm>();

beforeEach(() => {
  localStorage.clear();
  window.prompt = prompt;
  window.confirm = confirm;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  prompt.mockReset();
  confirm.mockReset();
  vi.restoreAllMocks();
});

/** A file of the preview, by path. */
const file = (path: string) => localStorage.getItem(`${PREVIEW_PREFIX}${path}`);
const putFile = (path: string, text: string) => localStorage.setItem(`${PREVIEW_PREFIX}${path}`, text);
const boardText = serialiseDocument(boardDocument, emptyBoard());

const recentEntry = (path: string, name: string): RecentDocument => ({
  path,
  name,
  kind: "board",
  opened: "2026-11-03T09:30:00.000Z",
});

function renderApp(host: Host = previewHost()) {
  return render(<App host={host} keep={localStorage} />);
}

/** Creates a document of `type` called `name` from the start screen, saved at `path`. */
async function create(type: string, name: string, path: string) {
  prompt.mockReturnValueOnce(path);
  fireEvent.click(screen.getByRole("radio", { name: type }));
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Create…" }));
  await screen.findByRole("heading", { level: 2, name: path.split("/").pop() });
}

/** The app's own status line, in the footer (the views have their own live regions). */
const status = () => within(screen.getByRole("contentinfo")).getByRole("status");

/** Waits for the app's error line, in the footer, to say `message`. */
const saysError = (message: string) =>
  waitFor(() => expect(within(screen.getByRole("contentinfo")).getByRole("alert")).toHaveTextContent(message));

const press = (key: string, init: KeyboardEventInit = {}) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, ctrlKey: true, cancelable: true, ...init }));
  });

describe("the start screen", () => {
  it("starts with no recent documents and the new document's form", async () => {
    renderApp();
    expect(screen.getByRole("heading", { name: "Recent documents" })).toBeInTheDocument();
    expect(screen.getByText("No documents opened yet. Open one, or create a new one.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Board" })).toBeChecked();
    expect(screen.getAllByRole("radio").map((radio) => radio.closest("label")?.textContent)).toEqual([
      "Board",
      "Timeline (dates)",
      "Timeline (sequence)",
      "Gantt chart",
      "Todo list",
    ]);
    expect(screen.getByText("Preview: the files are kept in this browser, not on disk.")).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Eisenhower"));
  });

  it("creates a document of the type chosen where the user says, and opens it", async () => {
    renderApp();
    await create("Gantt chart", "Garden: spring", "/Preview/Garden spring.ike");
    expect(prompt).toHaveBeenCalledWith("Save the document as:", "/Preview/Garden spring.ike");
    expect(JSON.parse(file("/Preview/Garden spring.ike") ?? "")).toMatchObject({
      format: "eisenhower",
      kind: "gantt",
    });
    expect(status()).toHaveTextContent("Created Garden spring.ike.");
    await waitFor(() => expect(document.title).toBe("Garden spring.ike – Eisenhower"));
    expect(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "")).toMatchObject([
      { path: "/Preview/Garden spring.ike", name: "Garden spring.ike", kind: "gantt" },
    ]);
  });

  it("makes a timeline of dates or of steps", async () => {
    renderApp();
    await create("Timeline (sequence)", "Story", "/Preview/Story.ike");
    expect(JSON.parse(file("/Preview/Story.ike") ?? "")).toMatchObject({
      kind: "timeline",
      data: { kind: "sequence" },
    });
  });

  it("asks for a name, and creates nothing when the save is cancelled", async () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Create…" }));
    const name = screen.getByRole("textbox", { name: "Name" });
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Give the document a name.");
    expect(name).toHaveFocus();
    expect(prompt).not.toHaveBeenCalled();

    prompt.mockReturnValueOnce(null);
    fireEvent.change(name, { target: { value: "Later" } });
    expect(name).not.toHaveAttribute("aria-invalid");
    fireEvent.click(screen.getByRole("button", { name: "Create…" }));
    await waitFor(() => expect(prompt).toHaveBeenCalled());
    expect(screen.getByRole("heading", { name: "Recent documents" })).toBeInTheDocument();
    expect(localStorage.getItem(RECENT_KEY)).toBeNull();
  });

  it("says when a document cannot be created", async () => {
    const host = previewHost();
    host.storage.write = async () => {
      throw new Error("disk full");
    };
    renderApp(host);
    prompt.mockReturnValueOnce("/Preview/Full.json");
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Full" } });
    fireEvent.click(screen.getByRole("button", { name: "Create…" }));
    await saysError("Full.json could not be created.");
  });

  it("lists the documents opened, the latest first, by name without .ike or .json, and opens one", async () => {
    putFile("/Preview/Older.json", boardText);
    putFile("/Preview/Newer.ike", serialiseDocument(boardDocument, emptyBoard()));
    localStorage.setItem(
      RECENT_KEY,
      JSON.stringify([
        recentEntry("/Preview/Newer.ike", "Newer.ike"),
        recentEntry("/Preview/Older.json", "Older.json"),
      ]),
    );
    renderApp();
    const items = within(screen.getByRole("list")).getAllByRole("button");
    expect(items.map((item) => item.querySelector(".start-recent-name")?.textContent)).toEqual(["Newer", "Older"]);
    expect(items[1]).toHaveTextContent(/Board/);
    expect(items[1]).toHaveTextContent(/\/Preview/);
    expect(items[1]).toHaveTextContent(/Opened 3 Nov 2026/);
    fireEvent.click(items[1]!);
    await screen.findByRole("heading", { level: 2, name: "Older.json" });
    expect(status()).toHaveTextContent("Opened Older.json.");
    expect(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "")[0]).toMatchObject({ path: "/Preview/Older.json" });
  });

  it("drops the files that are gone, and says so for one gone since the list was shown", async () => {
    putFile("/Preview/Here.json", boardText);
    putFile("/Preview/Soon gone.json", boardText);
    localStorage.setItem(
      RECENT_KEY,
      JSON.stringify([
        recentEntry("/Preview/Here.json", "Here.json"),
        recentEntry("/Preview/Gone.json", "Gone.json"),
        recentEntry("/Preview/Soon gone.json", "Soon gone.json"),
      ]),
    );
    renderApp();
    await waitFor(() => expect(screen.queryByText("Gone")).not.toBeInTheDocument());
    expect(screen.getByText("Here")).toBeInTheDocument();

    localStorage.removeItem(`${PREVIEW_PREFIX}/Preview/Soon gone.json`);
    fireEvent.click(screen.getByText("Soon gone"));
    await saysError("Soon gone.json is no longer there, so it is taken off the list.");
    expect(screen.queryByText("Soon gone")).not.toBeInTheDocument();
  });

  it("says when the recent list cannot be read", () => {
    localStorage.setItem(RECENT_KEY, "{");
    renderApp();
    expect(screen.getByRole("alert")).toHaveTextContent("The list of recent documents could not be read");
  });

  it("opens another file, refusing one that is not a document", async () => {
    putFile("/Preview/notes.json", "not json");
    putFile("/Preview/Plan.json", boardText);
    renderApp();
    prompt.mockReturnValueOnce("/Preview/notes.json");
    fireEvent.click(screen.getByRole("button", { name: "Open…" }));
    await saysError("notes.json could not be opened. It is not JSON.");
    expect(screen.getByRole("heading", { name: "Recent documents" })).toBeInTheDocument();

    prompt.mockReturnValueOnce("/Preview/Plan.json");
    await press("o");
    await screen.findByRole("heading", { level: 2, name: "Plan.json" });
  });

  it("keeps the theme and the locale", () => {
    renderApp();
    fireEvent.change(screen.getByRole("combobox", { name: "Theme" }), { target: { value: "dark" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Dates and numbers" }), { target: { value: "de-DE" } });
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "")).toEqual({ theme: "dark", locale: "de-DE" });
  });
});

describe("a document open", () => {
  it("saves with Ctrl+S, in place even as .json, marks unsaved changes and undoes them", async () => {
    renderApp();
    // A file chosen as .json (as documents were saved before .ike) is saved where it is, as it is.
    await create("Board", "Moving", "/Preview/Moving.json");
    fireEvent.click(screen.getByRole("button", { name: "New column" }));
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("• Moving.json – Eisenhower"));
    await press("s");
    await waitFor(() => expect(status()).toHaveTextContent("Saved Moving.json."));
    expect(JSON.parse(file("/Preview/Moving.json") ?? "").data.columns).toHaveLength(1);
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();

    await press("z");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    await press("y");
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
  });

  it("saves as a new file, which the recent list then has", async () => {
    renderApp();
    await create("Todo list", "Week", "/Preview/Week.json");
    prompt.mockReturnValueOnce("/Preview/Week 2.json");
    fireEvent.click(screen.getByRole("button", { name: "Save as…" }));
    await screen.findByRole("heading", { level: 2, name: "Week 2.json" });
    // A .json document from before is offered as .ike.
    expect(prompt).toHaveBeenLastCalledWith("Save the document as:", "/Preview/Week.ike");
    expect(JSON.parse(file("/Preview/Week 2.json") ?? "")).toMatchObject({ kind: "todo" });
    expect(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "")[0]).toMatchObject({ path: "/Preview/Week 2.json" });

    prompt.mockReturnValueOnce(null);
    await press("S", { shiftKey: true });
    await waitFor(() => expect(status()).toHaveTextContent("Not saved."));
  });

  it("asks before overwriting a file changed elsewhere", async () => {
    renderApp();
    await create("Board", "Shared", "/Preview/Shared.json");
    putFile(
      "/Preview/Shared.json",
      serialiseDocument(boardDocument, { columns: [{ id: "x", name: "Theirs" }], cards: [] }),
    );
    fireEvent.click(screen.getByRole("button", { name: "New column" }));

    confirm.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(status()).toHaveTextContent("Not saved."));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Shared.json was changed by another program"));
    expect(file("/Preview/Shared.json")).toContain("Theirs");

    confirm.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(status()).toHaveTextContent("Saved Shared.json."));
    expect(file("/Preview/Shared.json")).not.toContain("Theirs");
  });

  it("says when a save fails", async () => {
    const host = previewHost();
    renderApp(host);
    await create("Board", "Broken", "/Preview/Broken.json");
    host.storage.write = async () => {
      throw new Error("disk full");
    };
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await saysError("Broken.json could not be saved.");
  });

  it("asks before leaving unsaved changes, and goes back to the start", async () => {
    renderApp();
    await create("Board", "Draft", "/Preview/Draft.json");
    fireEvent.click(screen.getByRole("button", { name: "New column" }));

    confirm.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Eisenhower: back to the start screen" }));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Draft.json has changes")));
    expect(screen.getByRole("heading", { level: 2, name: /Draft.json/ })).toBeInTheDocument();

    confirm.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "Eisenhower: back to the start screen" }));
    await screen.findByRole("heading", { name: "Recent documents" });
    expect(screen.getByText("Draft")).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Eisenhower"));
  });

  it("goes to the new document's form with Ctrl+N", async () => {
    renderApp();
    await create("Board", "Plan", "/Preview/Plan.json");
    await press("n");
    const name = await screen.findByRole("textbox", { name: "Name" });
    await waitFor(() => expect(name).toHaveFocus());
    await press("n");
    expect(name).toHaveFocus();
  });

  it("shows each kind of document in its view", async () => {
    renderApp();
    await create("Timeline (dates)", "History", "/Preview/History.json");
    expect(document.querySelector(".eh-timeline-editor")).not.toBeNull();
    await press("n");
    await create("Todo list", "Jobs", "/Preview/Jobs.json");
    expect(document.querySelector(".eh-todo")).not.toBeNull();
    await press("n");
    await create("Board", "Cards", "/Preview/Cards.json");
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("the window's close", () => {
  it("guards the close with the open document's unsaved changes", async () => {
    let unsaved: (() => { name: string; save: () => Promise<boolean> } | null) | undefined;
    const stop = vi.fn();
    const host: Host = {
      ...previewHost(),
      guardClose: async (given) => {
        unsaved = given;
        return stop;
      },
    };
    const { unmount } = renderApp(host);
    await waitFor(() => expect(unsaved).toBeDefined());
    expect(unsaved?.()).toBeNull();
    await create("Board", "Closing", "/Preview/Closing.json");
    fireEvent.click(screen.getByRole("button", { name: "New column" }));
    expect(unsaved?.()).toMatchObject({ name: "Closing.json" });
    expect(await act(() => unsaved?.()?.save())).toBe(true);
    unmount();
    expect(stop).toHaveBeenCalled();
  });

  it("says when the window cannot ask, or its question failed", async () => {
    let failed: ((error: unknown) => void) | undefined;
    renderApp({
      ...previewHost(),
      guardClose: async (_unsaved, onFailure) => {
        failed = onFailure;
        return () => undefined;
      },
    });
    await waitFor(() => expect(failed).toBeDefined());
    act(() => failed?.(new Error("no dialogue")));
    expect(screen.getByRole("alert")).toHaveTextContent("The window could not ask about the unsaved changes");

    renderApp({ ...previewHost(), guardClose: () => Promise.reject(new Error("not allowed")) });
    await waitFor(() =>
      expect(screen.getAllByRole("alert").at(-1)).toHaveTextContent("The window will not ask about unsaved changes"),
    );
  });
});

describe("the documents the system gives the app", () => {
  it("opens each, asking first about unsaved changes, and stops listening when it goes", async () => {
    putFile("/Preview/Given.ike", boardText);
    putFile("/Preview/Later.json", boardText);
    let open: ((path: string) => void) | undefined;
    const stop = vi.fn();
    const host: Host = {
      ...previewHost(),
      launched: async (given) => {
        open = given;
        return stop;
      },
    };
    const { unmount } = renderApp(host);
    await waitFor(() => expect(open).toBeDefined());
    act(() => open?.("/Preview/Given.ike"));
    await screen.findByRole("heading", { level: 2, name: "Given.ike" });
    expect(status()).toHaveTextContent("Opened Given.ike.");

    fireEvent.click(screen.getByRole("button", { name: "New column" }));
    confirm.mockReturnValueOnce(false);
    act(() => open?.("/Preview/Later.json"));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Given.ike has changes")));
    expect(screen.getByRole("heading", { level: 2, name: /Given.ike/ })).toBeInTheDocument();
    confirm.mockReturnValueOnce(true);
    act(() => open?.("/Preview/Later.json"));
    await screen.findByRole("heading", { level: 2, name: "Later.json" });

    act(() => open?.("/Preview/Missing.ike"));
    await saysError("Missing.ike is no longer there");
    unmount();
    expect(stop).toHaveBeenCalled();
  });

  it("says when a question before opening fails, or when it cannot listen", async () => {
    let open: ((path: string) => void) | undefined;
    const host: Host = {
      ...previewHost(),
      ask: () => Promise.reject(new Error("no dialogue")),
      launched: async (given) => {
        open = given;
        return () => undefined;
      },
    };
    renderApp(host);
    await create("Board", "Busy", "/Preview/Busy.ike");
    fireEvent.click(screen.getByRole("button", { name: "New column" }));
    await waitFor(() => expect(open).toBeDefined());
    act(() => open?.("/Preview/Other.ike"));
    await saysError("Other.ike could not be opened.");

    renderApp({ ...previewHost(), launched: () => Promise.reject(new Error("not allowed")) });
    await waitFor(() =>
      expect(screen.getAllByRole("alert").at(-1)).toHaveTextContent("Documents opened from the file manager"),
    );
  });
});

describe("the title bar", () => {
  /** A window with the app's own title bar: its calls recorded, its maximised state given by `maximised`. */
  function framedHost(maximised: () => Promise<boolean> = async () => false) {
    const calls: string[] = [];
    let resized: (() => void) | undefined;
    const stop = vi.fn();
    const record = (name: string) => async () => {
      calls.push(name);
    };
    const host: Host = {
      ...previewHost(),
      frame: "custom",
      window: {
        minimise: record("minimise"),
        toggleMaximise: record("toggleMaximise"),
        close: record("close"),
        isMaximised: maximised,
        onResized: async (handler) => {
          resized = handler;
          return stop;
        },
      },
    };
    return { host, calls, stop, resize: () => resized?.() };
  }

  it("draws the window's buttons, out of the Tab order, and they act on the window", async () => {
    let maximised = false;
    const { host, calls, stop, resize } = framedHost(async () => maximised);
    const { unmount } = renderApp(host);
    const header = screen.getByRole("banner");
    expect(header).toHaveAttribute("data-tauri-drag-region", "deep");
    expect(header).toHaveAttribute("data-frame", "custom");
    const minimise = screen.getByRole("button", { name: "Minimise" });
    expect(minimise).toHaveAttribute("tabindex", "-1");
    fireEvent.click(minimise);
    fireEvent.click(screen.getByRole("button", { name: "Maximise" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(calls).toEqual(["minimise", "toggleMaximise", "close"]));

    maximised = true;
    act(() => resize());
    fireEvent.click(await screen.findByRole("button", { name: "Restore" }));
    await waitFor(() => expect(calls.at(-1)).toBe("toggleMaximise"));
    unmount();
    expect(stop).toHaveBeenCalled();
  });

  it("says when the window cannot do what a button asks", async () => {
    const { host } = framedHost(() => Promise.reject(new Error("not allowed")));
    renderApp(host);
    await saysError("The window could not do that.");
  });

  it("has no window buttons in the preview or on macOS, whose own buttons stay", () => {
    renderApp();
    expect(screen.queryByRole("button", { name: "Minimise" })).not.toBeInTheDocument();
    const { host } = framedHost();
    renderApp({ ...host, frame: "macOverlay" });
    expect(screen.getAllByRole("banner").at(-1)).toHaveAttribute("data-frame", "macOverlay");
    expect(screen.queryByRole("button", { name: "Minimise" })).not.toBeInTheDocument();
  });

  it("shows the app's name as plain text on the start screen, and as the way back to it from a document", async () => {
    renderApp();
    expect(screen.getByRole("heading", { level: 1, name: "Eisenhower" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /back to the start screen/ })).not.toBeInTheDocument();
    await create("Todo list", "Week", "/Preview/Week.ike");
    expect(screen.queryByRole("button", { name: "Start" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Eisenhower: back to the start screen" }));
    await screen.findByRole("heading", { name: "Recent documents" });
  });
});
