import { boardDocument, ganttDocument, type Timeline, timelineDocument, today, todoDocument } from "@eisenhower/model";
import {
  Board,
  type BoardLayout,
  Button,
  EisenhowerProvider,
  Gantt,
  type GanttScale,
  type History,
  Select,
  type Theme,
  TimelineEditor,
  type TodoLayout,
  TodoList,
} from "@eisenhower/react";
import { isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

import { browserHost } from "./host/browser";
import type { Host } from "./host/host";
import { tauriHost } from "./host/tauri";
import { boardSample } from "./samples/board";
import { ganttSample } from "./samples/gantt";
import { datesSample, sequenceSample } from "./samples/timeline";
import { todoSample } from "./samples/todo";
import { appStrings as text } from "./strings";
import { Tabs, type TabSpec } from "./Tabs";
import { type DemoDocument, type Report, useDemoDocument } from "./useDocument";
import { isUndoKey } from "./undoKeys";

/** In the Tauri window (decision 14) the app works on files on disk; anywhere else, in the browser. */
const HOST: Host = isTauri() ? tauriHost() : browserHost();

/** The samples' days are around the day the app opens, so the gantt chart and the due days stay current. */
const TODAY = today();

const samples = {
  board: () => ({ data: boardSample(), name: text.sampleBoard }),
  dates: () => ({ data: datesSample(), name: text.sampleDates }),
  sequence: () => ({ data: sequenceSample(), name: text.sampleSequence }),
  gantt: () => ({ data: ganttSample(TODAY), name: text.sampleGantt }),
  todo: () => ({ data: todoSample(TODAY), name: text.sampleTodo }),
};

type Tab = "board" | "timeline" | "gantt" | "todo";

const TABS: readonly TabSpec<Tab>[] = [
  { id: "board", label: text.board },
  { id: "timeline", label: text.timeline },
  { id: "gantt", label: text.gantt },
  { id: "todo", label: text.todo },
];

const LOCALES = [
  { id: "en-GB", label: "English (United Kingdom)" },
  { id: "en-US", label: "English (United States)" },
  { id: "it-IT", label: "Italiano (Italia)" },
  { id: "de-DE", label: "Deutsch (Deutschland)" },
];

/** The tab named in the address (`#gantt`), so a link or a reload opens it. */
function tabOfHash(): Tab {
  const named = window.location.hash.slice(1);
  return TABS.find((tab) => tab.id === named)?.id ?? "board";
}

/** What the app's toolbar does with the document shown, whatever its view. */
type DocumentControls = Omit<DemoDocument<unknown>, "history"> & {
  history: Pick<History<unknown>, "undo" | "redo" | "canUndo" | "canRedo">;
};

type Message = { text: string; tone: "status" | "error" };

/** The demo app: each view with a sample document, undo and redo, the theme and locale, and the host's storage. */
export function App() {
  const [tab, setTab] = useState<Tab>(tabOfHash);
  const [theme, setTheme] = useState<Theme>("system");
  const [locale, setLocale] = useState("en-GB");
  const [boardLayout, setBoardLayout] = useState<BoardLayout>("board");
  const [whichTimeline, setWhichTimeline] = useState<"dates" | "sequence">("dates");
  const [scale, setScale] = useState<GanttScale>("week");
  const [todoLayout, setTodoLayout] = useState<TodoLayout>("list");
  const [message, setMessage] = useState<Message | null>(null);
  const report: Report = useCallback((said, tone) => setMessage({ text: said, tone }), []);

  const board = useDemoDocument(HOST, "board", boardDocument, samples.board, report);
  const dates = useDemoDocument(HOST, "timeline-dates", timelineDocument, samples.dates, report);
  const sequence = useDemoDocument(HOST, "timeline-sequence", timelineDocument, samples.sequence, report);
  const gantt = useDemoDocument(HOST, "gantt", ganttDocument, samples.gantt, report);
  const todo = useDemoDocument(HOST, "todo", todoDocument, samples.todo, report);
  const timeline: DemoDocument<Timeline> = whichTimeline === "dates" ? dates : sequence;
  const current: DocumentControls = { board, timeline, gantt, todo }[tab];
  const { history } = current;

  const chooseTab = useCallback((next: Tab) => {
    setTab(next);
    window.history.replaceState(null, "", `#${next}`);
  }, []);

  useEffect(() => {
    const onHashChange = () => setTab(tabOfHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Ctrl+Z undoes and Ctrl+Y or Ctrl+Shift+Z redoes the shown document, except in a field (which has its
  // own undo) or a dialogue (whose changes are not made yet). The app's keys, not the views' (see the README).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const which = isUndoKey(event);
      if (!which) return;
      event.preventDefault();
      if (which === "undo") history.undo();
      else history.redo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [history]);

  return (
    <EisenhowerProvider theme={theme} locale={locale} className="app">
      <header className="app-header">
        <div className="app-title">
          <h1>{text.title}</h1>
          <span className="app-subtitle">{text.subtitle}</span>
        </div>
        <Tabs label={text.views} tabs={TABS} selected={tab} onSelect={chooseTab} />
        <div className="app-settings">
          <label htmlFor="app-theme">{text.theme}</label>
          <Select id="app-theme" value={theme} onChange={(event) => setTheme(event.target.value as Theme)}>
            <option value="system">{text.themeSystem}</option>
            <option value="light">{text.themeLight}</option>
            <option value="dark">{text.themeDark}</option>
          </Select>
          <label htmlFor="app-locale">{text.locale}</label>
          <Select id="app-locale" value={locale} onChange={(event) => setLocale(event.target.value)}>
            {LOCALES.map((option) => (
              <option key={option.id} value={option.id} lang={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </header>
      <main className="app-main">
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="app-panel">
          {/* biome-ignore lint/a11y/useSemanticElements: a row of buttons, not a form's fieldset */}
          <div className="app-toolbar" role="group" aria-label={text.documentActions}>
            <Button onClick={history.undo} disabled={!history.canUndo} aria-keyshortcuts="Control+Z">
              {text.undo}
            </Button>
            <Button onClick={history.redo} disabled={!history.canRedo} aria-keyshortcuts="Control+Y Control+Shift+Z">
              {text.redo}
            </Button>
            <ViewChoices
              tab={tab}
              boardLayout={boardLayout}
              onBoardLayout={setBoardLayout}
              whichTimeline={whichTimeline}
              onWhichTimeline={setWhichTimeline}
              timelineNames={{ dates: dates.name, sequence: sequence.name }}
            />
            <DocumentActions document={current} host={HOST} />
          </div>
          {tab === "board" && <Board value={board.history.value} onChange={board.history.set} layout={boardLayout} />}
          {tab === "timeline" && (
            <TimelineEditor key={whichTimeline} value={timeline.history.value} onChange={timeline.history.set} />
          )}
          {tab === "gantt" && (
            <Gantt value={gantt.history.value} onChange={gantt.history.set} scale={scale} onScaleChange={setScale} />
          )}
          {tab === "todo" && (
            <TodoList
              value={todo.history.value}
              onChange={todo.history.set}
              layout={todoLayout}
              onLayoutChange={setTodoLayout}
            />
          )}
        </div>
      </main>
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

/** The switches of the tab shown: the board's layout, or which timeline. */
function ViewChoices({
  tab,
  boardLayout,
  onBoardLayout,
  whichTimeline,
  onWhichTimeline,
  timelineNames,
}: {
  tab: Tab;
  boardLayout: BoardLayout;
  onBoardLayout: (layout: BoardLayout) => void;
  whichTimeline: "dates" | "sequence";
  onWhichTimeline: (which: "dates" | "sequence") => void;
  timelineNames: { dates: string; sequence: string };
}) {
  if (tab === "board") {
    return (
      // biome-ignore lint/a11y/useSemanticElements: a group of toggle buttons, as the views' toolbars have
      <div role="group" aria-label={text.boardLayout} className="app-choice">
        <Button pressed={boardLayout === "board"} onClick={() => onBoardLayout("board")}>
          {text.layoutBoard}
        </Button>
        <Button pressed={boardLayout === "list"} onClick={() => onBoardLayout("list")}>
          {text.layoutList}
        </Button>
      </div>
    );
  }
  if (tab === "timeline") {
    return (
      // biome-ignore lint/a11y/useSemanticElements: a group of toggle buttons, as the views' toolbars have
      <div role="group" aria-label={text.whichTimeline} className="app-choice">
        <Button pressed={whichTimeline === "dates"} onClick={() => onWhichTimeline("dates")}>
          {timelineNames.dates}
        </Button>
        <Button pressed={whichTimeline === "sequence"} onClick={() => onWhichTimeline("sequence")}>
          {timelineNames.sequence}
        </Button>
      </div>
    );
  }
  return null;
}

/** The host's actions on the document shown, its name and whether it is saved. */
function DocumentActions({ document, host }: { document: DocumentControls; host: Host }) {
  if (host.kind === "browser") {
    const state = !document.autosave
      ? text.notSavedHere
      : document.dirty || document.saving
        ? text.saving
        : text.savedHere;
    return (
      <div className="app-document">
        <span className="app-file">{document.name}</span>
        <span className="app-save-state" data-saved={document.autosave && !document.dirty && !document.saving}>
          {state}
        </span>
        <Button onClick={() => void document.reset()}>{text.reset}</Button>
      </div>
    );
  }
  return (
    <div className="app-document">
      <span className="app-file">
        {document.name}
        {document.dirty && (
          <span className="app-dirty" title={text.unsaved}>
            <span aria-hidden="true">{" •"}</span>
            <span className="eh-visually-hidden">{text.unsaved}</span>
          </span>
        )}
      </span>
      <Button onClick={() => void document.open()}>{text.open}</Button>
      <Button onClick={() => void document.save()} disabled={document.saving}>
        {text.save}
      </Button>
      <Button onClick={() => void document.saveAs()} disabled={document.saving}>
        {text.saveAs}
      </Button>
      <Button onClick={() => void document.reset()}>{text.sample}</Button>
    </div>
  );
}
