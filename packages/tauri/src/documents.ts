import { call } from "./call";
import { invalidResponse } from "./errors";

/** A document's text as it is on disk, and the hash a later save quotes to show it still has that file. */
export interface DocumentFile {
  text: string;
  /** SHA-256 of the text's UTF-8 bytes, in lower-case hexadecimal (64 characters): `textRevision`'s value. */
  hash: string;
}

export interface DocumentWrite {
  path: string;
  /** The document's text, as `serialiseDocument` (from `@eisenhower/model`) writes it. */
  text: string;
  /**
   * The hash `readDocument` (or the previous `writeDocument`) gave: the file is written only if it is
   * still that one, else the save fails with `changed_on_disk` and nothing is written. Left out, the file
   * is written whatever is there (a new file, or Save As).
   */
  expectedHash?: string;
}

const HASH = /^[0-9a-f]{64}$/;

function isDocumentFile(value: unknown): value is DocumentFile {
  if (typeof value !== "object" || value === null) return false;
  const { text, hash } = value as Record<string, unknown>;
  return typeof text === "string" && typeof hash === "string" && HASH.test(hash);
}

/**
 * Reads a document's text and hash; null when there is no file at `path` (a document not saved yet).
 *
 * @throws EisenhowerPluginError `read_failed` (with `path` and `detail`), `not_text` (with `path`),
 * `invalid_request` (an empty path) or `invalid_response`.
 */
export async function readDocument(path: string): Promise<DocumentFile | null> {
  const answer = await call("read_document", { path });
  if (answer === null) return null;
  if (!isDocumentFile(answer)) throw invalidResponse("read_document", "not a text and a hash");
  return { text: answer.text, hash: answer.hash };
}

/**
 * Writes a document in one rename (a temporary file beside it, then renamed over it, so the file is never
 * half written) and resolves to its new hash. The document's folder must exist.
 *
 * @throws EisenhowerPluginError `changed_on_disk` (with `path`, `expectedHash` and `actualHash`, null when
 * the file is no longer there), `read_failed`, `write_failed` or `invalid_request`; the file is as it was
 * after any of them.
 */
export async function writeDocument({ path, text, expectedHash }: DocumentWrite): Promise<string> {
  const args: Record<string, string> = { path, text };
  if (expectedHash !== undefined) args.expectedHash = expectedHash;
  const hash = await call("write_document", args);
  if (typeof hash !== "string" || !HASH.test(hash)) throw invalidResponse("write_document", "not a hash");
  return hash;
}
