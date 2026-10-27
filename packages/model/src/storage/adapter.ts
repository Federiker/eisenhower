import { type DocumentKind, parseDocument, serialiseDocument } from "./document";

/** A stored text and its revision: an opaque mark that changes whenever the text does. */
export interface StoredText {
  text: string;
  revision: string;
}

/**
 * Where documents are kept (decision 9): texts by key (a file's path, a storage key…), each with a revision.
 * A write quoting the revision it read is refused with `changed` when the text changed since, so one window
 * never overwrites another's work unseen.
 */
export interface StorageAdapter {
  /** The text and its revision, or null when there is nothing under the key. */
  read(key: string): Promise<StoredText | null>;
  /**
   * Writes the text and resolves to its new revision. With `expectedRevision`, writes only if the stored
   * text still has it (or, for a key with nothing under it, never); without, writes whatever is there.
   */
  write(key: string, text: string, expectedRevision?: string): Promise<string>;
}

/** Why storage failed: a text changed since it was read, or the place could not be read or written. */
export type StorageProblem = "changed" | "readFailed" | "writeFailed" | "unavailable";

/** A storage failure; `detail` is the system's own words, for logs, never interface text. */
export class StorageError extends Error {
  override readonly name = "StorageError";
  readonly problem: StorageProblem;
  readonly key: string;
  readonly detail: string | undefined;

  constructor(problem: StorageProblem, key: string, detail?: string, options?: ErrorOptions) {
    super(detail ? `${problem} (${key}): ${detail}` : `${problem} (${key})`, options);
    this.problem = problem;
    this.key = key;
    this.detail = detail;
  }
}

/** A document's data and the revision a later save quotes. */
export interface LoadedDocument<T> {
  data: T;
  revision: string;
}

/**
 * Reads and checks a document; null when there is nothing under the key.
 *
 * @throws StorageError when it cannot be read; DocumentError when it is not a valid document of the kind.
 */
export async function loadDocument<T>(
  storage: StorageAdapter,
  key: string,
  kind: DocumentKind<T>,
): Promise<LoadedDocument<T> | null> {
  const stored = await storage.read(key);
  if (!stored) return null;
  return { data: parseDocument(kind, stored.text), revision: stored.revision };
}

/**
 * Writes a document and resolves to its new revision; with `expectedRevision`, only over that revision.
 *
 * @throws StorageError (`changed` when the stored document is not the one read).
 */
export function saveDocument<T>(
  storage: StorageAdapter,
  key: string,
  kind: DocumentKind<T>,
  data: T,
  expectedRevision?: string,
): Promise<string> {
  return storage.write(key, serialiseDocument(kind, data), expectedRevision);
}

/** SHA-256 of the text's UTF-8 bytes in lower-case hexadecimal: the revision every built-in adapter uses. */
export async function textRevision(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
