import { type StorageAdapter, StorageError, type StorageProblem } from "@eisenhower/model";
import { readDocument, writeDocument } from "./documents";
import { toPluginError } from "./errors";

/** The `StorageError` a failed command becomes: `changed` for the hash guard, else `problem`. */
function storageError(failure: unknown, key: string, problem: StorageProblem): StorageError {
  const cause = toPluginError(failure);
  if (cause.code === "changed_on_disk") return new StorageError("changed", key, undefined, { cause });
  const detail = typeof cause.params.detail === "string" ? cause.params.detail : cause.message;
  return new StorageError(problem, key, detail, { cause });
}

/**
 * Storage in files on disk through `tauri-plugin-eisenhower` (decision 9): each key is a file's path, the
 * revision its SHA-256 (the same as `textRevision`, so a revision from another adapter compares). A file
 * that is not there reads as null; a save quoting a revision is refused with `changed` when the file
 * changed or went since, and nothing is written.
 */
export function tauriStorage(): StorageAdapter {
  return {
    async read(key) {
      try {
        const file = await readDocument(key);
        return file === null ? null : { text: file.text, revision: file.hash };
      } catch (cause) {
        throw storageError(cause, key, "readFailed");
      }
    },
    async write(key, text, expectedRevision) {
      try {
        return await writeDocument(
          expectedRevision === undefined ? { path: key, text } : { path: key, text, expectedHash: expectedRevision },
        );
      } catch (cause) {
        throw storageError(cause, key, "writeFailed");
      }
    },
  };
}
