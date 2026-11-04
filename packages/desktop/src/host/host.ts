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
 * What the desktop app needs from where it runs: the Tauri window (files on disk through
 * `tauri-plugin-eisenhower`, chosen with Tauri's dialogues) or the preview in a browser (files kept in the
 * browser, dialogues answered in the page). The documents themselves are read and written through `storage`,
 * by path, with `loadDocument`'s and `saveDocument`'s revisions (the hash guard).
 */
export type Host = {
  kind: "tauri" | "preview";
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
};

/** The user closed a dialogue or said no: nothing was written, and nothing went wrong. */
export class Cancelled extends Error {
  override readonly name = "Cancelled";

  constructor() {
    super("cancelled by the user");
  }
}
