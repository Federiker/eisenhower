# Eisenhower roadmap

This is the shared, persistent checklist for human contributors and Claude.
Read it at the start of each task and update relevant items before finishing.
Add newly discovered work here; split large tasks into actionable items as
implementation approaches. Check an item only when its stated outcome is
implemented and verified, and do not check off an entire feature for a stub.

Write a piece of work with several parts as a short list of slices, which may
be split, merged or reordered as the work shows what it needs. Tick a slice
when it is done; when the whole item is done and documented in its feature
document, remove it from here. Owner decisions belong in the docs
([development.md](docs/development.md)), with a short work item here. Checks
that need the native window go in **Verification**.

Sections: **Now**, **Verification**, **Later**, **Awaiting owner decisions**.

## Now

The first round (owner decisions, 27 October 2026; see
[development.md](docs/development.md#decisions)), in order:

- [x] Foundation: the workspaces, the tools and hooks, CI, the docs, the
  licence.
- [ ] The shared parts:
  - [x] `@eisenhower/model`: ids, names and one-line texts with their
    limits, calendar days, the palette, problems as codes, the document and
    the `StorageAdapter` with the memory and `localStorage` adapters.
  - [x] `@eisenhower/react`: the strings and their override, the theme
    (`--eh-*`, light, dark, forced colours, the palette), the controls
    copied from jerome's components, the keys' list, the live region,
    `useHistory`.
- [ ] The board (decision 15), from jerome's plot board and list:
  - [ ] The model: columns and cards, their edit operations and the
    neighbours for the keys, with jerome's tests.
  - [ ] `<Board>`: columns, cards, drag and drop, the keys, the menus, the
    list layout, the card's badge and `renderCard`.
  - [ ] The "No column" column after the others while a card is dragged
    (jerome 6cece75), checked and tested.
- [ ] The timeline (decision 16), from jerome's timelines: the model (steps,
  dates, categories, entries), the drawing with its scale and zoom, the
  lists, the entry dialog, the narrow layout, with jerome's tests.
- [ ] The gantt chart (decision 17): the model, bars on the scales, moving
  and resizing with the pointer and keys, dependencies and their warning,
  milestones and progress, collapsible groups.
- [ ] The todo list (decision 18): the model, the list with due dates,
  subtasks, tags and notes, the tag filter, the matrix layout.
- [ ] Rust and the Tauri client (decisions 9 and 10):
  - [ ] `tauri-plugin-eisenhower`: read and write with the hash guard,
    atomic writes, permissions.
  - [ ] `@eisenhower/tauri`: the typed client and its `StorageAdapter`.
- [ ] The demo app (decision 14): every view in the browser, the Tauri
  window saving through the plugin, Playwright tests.
- [x] The Claude workflow: the `eisenhower-` skills and the implementer
  agent.

## Verification

- [ ] The demo app's window (`mise run tauri:dev`), clicked through: each
  view's document saved, reopened, changed on disk by another program and
  saved again (the hash guard).
- [ ] Every view with a screen reader (NVDA on Windows, VoiceOver on macOS):
  names, roles and the announcements of moves.

## Later

- Publishing to npm and crates.io (decision 11).
- Replacing jerome's plot board and timelines with Eisenhower's views.

## Awaiting owner decisions

None at present.
