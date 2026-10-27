import { type StorageAdapter, StorageError, textRevision } from "./adapter";

/**
 * Storage in the browser's `localStorage`, each key under `prefix` ("eisenhower:" by default), so a web host
 * keeps documents between visits. Another tab writing the same key is caught by the revision.
 */
export function localStorageAdapter(prefix = "eisenhower:", storage?: Storage): StorageAdapter {
  const place = (key: string): Storage => {
    try {
      const found = storage ?? globalThis.localStorage;
      if (found) return found;
    } catch (cause) {
      throw new StorageError("unavailable", key, String(cause), { cause });
    }
    throw new StorageError("unavailable", key, "localStorage is not available");
  };
  const readText = (key: string): string | null => {
    const where = place(key);
    try {
      return where.getItem(prefix + key);
    } catch (cause) {
      throw new StorageError("readFailed", key, String(cause), { cause });
    }
  };
  return {
    async read(key) {
      const text = readText(key);
      return text === null ? null : { text, revision: await textRevision(text) };
    },
    async write(key, text, expectedRevision) {
      if (expectedRevision !== undefined) {
        const current = readText(key);
        if (current === null || (await textRevision(current)) !== expectedRevision) {
          throw new StorageError("changed", key);
        }
      }
      const where = place(key);
      try {
        where.setItem(prefix + key, text);
      } catch (cause) {
        throw new StorageError("writeFailed", key, String(cause), { cause });
      }
      return textRevision(text);
    },
  };
}
