import { StorageError } from "@eisenhower/model";
import { type History, useHistory } from "@eisenhower/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { type AnyDocument, saveAnyDocument } from "./documents";
import { Cancelled, type Host } from "./host/host";
import { messageOf } from "./host/messages";
import { baseName, fileName } from "./host/names";
import { fill, appStrings as text } from "./strings";

/** Says something to the user: in the polite status region, or as an error. */
export type Report = (message: string, tone: "status" | "error") => void;

/** A document open from a file: what it holds, its path and name, and the revision it was read with. */
export type OpenFile = { document: AnyDocument; path: string; name: string; revision: string };

/** Where the open document is and what it was when last stored (`saved`: unchanged since when equal). */
type Meta = { path: string; name: string; revision: string | undefined; saved: AnyDocument };

export type FileDocument = {
  /** The document with its undo and redo: the view's `value` and `onChange`. */
  history: History<AnyDocument>;
  name: string;
  path: string;
  /** Whether it has changes not saved yet. */
  dirty: boolean;
  saving: boolean;
  /** Saves it where it came from; resolves false when it was not saved (cancelled or failed). */
  save: () => Promise<boolean>;
  /** Saves it in a new file the user chooses, which it then is. */
  saveAs: () => Promise<boolean>;
};

/**
 * The document open in the window, from the demo's `useDemoDocument`: its value and history, its file, and
 * saving it. Save writes the file with the revision it was read with (the hash guard) and asks before
 * overwriting a file another program changed since; Save as… asks for a new file. `stored` hears of each file
 * it is saved in, for the recent list.
 */
export function useFileDocument(
  host: Host,
  file: OpenFile,
  report: Report,
  stored: (path: string, name: string, document: AnyDocument) => void,
): FileDocument {
  const history = useHistory<AnyDocument>(file.document);
  const [meta, setMetaState] = useState<Meta>({
    path: file.path,
    name: file.name,
    revision: file.revision,
    saved: file.document,
  });
  const [saving, setSaving] = useState(false);
  const metaRef = useRef(meta);
  const valueRef = useRef(history.value);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  useLayoutEffect(() => {
    valueRef.current = history.value;
  }, [history.value]);

  const setMeta = useCallback((next: Meta) => {
    metaRef.current = next;
    setMetaState(next);
  }, []);

  /** Writes in place, quoting the revision; when the file changed since, asks before overwriting it. */
  const writeInPlace = useCallback(
    async (document: AnyDocument, { path, name, revision }: Meta) => {
      try {
        return await saveAnyDocument(host.storage, path, document, revision);
      } catch (error) {
        if (!(error instanceof StorageError) || error.problem !== "changed") throw error;
        const overwrite = await host.ask({
          title: text.changedOnDiskTitle,
          message: fill(text.changedOnDisk, { name }),
          ok: text.overwrite,
          cancel: text.cancel,
        });
        if (!overwrite) throw new Cancelled();
        return saveAnyDocument(host.storage, path, document);
      }
    },
    [host],
  );

  /** Saves the value as it is when its turn comes: one save at a time, each quoting the last one's revision. */
  const store = useCallback(
    (how: "save" | "saveAs") => {
      const run = async () => {
        const document = valueRef.current;
        const current = metaRef.current;
        setSaving(true);
        try {
          let { path, name } = current;
          let revision: string;
          if (how === "saveAs") {
            const chosen = await host.chooseNewFile(fileName(current.name));
            if (chosen === null) throw new Cancelled();
            // The dialogue has asked before replacing a file, so no revision is quoted.
            revision = await saveAnyDocument(host.storage, chosen, document);
            path = chosen;
            name = baseName(chosen);
            stored(path, name, document);
          } else {
            revision = await writeInPlace(document, current);
          }
          setMeta({ path, name, revision, saved: document });
          report(fill(text.saved, { name }), "status");
          return true;
        } catch (error) {
          if (error instanceof Cancelled) report(text.notSaved, "status");
          else {
            console.error(error);
            report(messageOf(error, current.name, text.saveFailed), "error");
          }
          return false;
        } finally {
          setSaving(false);
        }
      };
      const next = queue.current.then(run);
      queue.current = next;
      return next;
    },
    [host, report, setMeta, stored, writeInPlace],
  );

  return {
    history,
    name: meta.name,
    path: meta.path,
    dirty: history.value !== meta.saved,
    saving,
    save: useCallback(() => store("save"), [store]),
    saveAs: useCallback(() => store("saveAs"), [store]),
  };
}
