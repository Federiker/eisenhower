import type { StorageAdapter } from "@eisenhower/model";

/** A yes-or-no question asked before something is lost. */
export type Question = { title: string; message: string; ok: string; cancel: string };

/** The open document as the window's close sees it, when it has unsaved changes: its name, and how to save it. */
export type Unsaved = {
  name: string;
  /** Saves it (with Save as… when it has no file); false when it was not saved (cancelled or failed). */
  save: () => Promise<boolean>;
};

/**
 * The window's frame the app draws: its own title bar with the window's buttons (Windows and Linux), a bar under
 * macOS's own buttons, or a plain header in a browser.
 */
export type WindowFrame = "custom" | "macOverlay" | "none";

/** The window's own buttons, where the app draws its title bar. */
export type WindowCalls = {
  minimise: () => Promise<void>;
  /** Maximises the window, or restores it when it is maximised. */
  toggleMaximise: () => Promise<void>;
  /** Asks to close the window, as the system's close button does: the close question runs first. */
  close: () => Promise<void>;
  isMaximised: () => Promise<boolean>;
  /** Calls `handler` after each change of the window's size; resolves to a function that stops listening. */
  onResized: (handler: () => void) => Promise<() => void>;
};

/**
 * What the desktop app needs from where it runs: the Tauri window (files on disk through
 * `tauri-plugin-eisenhower`, chosen with Tauri's dialogues) or the preview in a browser (files kept in the
 * browser, dialogues answered in the page). The documents themselves are read and written through `storage`,
 * by path, with `loadDocument`'s and `saveDocument`'s revisions (the hash guard).
 */
export type Host = {
  kind: "tauri" | "preview";
  /** The title bar the app draws: the window has no system title bar on Windows and Linux. */
  frame: WindowFrame;
  /** The window's minimise, maximise and close (the window only). */
  window: WindowCalls | undefined;
  /** Where the documents are, by path: `tauriStorage()` in the window. */
  storage: StorageAdapter;
  /** Asks for a document to open; null when the user cancels. */
  chooseFile: () => Promise<string | null>;
  /** Asks where to save a document, suggesting the file name `suggested`; null when the user cancels. */
  chooseNewFile: (suggested: string) => Promise<string | null>;
  /** Asks a question; resolves true for its `ok`. */
  ask: (question: Question) => Promise<boolean>;
  /** Names the window (or the page). */
  setTitle: (title: string) => Promise<void>;
  /**
   * Asks before the window closes while `unsaved()` gives the open document (the window only): Save, Don't
   * save or Cancel. A question that fails keeps the window open and is given to `failed`. Resolves to a
   * function that stops asking.
   */
  guardClose: ((unsaved: () => Unsaved | null, failed: (error: unknown) => void) => Promise<() => void>) | undefined;
  /**
   * Gives `open` the path of each document the app is given by the system (the window only): one double-clicked
   * or opened with Eisenhower, when the app starts and while it runs. Resolves to a function that stops listening.
   */
  launched: ((open: (path: string) => void) => Promise<() => void>) | undefined;
};

/** The user closed a dialogue or said no: nothing was written, and nothing went wrong. */
export class Cancelled extends Error {
  override readonly name = "Cancelled";

  constructor() {
    super("cancelled by the user");
  }
}
