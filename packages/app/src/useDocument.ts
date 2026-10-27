import type { DocumentKind } from "@eisenhower/model";
import { type History, useHistory } from "@eisenhower/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { Cancelled, type Host, type OpenDocument } from "./host/host";
import { messageOf, storedProblem } from "./host/messages";
import { fill, appStrings as text } from "./strings";

/** How long the browser waits after a change before saving, so a burst of changes is one save. */
export const AUTOSAVE_DELAY = 400;

/** Says something to the user: in the polite status region, or as an error. */
export type Report = (message: string, tone: "status" | "error") => void;

/** Where the open document is kept and what it was when last stored (`saved`: unchanged since when equal). */
type Meta<T> = { name: string; key: string | undefined; revision: string | undefined; saved: T };

export type DemoDocument<T> = {
  /** The document's value with its undo and redo: the view's `value` and `onChange`. */
  history: History<T>;
  name: string;
  /** Whether it has changes not stored yet. */
  dirty: boolean;
  saving: boolean;
  /** Whether the browser saves it as it changes (off while a stored copy could not be read). */
  autosave: boolean;
  /** Opens a file in its place (the window), asking first when there are unsaved changes. */
  open: () => Promise<void>;
  save: () => Promise<void>;
  saveAs: () => Promise<void>;
  /** The browser: the sample again, as a change that can be undone. The window: the sample, on no file. */
  reset: () => Promise<void>;
};

/**
 * One of the demo's documents: its value and history, where it is stored, and the host's actions on it. In
 * the browser it starts from what is stored under `key` (else `sample`) and is saved a moment after each
 * change; in the window it starts from the sample and is saved on request.
 */
export function useDemoDocument<T>(
  host: Host,
  key: string,
  kind: DocumentKind<T>,
  sample: () => OpenDocument<T>,
  report: Report,
): DemoDocument<T> {
  const [initial] = useState(sample);
  const history = useHistory(initial.data);
  const [meta, setMetaState] = useState<Meta<T>>({
    name: initial.name,
    key: undefined,
    revision: undefined,
    saved: initial.data,
  });
  const [ready, setReady] = useState(host.kind !== "browser");
  const [autosave, setAutosave] = useState(host.kind === "browser");
  const [saving, setSaving] = useState(false);
  const metaRef = useRef(meta);
  const valueRef = useRef(history.value);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const { reset: resetHistory, set: setValue } = history;

  useLayoutEffect(() => {
    valueRef.current = history.value;
  }, [history.value]);

  const setMeta = useCallback((next: Meta<T>) => {
    metaRef.current = next;
    setMetaState(next);
  }, []);

  /** Takes a document as the one open, with nothing to undo. */
  const take = useCallback(
    (document: OpenDocument<T>) => {
      resetHistory(document.data);
      valueRef.current = document.data;
      setMeta({ name: document.name, key: document.key, revision: document.revision, saved: document.data });
    },
    [resetHistory, setMeta],
  );

  useEffect(() => {
    let current = true;
    host.start(key, kind, initial).then(
      (document) => {
        if (!current) return;
        take(document);
        setReady(true);
      },
      (error: unknown) => {
        if (!current) return;
        console.error(error);
        report(storedProblem(error, initial.name), "error");
        setMeta({ name: initial.name, key, revision: undefined, saved: initial.data });
        setAutosave(false);
        setReady(true);
      },
    );
    return () => {
      current = false;
    };
  }, [host, key, kind, initial, take, report, setMeta]);

  /** Saves the value as it is when its turn comes: one save at a time, each quoting the last one's revision. */
  const store = useCallback(
    (how: "save" | "saveAs") => {
      const run = async () => {
        const write = how === "saveAs" ? host.saveAs : host.save;
        if (!write) return;
        const data = valueRef.current;
        const { name, key: where, revision, saved } = metaRef.current;
        if (how === "save" && host.kind === "browser" && data === saved) return;
        setSaving(true);
        try {
          const stored = await write({ data, name, key: where, revision }, kind);
          setMeta({ name: stored.name, key: stored.key, revision: stored.revision, saved: data });
          if (host.kind === "tauri") report(fill(text.saved, { name: stored.name }), "status");
        } catch (error) {
          if (error instanceof Cancelled) report(text.notSaved, "status");
          else {
            console.error(error);
            report(messageOf(error, name, text.saveFailed), "error");
          }
        } finally {
          setSaving(false);
        }
      };
      const next = queue.current.then(run);
      queue.current = next;
      return next;
    },
    [host, kind, report, setMeta],
  );

  const dirty = history.value !== meta.saved;

  useEffect(() => {
    if (host.kind !== "browser" || !ready || !autosave || !dirty) return undefined;
    const timer = setTimeout(() => void store("save"), AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
  }, [host, ready, autosave, dirty, store]);

  /** Whether the user lets unsaved changes go (asked only when there are some). */
  const mayDiscard = useCallback(async () => {
    if (valueRef.current === metaRef.current.saved) return true;
    return host.ask({
      title: text.discardTitle,
      message: fill(text.discard, { name: metaRef.current.name }),
      ok: text.discardOk,
      cancel: text.cancel,
    });
  }, [host]);

  const open = useCallback(async () => {
    if (!host.open) return;
    const name = metaRef.current.name;
    try {
      if (!(await mayDiscard())) return;
      const opened = await host.open(kind);
      if (!opened) return;
      take(opened);
      report(fill(text.opened, { name: opened.name }), "status");
    } catch (error) {
      console.error(error);
      report(messageOf(error, name, text.openFailed), "error");
    }
  }, [host, kind, mayDiscard, take, report]);

  const reset = useCallback(async () => {
    const fresh = sample();
    if (host.kind === "browser") {
      // A new value, so that it differs from what is stored and is saved; undo brings the old one back.
      setValue(fresh.data);
      setAutosave(true);
    } else {
      if (!(await mayDiscard())) return;
      take(fresh);
    }
    report(fill(text.resetDone, { name: fresh.name }), "status");
  }, [host, sample, setValue, mayDiscard, take, report]);

  return {
    history,
    name: meta.name,
    dirty,
    saving,
    autosave,
    open,
    save: useCallback(() => store("save"), [store]),
    saveAs: useCallback(() => store("saveAs"), [store]),
    reset,
  };
}
