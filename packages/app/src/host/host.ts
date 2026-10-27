import type { DocumentKind } from "@eisenhower/model";

/**
 * A document the app has open: its data, the name shown, where it is stored (a file's path in the window,
 * a storage key in the browser; none for a sample not saved yet) and the revision it was read or last saved
 * with, which the next save quotes (the hash guard).
 */
export type OpenDocument<T> = { data: T; name: string; key?: string; revision?: string };

/** A yes-or-no question asked before something is lost. */
export type Question = { title: string; message: string; ok: string; cancel: string };

/**
 * What the demo app needs from where it runs: the browser (documents kept in `localStorage`, saved as they
 * change) or the Tauri window (files on disk through `tauri-plugin-eisenhower`, chosen with dialogues). This
 * is the integration a host app writes around the views, with `loadDocument` and `saveDocument` and each
 * view's `DocumentKind`.
 */
export type Host = {
  kind: "browser" | "tauri";
  /**
   * The document a slot starts with: in the browser the one stored under `key`, else the sample (kept under
   * `key` from its first change); in the window the sample, on no file yet.
   *
   * @throws DocumentError or StorageError when what is stored cannot be read.
   */
  start: <T>(key: string, kind: DocumentKind<T>, sample: OpenDocument<T>) => Promise<OpenDocument<T>>;
  /** Asks for a document to open (the window only); null when the user cancels. */
  open: (<T>(kind: DocumentKind<T>) => Promise<OpenDocument<T> | null>) | undefined;
  /**
   * Stores the document where it came from, quoting its revision; when it was changed elsewhere since, asks
   * whether to overwrite it. Resolves to the document as now stored.
   *
   * @throws Cancelled when the user chose not to (or closed Save as); StorageError when it failed.
   */
  save: <T>(document: OpenDocument<T>, kind: DocumentKind<T>) => Promise<OpenDocument<T>>;
  /** Stores the document in a new file the user chooses (the window only); throws `Cancelled` likewise. */
  saveAs: (<T>(document: OpenDocument<T>, kind: DocumentKind<T>) => Promise<OpenDocument<T>>) | undefined;
  /** Asks a question; resolves true for its `ok`. */
  ask: (question: Question) => Promise<boolean>;
};

/** The user closed a dialogue or said no: nothing was written, and nothing went wrong. */
export class Cancelled extends Error {
  override readonly name = "Cancelled";

  constructor() {
    super("cancelled by the user");
  }
}
