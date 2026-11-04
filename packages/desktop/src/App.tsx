import { EisenhowerProvider, Select, type Theme } from "@eisenhower/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { type DocumentControls, DocumentScreen } from "./DocumentScreen";
import { type AnyDocument, emptyDocument, loadAnyDocument, type NewType, saveAnyDocument } from "./documents";
import type { Host } from "./host/host";
import { messageOf } from "./host/messages";
import { baseName, fileName } from "./host/names";
import { appCommand } from "./keys";
import { addRecent, pruneRecent, type RecentDocument, readRecent, removeRecent, writeRecent } from "./recent";
import { LOCALES, readSettings, type Settings, writeSettings } from "./settings";
import { StartScreen } from "./StartScreen";
import { fill, appStrings as text } from "./strings";
import type { OpenFile, Report } from "./useFileDocument";

type Message = { text: string; tone: "status" | "error" };

/** The document shown, with a number that tells two openings of the same file apart. */
type Shown = OpenFile & { opening: number };

/** The window's `localStorage`, or none where the browser refuses it. */
function windowStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * The desktop app: the start screen (the recent documents, Open… and a new document) and one document at a
 * time in its view. `host` is where it runs: the Tauri window, or the preview in a browser. `keep` holds the
 * recent list and the settings (the window's `localStorage`).
 */
export function App({ host, keep = windowStorage() }: { host: Host; keep?: Storage | undefined }) {
  const [settings, setSettings] = useState<Settings>(() => readSettings(keep));
  const [message, setMessage] = useState<Message | null>(null);
  const report: Report = useCallback((said, tone) => setMessage({ text: said, tone }), []);
  const [initialRecent] = useState(() => (keep ? readRecent(keep) : { list: [], unreadable: false }));
  const [recent, setRecentState] = useState<readonly RecentDocument[]>(initialRecent.list);
  const recentRef = useRef(recent);
  const [shown, setShown] = useState<Shown | null>(null);
  const openings = useRef(0);
  const controls = useRef<DocumentControls | null>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const focusName = useRef(false);

  useEffect(() => {
    if (initialRecent.unreadable) report(text.recentUnreadable, "error");
  }, [initialRecent, report]);

  const setRecent = useCallback(
    (next: readonly RecentDocument[]) => {
      recentRef.current = next;
      setRecentState(next);
      if (!keep || !writeRecent(keep, next)) report(text.recentNotKept, "error");
    },
    [keep, report],
  );

  const remember = useCallback(
    (path: string, name: string, document: AnyDocument) =>
      setRecent(addRecent(recentRef.current, { path, name, kind: document.kind, opened: new Date().toISOString() })),
    [setRecent],
  );

  const changeSettings = (next: Settings) => {
    setSettings(next);
    writeSettings(keep, next);
  };

  const show = useCallback(
    (file: OpenFile) => {
      openings.current += 1;
      setShown({ ...file, opening: openings.current });
      remember(file.path, file.name, file.document);
    },
    [remember],
  );

  /** Whether the open document's unsaved changes may be let go (asked only when there are some). */
  const mayLeave = useCallback(async () => {
    const open = controls.current;
    if (!open?.dirty) return true;
    return host.ask({
      title: text.discardTitle,
      message: fill(text.discard, { name: open.name }),
      ok: text.discardOk,
      cancel: text.cancel,
    });
  }, [host]);

  /** Opens the file at `path` in place of the one shown; a file that cannot be opened leaves the screen as it is. */
  const load = useCallback(
    async (path: string) => {
      const name = baseName(path);
      try {
        const loaded = await loadAnyDocument(host.storage, path);
        if (loaded === null) {
          setRecent(removeRecent(recentRef.current, path));
          report(fill(text.notFound, { name }), "error");
          return;
        }
        show({ document: loaded.document, path, name, revision: loaded.revision });
        report(fill(text.opened, { name }), "status");
      } catch (error) {
        console.error(error);
        report(messageOf(error, name, text.openFailed), "error");
      }
    },
    [host, report, setRecent, show],
  );

  const openRecent = useCallback(
    async (document: RecentDocument) => {
      if (await mayLeave()) await load(document.path);
    },
    [mayLeave, load],
  );

  const chooseAndOpen = useCallback(async () => {
    try {
      if (!(await mayLeave())) return;
      const path = await host.chooseFile();
      if (path !== null) await load(path);
    } catch (error) {
      console.error(error);
      report(fill(text.openFailed, { name: text.title }), "error");
    }
  }, [host, mayLeave, load, report]);

  /** Asks where to save a new document of `type`, writes its empty data there and opens it. */
  const create = useCallback(
    async (type: NewType, name: string) => {
      let path: string | null = null;
      try {
        path = await host.chooseNewFile(fileName(name));
        if (path === null) return;
        const document = emptyDocument(type);
        // The dialogue has asked before replacing a file, so no revision is quoted.
        const revision = await saveAnyDocument(host.storage, path, document);
        show({ document, path, name: baseName(path), revision });
        report(fill(text.created, { name: baseName(path) }), "status");
      } catch (error) {
        console.error(error);
        report(messageOf(error, path === null ? fileName(name) : baseName(path), text.createFailed), "error");
      }
    },
    [host, report, show],
  );

  const goStart = useCallback(async () => {
    if (!(await mayLeave())) return false;
    controls.current = null;
    setShown(null);
    return true;
  }, [mayLeave]);

  const newDocument = useCallback(async () => {
    if (shown === null) {
      nameField.current?.focus();
      return;
    }
    focusName.current = true;
    if (!(await goStart())) focusName.current = false;
  }, [shown, goStart]);

  // On the start screen: the window's plain title, the name's field focused after Ctrl+N, and the files that
  // are gone taken off the recent list.
  useEffect(() => {
    if (shown !== null) return undefined;
    host.setTitle(text.title).catch((error: unknown) => console.error(error));
    if (focusName.current) {
      focusName.current = false;
      nameField.current?.focus();
    }
    let current = true;
    const listed = recentRef.current;
    const exists = async (path: string) => (await host.storage.read(path)) !== null;
    void pruneRecent(listed, exists).then((kept) => {
      // Only when nothing has been opened meanwhile, which would have changed the list.
      if (current && kept !== listed && recentRef.current === listed) setRecent(kept);
    });
    return () => {
      current = false;
    };
  }, [host, shown, setRecent]);

  // Ctrl+N and Ctrl+O, on every screen (the open document handles Save, Save as, Undo and Redo).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = appCommand(event);
      if (command !== "new" && command !== "open") return;
      event.preventDefault();
      void (command === "new" ? newDocument() : chooseAndOpen());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [newDocument, chooseAndOpen]);

  // The window asks before closing while the open document has unsaved changes.
  useEffect(() => {
    if (!host.guardClose) return undefined;
    let stop: (() => void) | undefined;
    let gone = false;
    host
      .guardClose(
        () => {
          const open = controls.current;
          return open?.dirty ? { name: open.name, save: open.save } : null;
        },
        (error) => {
          console.error(error);
          report(text.closeFailed, "error");
        },
      )
      .then(
        (unlisten) => {
          if (gone) unlisten();
          else stop = unlisten;
        },
        (error: unknown) => {
          console.error(error);
          report(text.closeUnguarded, "error");
        },
      );
    return () => {
      gone = true;
      stop?.();
    };
  }, [host, report]);

  return (
    <EisenhowerProvider theme={settings.theme} locale={settings.locale} className="app">
      <header className="app-header">
        <h1 className="app-title">{text.title}</h1>
        {host.kind === "preview" && <p className="app-preview">{text.preview}</p>}
        {/* biome-ignore lint/a11y/useSemanticElements: a row of settings, not a form's fieldset */}
        <div className="app-settings" role="group" aria-label={text.settings}>
          <label htmlFor="app-theme">{text.theme}</label>
          <Select
            id="app-theme"
            value={settings.theme}
            onChange={(event) => changeSettings({ ...settings, theme: event.target.value as Theme })}
          >
            <option value="system">{text.themeSystem}</option>
            <option value="light">{text.themeLight}</option>
            <option value="dark">{text.themeDark}</option>
          </Select>
          <label htmlFor="app-locale">{text.locale}</label>
          <Select
            id="app-locale"
            value={settings.locale}
            onChange={(event) => changeSettings({ ...settings, locale: event.target.value })}
          >
            {LOCALES.map((option) => (
              <option key={option.id} value={option.id} lang={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </header>
      {shown === null ? (
        <StartScreen
          recent={recent}
          locale={settings.locale}
          onOpenRecent={(document) => void openRecent(document)}
          onOpen={() => void chooseAndOpen()}
          onCreate={create}
          nameField={nameField}
        />
      ) : (
        <DocumentScreen
          key={shown.opening}
          host={host}
          file={shown}
          report={report}
          stored={remember}
          onStart={() => void goStart()}
          onOpen={() => void chooseAndOpen()}
          controls={controls}
        />
      )}
      <footer className="app-footer">
        <p role="status" className="app-status">
          {message?.tone === "status" ? message.text : ""}
        </p>
        <p role="alert" className="app-error">
          {message?.tone === "error" ? message.text : ""}
        </p>
      </footer>
    </EisenhowerProvider>
  );
}
