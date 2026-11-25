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
  document's name (its file's name without `.ike` or `.json`), its kind
  (Board, Timeline, Gantt chart, Todo list), its folder and when it was
  last opened; choosing one opens it. The list is
  kept in the window's `localStorage` (`eisenhower-desktop:recent`), so the
  development window (Vite's address) and the built app keep separate lists.
  A document is put at the top each time it is opened, created or saved
  under a new name. When the start screen shows, files that are no longer
  there (the plugin answers null for the path) are dropped from the list
  without a word; a file that is there but cannot be read stays listed, and
  opening it says why.
- **Open…**: a file chosen with the dialog (the filter "Eisenhower
  documents", `*.ike` and `*.json`); its `kind` says which view it is for, so any
  document opens. One that is not a valid document is refused with its
  problem in words, and the start screen stays.
- **New document**: a form with the type (Board, Timeline (dates), Timeline
  (sequence), Gantt chart, Todo list) and a name; **Create…** asks where
  with a save dialog suggesting `<name>.ike`, writes the kind's empty
  document there (`serialiseDocument` with the kind's `DocumentKind`,
  through `saveDocument` and `tauriStorage`; `emptyBoard()`,
  `emptyTimeline("dates" | "sequence")`, `emptyGantt()`, `{ items: [] }`)
  and opens it. Cancelling the dialog leaves the form as it was.

## Its files

The app saves its documents as `.ike` files (owner, 25 November 2026),
whose content is the document's JSON, the same as any host stores
(`serialiseDocument`; [the models](model.md)): only the name's end is the
app's. Open… still opens the `.json` documents saved before. **Save** writes
a document where it was read from, so a `.json` document stays `.json`
(the least surprising: its file is neither renamed nor copied); **Save as…**
and a new document suggest `.ike`. The library's packages are unchanged:
hosts that embed the documents in their own files (jerome) never read or
write `.ike`.

`.ike` files open with Eisenhower and show its icon, as jerome's projects
do with jerome (owner, 25 November 2026): the bundle registers the type
(`bundle.fileAssociations` in `tauri.conf.json`: "Eisenhower document",
`Eisenhower.Document`, role Editor). On Windows the installers (NSIS and
MSI) associate it with the program and give its files the program's own
icon (no document variant; jerome's project icon is its app icon too); on
macOS it is an exported type, `org.eisenhower.desktop.document`, conforming
to `public.json`, and Finder draws its documents with the app's icon; on
Linux the `.desktop` file declares `application/x-eisenhower`, which file
managers know only where something maps `*.ike` to it (the bundle does not
install a MIME definition).

A document double-clicked, or opened with Eisenhower, opens in the window:
as an argument when the app starts (Windows and Linux) or, on macOS, as
the system's `Opened` event; a second launch hands its arguments to the
window already open (`tauri-plugin-single-instance`), which comes to the
front. The first argument ending `.ike` or `.json` (either case; a
`file://` URL too, a relative path from the launch's folder) is kept until
the window takes it (`launch_file_take`), and one given later is sent as
the event `eisenhower://launch-file`. The window opens it as Open… does:
asking first about unsaved changes, and saying why when it cannot be
opened. Jerome's `launch_file.rs`, adapted, is the crate's `launch.rs`.

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
**Save as…** asks for a new file, suggesting the document's name with
`.ike`. Going to Start, opening another document
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

Outside the Tauri window, Vite serves the same app with a **preview host**,
marked as such in the header: its "files" are kept in the browser, by path,
through `localStorageAdapter("eisenhower-desktop-preview:")` (so a test can
put files there and a reload keeps them), and its open and save dialogues
are the page's own `prompt`, its questions `confirm`. The browser has no
close question. The end-to-end tests and the screenshots drive this
preview; the Tauri host is tested with Tauri's IPC mocks.

## Builds

`mise run app:release` builds the app for release (`tauri build`),
`mise run app:debug` a debug build (`tauri build --debug`) and
`mise run app:all` both. Each empties `dist/<release|debug>/` and moves
there the program and every installer `tauri build` made on the platform
(on Windows the `.exe`, the `.msi` and the NSIS setup `.exe`), side by side.
`mise run app:dev` runs the window on Vite (`tauri dev`). The GitHub
release's tasks (`release`, `release:dry`, decision 11) are unrelated.

## Names

The app is **Eisenhower** (`org.eisenhower.desktop`); the demo's window is
**Eisenhower demo** (its identifier, `org.eisenhower.demo`, unchanged).

## Code

The app copies the pieces of the demo it needs (the document's history and
saving, the close question, the messages, the undo keys) and adapts them to
one document of any kind, rather than sharing a package with the demo. Its
TypeScript counts in the 80% coverage measure, unlike the demo's.

## Decisions taken with the app

Choices made while building it; they stand until the owner says otherwise:

- Ctrl+N, Ctrl+O, Ctrl+S and Ctrl+Shift+S work in a text field too (only
  undo and redo are left to it); none works in a dialogue.
- The window's title starts with "• " while the document has unsaved
  changes.
- The recent list shows the document's name (without `.ike` or `.json`,
  owner, 25 November 2026), never its path in full, and the folder below
  it; a list that cannot be read is said so and starts again. The list
  keeps the file's name as it did (`name`), so lists kept before read as
  they are.
- Save keeps a `.json` document as `.json`, in place; Save as… suggests
  the document's name with `.ike`, and a name typed with `.ike` or
  `.json` is not given the extension twice.
- A new document is written as soon as its file is chosen, so a document on
  the recent list always has a file.
- The theme and the locale are kept in the window's `localStorage`; a
  setting that cannot be read is the default.
- Focus goes to the document's name when it opens and to the start screen's
  heading when it shows (the name's field after Ctrl+N).
