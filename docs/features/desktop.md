# The desktop app

Eisenhower as a desktop application: a Tauri window that opens, creates and
saves the views' documents as files. It lives in
[packages/desktop](../../packages/desktop/README.md) (`@eisenhower/desktop`,
with its native side, the crate `eisenhower_desktop`, in
`packages/desktop/src-tauri`), beside the demo app (decision 14), which it
does not replace. It is built only from the library as any host takes it:
`@eisenhower/model`, `@eisenhower/react`, `@eisenhower/tauri` and
`tauri-plugin-eisenhower` are used, never changed for it, so they stay as
importable by other apps as they were (owner decisions, 4 November 2026;
decision 19 in [development.md](../development.md#decisions)).

## The start screen

The window opens on **Start**:

- **Recent documents**, the latest opened first, up to 20: each shows the
  file's name, its kind (Board, Timeline, Gantt chart, Todo list), its
  folder and when it was last opened; choosing one opens it. The list is
  kept in the window's `localStorage` (`eisenhower-desktop:recent`), so the
  development window (Vite's address) and the built app keep separate lists.
  A document is put at the top each time it is opened, created or saved
  under a new name. When the start screen shows, files that are no longer
  there (the plugin answers null for the path) are dropped from the list
  without a word; a file that is there but cannot be read stays listed, and
  opening it says why.
- **Open…**: a file chosen with the dialog (the filter "Eisenhower
  documents", `*.json`); its `kind` says which view it is for, so any
  document opens. One that is not a valid document is refused with its
  problem in words, and the start screen stays.
- **New document**: a form with the type (Board, Timeline (dates), Timeline
  (sequence), Gantt chart, Todo list) and a name; **Create…** asks where
  with a save dialog suggesting `<name>.json`, writes the kind's empty
  document there (`serialiseDocument` with the kind's `DocumentKind`,
  through `saveDocument` and `tauriStorage`; `emptyBoard()`,
  `emptyTimeline("dates" | "sequence")`, `emptyGantt()`, `{ items: [] }`)
  and opens it. Cancelling the dialog leaves the form as it was.

## A document open

The window holds one document at a time, in its view (`<Board>`,
`<TimelineEditor>`, `<Gantt>` or `<TodoList>`), with a toolbar: **Start**
(back to the start screen), **Undo**, **Redo**, the view's own switches
(the board's layout), the file's name with a mark while it has unsaved
changes, **Open…**, **Save** and **Save as…**; the theme and the locale are
in the header on every screen, and kept between visits. The window's title
is the file's name.

Saving is the demo's: **Save** writes the file with the hash it was read
with, and asks before overwriting a file another program changed since;
**Save as…** asks for a new file. Going to Start, opening another document
or closing the window with unsaved changes asks first (Save, Don't save,
Cancel for the window; Discard or Cancel for the others), as
[the demo app](tauri.md#the-demo-app) does.

## Keys

The app's own keys (not the views'; ⌘ on macOS), listed in its README:

| Keys | Action |
| --- | --- |
| Ctrl+N | A new document: the start screen's form |
| Ctrl+O | Open a file |
| Ctrl+S | Save |
| Ctrl+Shift+S | Save as |
| Ctrl+Z, Ctrl+Y (Ctrl+Shift+Z) | Undo and redo, as in the demo |

## Outside Tauri: the preview

Outside the Tauri window, Vite serves the same app with an **in-memory
host** (marked as a preview): its "files" are kept in memory for the page,
and its open and save dialogs are the page's own. The end-to-end tests and
the screenshots drive this preview; the Tauri host is tested with Tauri's
IPC mocks.

## Builds

`mise run app:release` builds the app for release (`tauri build`),
`mise run app:debug` a debug build (`tauri build --debug`) and
`mise run app:all` both. Each empties `dist/<release|debug>/` and moves
there the program and every installer `tauri build` made on the platform
(on Windows the `.exe`, the `.msi` and the NSIS setup `.exe`), side by side.
`mise run app:dev` runs the window on Vite (`tauri dev`). The GitHub
release's tasks (`release`, `release:dry`, decision 11) are unrelated.

## Names

The app is **Eisenhower** (`org.eisenhower.app`); the demo's window is
**Eisenhower demo** (its identifier, `org.eisenhower.demo`, unchanged).

## Code

The app copies the pieces of the demo it needs (the document's history and
saving, the close question, the messages, the undo keys) and adapts them to
one document of any kind, rather than sharing a package with the demo. Its
TypeScript counts in the 80% coverage measure, unlike the demo's.
