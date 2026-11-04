# @eisenhower/desktop

Eisenhower as a desktop application (decision 19): a Tauri window that
creates, opens and saves any view's document as a `.json` file. It is a host
like any other, built only from `@eisenhower/model`, `@eisenhower/react`,
`@eisenhower/tauri` and `tauri-plugin-eisenhower`; what it does is described
in [the desktop app](../../docs/features/desktop.md).

```sh
mise run app:dev       # the window, on Vite (port 1441)
mise run app:release   # the release build: program and installers in dist/release
mise run app:debug     # the debug build, in dist/debug
mise run app:all       # both
```

`bun run --filter @eisenhower/desktop dev` serves the **preview** alone in
a browser: its files are kept in the browser's `localStorage`
(`eisenhower-desktop-preview:` and the path), and its dialogues are the
page's `prompt` and `confirm`.

## What it shows

- **Start**: the recent documents (the latest first, up to 20, each with
  its kind, folder and when it was opened; files that are gone are dropped),
  **Open…**, and **New document**: a type (Board, Timeline (dates),
  Timeline (sequence), Gantt chart, Todo list) and a name, then **Create…**,
  which asks where to save it, writes the empty document and opens it.
- **A document**: its view, with **Start**, **Undo**, **Redo**, the board's
  layout, the file's name (marked while it has unsaved changes), **Open…**,
  **Save** and **Save as…**. The window's title is the file's name.
- The header: the **Theme** and the locale of dates and numbers, kept in the
  window's `localStorage` with the recent list.
- The footer: the status messages (a polite live region) and the errors (an
  alert).

## The app's keys

The views' keys are `@eisenhower/react`'s
([the keys](../../docs/features/interface.md#keyboard-shortcuts)). The app
adds its own (⌘ on macOS):

| Keys | Action |
| --- | --- |
| Ctrl+N | A new document: the start screen's form, its name focused |
| Ctrl+O | Open a file |
| Ctrl+S | Save |
| Ctrl+Shift+S | Save as |
| Ctrl+Z | Undo the last change |
| Ctrl+Y, Ctrl+Shift+Z | Redo it |

None of them works in a dialogue; undo and redo are left to a text field.

## Code

- `src/App.tsx`: the screens, the recent list, opening and creating.
- `src/StartScreen.tsx`, `src/DocumentScreen.tsx`: the two screens.
- `src/useFileDocument.ts`: the open document's history and saving (from
  the demo's `useDemoDocument`).
- `src/documents.ts`: a document of any kind, read by its `kind`, and the
  empty documents.
- `src/recent.ts`, `src/settings.ts`: what the window keeps.
- `src/host/`: the Tauri host (the plugin and Tauri's dialog plugin, the
  close question) and the preview's.

## The native side

`src-tauri/` is the crate `eisenhower_desktop` (a member of the root Cargo
workspace, identifier `org.eisenhower.desktop`, program `eisenhower`): it
registers `tauri_plugin_eisenhower::init()` and Tauri's dialog plugin, and
its capability (`capabilities/main.json`) grants `core:default`,
`core:window:allow-set-title` (the window's title is the document's name),
`core:window:allow-destroy` (the window closes itself once it has asked
about unsaved changes), `dialog:default` and `eisenhower:default`. Its icons
are the demo's.

## Tests

`tests/` (`bun run --filter @eisenhower/desktop test`, counted in the
coverage measure): the screens on the preview host with Testing Library,
the Tauri host with Tauri's IPC mocks (`tests/ipc.ts`), the recent list,
the settings, the keys and the documents. The preview is tested end to end
in [tests/e2e](../../tests/e2e) (`desktop.spec.ts`).
