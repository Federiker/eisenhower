import { type StorageAdapter, StorageError, textRevision } from "./adapter";

/** Storage that lives as long as the page: for tests, demos and documents a host keeps elsewhere. */
export function memoryStorage(initial: Readonly<Record<string, string>> = {}): StorageAdapter {
  const texts = new Map(Object.entries(initial));
  return {
    async read(key) {
      const text = texts.get(key);
      return text === undefined ? null : { text, revision: await textRevision(text) };
    },
    async write(key, text, expectedRevision) {
      if (expectedRevision !== undefined) {
        const current = texts.get(key);
        if (current === undefined || (await textRevision(current)) !== expectedRevision) {
          throw new StorageError("changed", key);
        }
      }
      texts.set(key, text);
      return textRevision(text);
    },
  };
}
