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
[development.md](docs/development.md#decisions)) is built: the models, the
four views, the Tauri plugin and client, the demo app and its end-to-end
tests, each described in [docs/features/](docs/README.md). What is left
is under **Verification** and **Awaiting owner decisions**.

- [ ] The first release, v0.1.0 (decision 11; see the README's Releasing):
  - [ ] `mise run release` tags v0.1.0 at HEAD; push `main` and `v0.1.0`.
  - [ ] `mise run release` again: the GitHub release and its three tarballs.
  - [ ] A throwaway host installs the three tarballs by URL (`bun add`) and
    the plugin by git at the tag, and builds.

## Verification

- [ ] The demo app's window (`mise run tauri:dev`), clicked through: each
  view's document saved, reopened, changed on disk by another program and
  saved again (the hash guard), and closed with unsaved changes (Save,
  Don't save, Cancel).
- [ ] Every view with a screen reader (NVDA on Windows, VoiceOver on macOS):
  names, roles and the announcements of moves.

## Later

- Replacing jerome's plot board and timelines with Eisenhower's views.
- Working calendars for the gantt chart (decision 17).

## Awaiting owner decisions

Choices made while building the views, each listed in its document; they
stand until the owner says otherwise:

- The board: [its proposed choices](docs/features/board.md#decisions) (the
  dialog's column, Alt+← → on a column, F2 on a card, New card with
  `onOpenCard`, the narrow-page fallback left to the host).
- The timeline: [its decisions](docs/features/timeline.md#decisions) (New
  entry beside the zoom, Ctrl+0, no timeline title, how a drag snaps and
  where a resize leaves the entry).
- The gantt chart: [its decisions to confirm](docs/features/gantt.md#decisions-to-confirm)
  (a milestone on its predecessor's last day, today's colour, Alt+↑ ↓ across
  groups, the stored fold).
- The todo list: [its open choices](docs/features/todo.md#decisions-taken-with-the-view)
  (the title's limit, notes on several lines, new items taking the filter's
  tags, the order in a quadrant, outdenting, Hide done's start).
- The demo app: the samples and the locales offered, Ctrl+Z and Ctrl+Y as
  the app's keys.
