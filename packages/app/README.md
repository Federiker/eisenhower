# @eisenhower/app

The demo app (decision 14): every view of `@eisenhower/react` on a sample
document, with undo and redo, the theme and the locale, and the storage a
host writes around the views. One Vite app runs in two places, and
`src/host/` is that integration:

- **In the browser** (`mise run dev`, port 1440; the end-to-end tests use
  it): each document is kept in the browser's `localStorage`, under
  `eisenhower-demo:` and the document's key (`board`, `timeline-dates`,
  `timeline-sequence`, `gantt`, `todo`), through `localStorageAdapter`
  (`host/browser.ts`). It is **saved automatically** 400 ms after the last
  change; the toolbar says "Saving…", then "Saved in this browser". A save
  quotes the revision it read, so when another tab has saved the same
  document since, the app asks (the browser's `confirm`) before
  overwriting it. **Reset to the sample** puts the sample back, as a change
  that Undo takes back. A stored document that cannot be read (not JSON,
  another view's, not valid…) is never half loaded: the app says why, shows
  the sample and leaves the stored copy alone until Reset to the sample.
- **As a Tauri window** (`mise run tauri:dev`): documents are files,
  opened with **Open…**, written with **Save** and **Save as…** through
  `tauriStorage` and the plugin's hash guard, and chosen with Tauri's dialog
  plugin (`host/tauri.ts`); see
  [the demo app](../../docs/features/tauri.md#the-demo-app) for how it uses
  them.

`App.tsx` picks the host: Tauri when `isTauri()` says so, else the browser.
Each document is a `useDemoDocument` (`src/useDocument.ts`): its value in
`useHistory`, where it is stored and its revision, and the host's actions.
The app's own text is in `src/strings.ts` (UK English); the views' comes
from `@eisenhower/react`.

## What it shows

- A header with the app's name, the **Board**, **Timeline**, **Gantt** and
  **Todo** tabs, the **Theme** (System, Light, Dark: the provider's `theme`,
  which colours the whole page) and the locale dates and numbers are written
  in (English (United Kingdom) by default, English (United States), Italian
  and German). The tab shown is in the address (`#gantt`), so a reload keeps
  it.
- Above each view: **Undo** and **Redo** (each document has its own
  history), the tab's own switch, the document's name and the host's
  actions.
  - **Board**: the invented "Moving house" board (no card outside a column),
    with a **Board** and **List** switch passed as `layout`.
  - **Timeline**: `<TimelineEditor>` on a Dates timeline ("History of
    science": BCE years and approximate dates, "c.") or a Sequence one ("The
    lighthouse", a story's chapters), chosen with a switch named by the
    documents.
  - **Gantt**: `<Gantt>` on a small product launch around today: groups,
    milestones, dependencies and one task that starts too early. Its scale
    (weeks to start) is kept by the app, so it survives a change of tab.
  - **Todo**: `<TodoList>` around today: tags, subtasks, due days (two
    overdue), one item done and items in all four quadrants; its List and
    Matrix layout is kept by the app.
- A footer with the status messages (a polite live region) and the errors
  (an alert).

The samples (`src/samples/`) are invented, and their days are counted from
the day the app opens, so the gantt chart and the due days stay current.

## The app's keys

The views' keys are listed in `@eisenhower/react`
([the keys](../../docs/features/interface.md#keyboard-shortcuts)). The app
adds its own, which are not the library's:

| Keys | Action |
| --- | --- |
| Ctrl+Z (⌘Z) | Undo the last change to the document shown |
| Ctrl+Y, Ctrl+Shift+Z (⌘⇧Z) | Redo it |
| ← →, Home, End on a tab | The tab before or after, the first or last (and show it) |

Undo and redo are left to a text field (its own undo) and to a dialogue
(whose changes are not made yet).

## The native side

`src-tauri/` is the crate `eisenhower_app` (a member of the root Cargo
workspace): it registers `tauri_plugin_eisenhower::init()` and Tauri's
dialog plugin, and its capability (`capabilities/main.json`) grants
`core:default`, `dialog:default` and `eisenhower:default`. `tauri dev`
starts Vite (`bun run dev`) and opens the window on it; `cargo build -p
eisenhower_app` builds the native side alone.

The logo is `src/assets/logo.svg` (CC0-1.0, made for Eisenhower); `bun run
--filter @eisenhower/app icons` makes the window's and the bundles' icons
from it in `src-tauri/icons` (PNG, ICO and ICNS, kept in Git LFS).

## Tests

`tests/` (`bun run --filter @eisenhower/app test`): the Tauri host with
Tauri's IPC mocks standing in for the window (`tests/ipc.ts`), the browser
host on happy-dom's `localStorage`, the undo keys, and the samples, which
must be valid documents that read back as written. The app as a whole is
tested end to end in the browser ([tests/e2e](../../tests/e2e)), and is
left out of the coverage measure.
