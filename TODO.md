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
  - [x] The model: columns and cards, their edit operations and the
    neighbours for the keys, with jerome's tests.
  - [x] `<Board>`: columns, cards, drag and drop, the keys, the menus, the
    list layout, the card's badge and `renderCard`.
  - [x] The "No column" column after the others while a card is dragged
    (jerome 6cece75), checked and tested: it worked as copied.
  - [ ] The owner's answers on the choices proposed in
    [the board's decisions](docs/features/board.md#decisions) (the default
    layout, the dialog's column, Alt+← → on a column, F2 on a card, New
    card with `onOpenCard`, the narrow-page fallback).
- [ ] The timeline (decision 16), from jerome's timelines (see
  [the timeline](docs/features/timeline.md)):
  - [x] The model: steps, dates, categories and entries, their checks,
    edit operations and the entry form, `timelineDocument`, with jerome's
    tests.
  - [x] The scale, axis, lanes, dates as shown and the CSV and SVG exports.
  - [x] `<Timeline>`: the drawing with its zoom, keys (Alt+arrows move an
    entry), menu, entry dialog and narrow layout.
  - [x] `<TimelineEditor>`: the entries' table, the steps and categories
    lists.
  - [ ] The owner's word on the choices in
    [its decisions](docs/features/timeline.md#decisions) (moving entries
    with Alt+arrows, New entry beside the zoom, Ctrl+0, no timeline
    title).
- [ ] The gantt chart (decision 17; see [its document](docs/features/gantt.md)):
  - [x] The model: groups, tasks, milestones, progress, dependencies and
    their conflicts, the edit operations and the document, with tests.
  - [x] `<Gantt>`: the tree grid, bars, milestones and summary rows on the
    day, week and month scales, weekends and today, the header in the
    locale.
  - [x] Moving and resizing with the pointer and the keys, the menus, the
    questions, the task dialog, the scale keys.
  - [x] Dependencies as arrows, their warning in words and on the drawing.
  - [ ] The owner's answers to the decisions listed in its document
    (Alt+arrow steps on the week and month scales, the limits…).
  - [x] The demo app's page and a Playwright test of dragging in a real
    browser (the unit tests' DOM has no layout).
  - [ ] The header clips a month's name when little of that month is
    drawn (the first month of the range reads "Septer" on the week scale,
    the last "December 20"): shorten it, end it with an ellipsis or leave
    it out (seen in the demo app; a look the owner may want to choose).
- [ ] The todo list (decision 18), in [todo.md](docs/features/todo.md):
  - [x] The model: items, subtasks, tags, notes, due days, quadrants, the
    edits and the document.
  - [x] `<TodoList>`'s list: check boxes, titles in place, due days and
    Overdue, tags, notes, subtasks, adding, the details dialog, the tag
    filter, Hide done, drag and drop, the keys and the menu.
  - [x] The matrix layout: the four quadrants, moving between them by
    dragging and by keys, adding to a quadrant.
  - [ ] The owner's answers on the decisions listed in
    [todo.md](docs/features/todo.md#decisions-taken-with-the-view).
  - [x] The demo app's todo page and its end-to-end tests.
- [x] Rust and the Tauri client (decisions 9 and 10):
  - [x] `tauri-plugin-eisenhower`: read and write with the hash guard,
    atomic writes, permissions.
  - [x] `@eisenhower/tauri`: the typed client and its `StorageAdapter`.
- [ ] The demo app (decision 14), in [packages/app](packages/app/README.md):
  - [x] Every view on an invented sample, in tabs, with the theme, the
    locale, undo and redo, and the board's and timeline's switches.
  - [x] The browser host: documents in `localStorage`, saved as they change
    with the revision guard, Reset to the sample.
  - [x] The Tauri host: Open…, Save (the hash guard, asking before an
    overwrite) and Save as… through `tauriStorage`, tested with Tauri's IPC
    mocks.
  - [x] Playwright tests of every view in Chromium (dragging, the keys,
    the theme, persistence) and the README's screenshots.
  - [ ] The window clicked through (under Verification).
  - [ ] The owner's word on the app's choices: saving as it changes in the
    browser, `.json` files in the window, the samples and the locales
    offered, Ctrl+Z and Ctrl+Y as the app's keys.
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
