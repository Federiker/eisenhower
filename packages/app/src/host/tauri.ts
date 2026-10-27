import { type DocumentKind, loadDocument, saveDocument, StorageError } from "@eisenhower/model";
import { tauriStorage } from "@eisenhower/tauri";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask, message, open, save } from "@tauri-apps/plugin-dialog";

import { fill, appStrings as text } from "../strings";
import { type CloseChoice, mayClose } from "./closing";
import { Cancelled, type Host, type OpenDocument, type Question } from "./host";
import { baseName, DOCUMENT_EXTENSION, fileName } from "./names";

const FILTERS = [{ name: text.documentFiles, extensions: [DOCUMENT_EXTENSION] }];

const askQuestion = ({ title, message, ok, cancel }: Question) =>
  ask(message, { title, kind: "warning", okLabel: ok, cancelLabel: cancel });

const names = new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" });

/**
 * Asks what to do with unsaved changes as the window closes, with the dialog plugin's three buttons. The
 * answer is the label of the button pressed (or the default one's name); anything else, such as closing the
 * question, is Cancel.
 */
async function askToSave(unsaved: readonly string[]): Promise<CloseChoice> {
  const buttons = { yes: text.closeSave, no: text.closeDiscard, cancel: text.cancel };
  const answer = await message(
    unsaved.length === 1
      ? fill(text.closeOne, { name: unsaved[0]! })
      : fill(text.closeMany, { names: names.format(unsaved) }),
    { title: text.closeTitle, kind: "warning", buttons },
  );
  if (answer === buttons.yes || answer === "Yes") return "save";
  if (answer === buttons.no || answer === "No") return "discard";
  return "cancel";
}

/**
 * The Tauri window: documents opened and saved as files through `tauri-plugin-eisenhower` (`tauriStorage`,
 * whose revision is the file's hash), the files chosen with Tauri's dialog plugin. Closing the window with
 * unsaved changes asks first whether to save them.
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
    guardClose: (unsaved, failed) => {
      let asking = false;
      return getCurrentWindow().onCloseRequested(async (event) => {
        // A second close while the question is open waits for its answer.
        if (asking) return event.preventDefault();
        asking = true;
        try {
          if (!(await mayClose(unsaved(), askToSave))) event.preventDefault();
        } catch (error) {
          event.preventDefault();
          failed(error);
        } finally {
          asking = false;
        }
      });
    },
  };
}
