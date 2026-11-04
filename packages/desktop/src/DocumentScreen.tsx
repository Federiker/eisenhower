import {
  Board,
  type BoardLayout,
  Button,
  Gantt,
  type GanttScale,
  TimelineEditor,
  TodoList,
  type TodoLayout,
} from "@eisenhower/react";
import { type RefObject, useEffect, useImperativeHandle, useRef, useState } from "react";

import type { AnyDocument } from "./documents";
import type { Host } from "./host/host";
import { APP_KEYS, type AppCommand, appCommand } from "./keys";
import { fill, appStrings as text } from "./strings";
import { type OpenFile, type Report, useFileDocument } from "./useFileDocument";

/** What the app needs of the open document: whether it has unsaved changes, its name, and saving it. */
export type DocumentControls = { dirty: boolean; name: string; save: () => Promise<boolean> };

/**
 * The open document in its view, with the toolbar: Start, Undo, Redo, the view's own switches, the file's
 * name (marked while it has unsaved changes), Open…, Save and Save as…. Ctrl+S saves, Ctrl+Shift+S saves as,
 * Ctrl+Z and Ctrl+Y undo and redo.
 */
export function DocumentScreen({
  host,
  file,
  report,
  stored,
  onStart,
  onOpen,
  controls,
}: {
  host: Host;
  file: OpenFile;
  report: Report;
  stored: (path: string, name: string, document: AnyDocument) => void;
  onStart: () => void;
  onOpen: () => void;
  controls: RefObject<DocumentControls | null>;
}) {
  const open = useFileDocument(host, file, report, stored);
  const { history, name, dirty, saving, save, saveAs } = open;
  const heading = useRef<HTMLHeadingElement>(null);

  useImperativeHandle(controls, () => ({ dirty, name, save }), [dirty, name, save]);

  // The focus goes to the document's name as it opens, so a screen reader hears which one it is.
  useEffect(() => heading.current?.focus(), []);

  useEffect(() => {
    void host
      .setTitle(`${dirty ? "• " : ""}${fill(text.windowTitle, { name })}`)
      .catch((error: unknown) => console.error(error));
  }, [host, name, dirty]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = appCommand(event);
      const actions: Partial<Record<AppCommand, () => unknown>> = {
        save,
        saveAs,
        undo: history.undo,
        redo: history.redo,
      };
      const act = command ? actions[command] : undefined;
      if (!act) return;
      event.preventDefault();
      void act();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save, saveAs, history]);

  return (
    <main className="app-main app-panel">
      {/* biome-ignore lint/a11y/useSemanticElements: a row of buttons, not a form's fieldset */}
      <div className="app-toolbar" role="group" aria-label={text.documentActions}>
        <Button onClick={onStart}>{text.start}</Button>
        <Button onClick={history.undo} disabled={!history.canUndo} aria-keyshortcuts={APP_KEYS.undo}>
          {text.undo}
        </Button>
        <Button onClick={history.redo} disabled={!history.canRedo} aria-keyshortcuts={APP_KEYS.redo}>
          {text.redo}
        </Button>
        <div className="app-document">
          <h2 className="app-file" ref={heading} tabIndex={-1}>
            {name}
            {dirty && (
              <span className="app-dirty" title={text.unsaved}>
                <span aria-hidden="true">{" •"}</span>
                <span className="eh-visually-hidden">{text.unsaved}</span>
              </span>
            )}
          </h2>
          <Button onClick={onOpen} aria-keyshortcuts={APP_KEYS.open}>
            {text.open}
          </Button>
          <Button onClick={() => void save()} disabled={saving} aria-keyshortcuts={APP_KEYS.save}>
            {text.save}
          </Button>
          <Button onClick={() => void saveAs()} disabled={saving} aria-keyshortcuts={APP_KEYS.saveAs}>
            {text.saveAs}
          </Button>
        </div>
      </div>
      <View document={history.value} onChange={history.set} />
    </main>
  );
}

/** The view of the document's kind, with the switches the app keeps for it. */
function View({ document, onChange }: { document: AnyDocument; onChange: (next: AnyDocument) => void }) {
  const [boardLayout, setBoardLayout] = useState<BoardLayout>("board");
  const [scale, setScale] = useState<GanttScale>("week");
  const [todoLayout, setTodoLayout] = useState<TodoLayout>("list");
  switch (document.kind) {
    case "board":
      return (
        <>
          {/* biome-ignore lint/a11y/useSemanticElements: a group of toggle buttons, as the views' toolbars have */}
          <div role="group" aria-label={text.boardLayout} className="app-choice">
            <Button pressed={boardLayout === "board"} onClick={() => setBoardLayout("board")}>
              {text.layoutBoard}
            </Button>
            <Button pressed={boardLayout === "list"} onClick={() => setBoardLayout("list")}>
              {text.layoutList}
            </Button>
          </div>
          <Board value={document.data} onChange={(data) => onChange({ kind: "board", data })} layout={boardLayout} />
        </>
      );
    case "timeline":
      return <TimelineEditor value={document.data} onChange={(data) => onChange({ kind: "timeline", data })} />;
    case "gantt":
      return (
        <Gantt
          value={document.data}
          onChange={(data) => onChange({ kind: "gantt", data })}
          scale={scale}
          onScaleChange={setScale}
        />
      );
    case "todo":
      return (
        <TodoList
          value={document.data}
          onChange={(data) => onChange({ kind: "todo", data })}
          layout={todoLayout}
          onLayoutChange={setTodoLayout}
        />
      );
  }
}
