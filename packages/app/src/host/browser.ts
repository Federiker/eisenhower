import { type DocumentKind, loadDocument, localStorageAdapter, saveDocument, StorageError } from "@eisenhower/model";

import { fill, appStrings as text } from "../strings";
import { Cancelled, type Host, type OpenDocument, type Question } from "./host";

/** Where the browser keeps the demo's documents: `localStorage`, each key under this prefix. */
export const BROWSER_PREFIX = "eisenhower-demo:";

const ask = async ({ message }: Question) => confirm(message);

/**
 * The browser: each document kept in `localStorage` under its slot's key, saved by the app as it changes.
 * A save quotes the revision read, so another tab's change is not overwritten without asking.
 */
export function browserHost(): Host {
  const storage = localStorageAdapter(BROWSER_PREFIX);

  async function save<T>(document: OpenDocument<T>, kind: DocumentKind<T>): Promise<OpenDocument<T>> {
    const { key } = document;
    if (key === undefined) throw new Cancelled();
    try {
      return { ...document, revision: await saveDocument(storage, key, kind, document.data, document.revision) };
    } catch (error) {
      if (!(error instanceof StorageError) || error.problem !== "changed") throw error;
      const overwrite = await ask({
        title: text.changedElsewhereTitle,
        message: fill(text.changedElsewhere, { name: document.name }),
        ok: text.overwrite,
        cancel: text.cancel,
      });
      if (!overwrite) throw new Cancelled();
      return { ...document, revision: await saveDocument(storage, key, kind, document.data) };
    }
  }

  return {
    kind: "browser",
    start: async (key, kind, sample) => {
      const stored = await loadDocument(storage, key, kind);
      return stored ? { ...sample, data: stored.data, key, revision: stored.revision } : { ...sample, key };
    },
    open: undefined,
    save,
    saveAs: undefined,
    ask,
    guardClose: undefined,
  };
}
