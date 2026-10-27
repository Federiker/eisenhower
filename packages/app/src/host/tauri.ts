import { type DocumentKind, loadDocument, saveDocument, StorageError } from "@eisenhower/model";
import { tauriStorage } from "@eisenhower/tauri";
import { ask, open, save } from "@tauri-apps/plugin-dialog";

import { fill, appStrings as text } from "../strings";
import { Cancelled, type Host, type OpenDocument, type Question } from "./host";
import { baseName, DOCUMENT_EXTENSION, fileName } from "./names";

const FILTERS = [{ name: text.documentFiles, extensions: [DOCUMENT_EXTENSION] }];

const askQuestion = ({ title, message, ok, cancel }: Question) =>
  ask(message, { title, kind: "warning", okLabel: ok, cancelLabel: cancel });

/**
 * The Tauri window: documents opened and saved as files through `tauri-plugin-eisenhower` (`tauriStorage`,
 * whose revision is the file's hash), the files chosen with Tauri's dialog plugin.
 */
export function tauriHost(): Host {
  const storage = tauriStorage();

  /** Writes a new file the user chooses; the dialog has asked before replacing one, so no revision is quoted. */
  async function saveAs<T>(document: OpenDocument<T>, kind: DocumentKind<T>): Promise<OpenDocument<T>> {
    const path = await save({ defaultPath: document.key ?? fileName(document.name), filters: FILTERS });
    if (path === null) throw new Cancelled();
    const revision = await saveDocument(storage, path, kind, document.data);
    return { data: document.data, name: baseName(path), key: path, revision };
  }

  /**
   * Writes the file the document was read from, with the hash it was read with: if another program changed
   * the file since, the plugin refuses, and the user is asked whether to overwrite it.
   */
  async function saveInPlace<T>(document: OpenDocument<T>, path: string, kind: DocumentKind<T>) {
    try {
      return { ...document, revision: await saveDocument(storage, path, kind, document.data, document.revision) };
    } catch (error) {
      if (!(error instanceof StorageError) || error.problem !== "changed") throw error;
      const overwrite = await askQuestion({
        title: text.changedOnDiskTitle,
        message: fill(text.changedOnDisk, { name: document.name }),
        ok: text.overwrite,
        cancel: text.cancel,
      });
      if (!overwrite) throw error;
      return { ...document, revision: await saveDocument(storage, path, kind, document.data) };
    }
  }

  return {
    kind: "tauri",
    start: async (_key, _kind, sample) => sample,
    open: async <T>(kind: DocumentKind<T>) => {
      const path = await open({ multiple: false, directory: false, filters: FILTERS });
      if (path === null) return null;
      const loaded = await loadDocument(storage, path, kind);
      if (loaded === null) throw new StorageError("readFailed", path, "there is no file at the path");
      return { data: loaded.data, name: baseName(path), key: path, revision: loaded.revision };
    },
    save: (document, kind) =>
      document.key === undefined ? saveAs(document, kind) : saveInPlace(document, document.key, kind),
    saveAs,
    ask: askQuestion,
  };
}
