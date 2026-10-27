# Code organisation and tooling

How the code is organised and checked, and the owner decisions behind it.
What each part does is in [features/](features/); setup is in the
[README](../README.md).

## Decisions

Owner decisions, 27 October 2026, for the first round (slices in the
[TODO](../TODO.md)):

1. **Licence: CC0-1.0**, as for Donizetti and jespersen: a public-domain
   dedication, so anyone may use, change and sell Eisenhower without
   conditions. Everything the packages and crates bundle or link must
   therefore be under a **permissive licence** (MIT, BSD, Apache-2.0, ISC,
   Zlib, CC0 and the like): no GPL, LGPL, AGPL or MPL code of our own
   choosing. `cargo deny` (deny.toml) checks the crates and
   `scripts/licences.ts` the npm packages; a new licence needs the owner's
   approval.
2. **Repository: a Bun workspace and a Cargo workspace**, small packages
   with one job each:
   - `@eisenhower/model`: the four views' data, their validation and their
     edit operations, and the storage interface. Plain TypeScript, no React.
   - `@eisenhower/react`: the views (`<Board>`, `<Timeline>`, `<Gantt>`,
     `<TodoList>`), their strings, keys and styles.
   - `@eisenhower/tauri`: the typed client of the Tauri plugin and a storage
     adapter built on it.
   - `@eisenhower/app`: the demo app, in the browser and as a Tauri window.
   - `crates/tauri-plugin`: `tauri-plugin-eisenhower`, documents read and
     written on disk with a hash guard.
3. **A model per view.** A board, a timeline, a gantt chart and a todo list
   are four separate kinds of data, each a plain JSON value with its schema
   (zod), its edit operations and its document kind; there is no shared
   "plan" model. A host maps its own data onto the view it shows (jerome:
   a plot onto a board, its timelines onto timelines). Ids are strings the
   host chooses; new ones come from `crypto.randomUUID()`.
4. **Copied from jerome where it can be.** The board is jerome's plot board
   and list, the timeline jerome's timelines, with their tests, made
   generic: no jerome types, names or strings. The gantt chart and the todo
   list are new.
5. **Interface: plain React and CSS custom properties**, no UI framework.
   One stylesheet, themed by `--eh-*` variables the host may override;
   light and dark following `prefers-color-scheme`, a `data-theme`
   attribute to force one, and forced colours. Eight palette colours, each
   readable in both themes.
6. **Interface text: typed en-GB strings with an override.** UK English by
   default. The views ship their own en-GB messages; the host passes a
   partial `strings` object or a `t(key, values)` function, and a `locale`
   for dates and numbers (`Intl`). No raw strings in components.
7. **Component API: controlled.** Each view takes its data (`value`) and
   reports every change as the whole new value (`onChange`), made by the
   model's edit operations; `readOnly` turns editing off. The views never
   read or write files. Undo and redo are the host's, with a small
   `useHistory` hook in `@eisenhower/react` for hosts that want one.
8. **Keyboard and accessibility.** Everything a pointer does has keys:
   focus moves with the arrows, and moving a card, an entry, a bar or an
   item has its own keys, the same in every view where they mean the same.
   Every key is listed in one place in `@eisenhower/react`. Views use
   ARIA roles and names, announce moves in a live region and keep the focus
   where the user is; the tests find elements by role and name.
9. **Storage through adapters.** `@eisenhower/model` defines a document
   (`{ format: "eisenhower", kind, version, data }`) and a
   `StorageAdapter` that loads and saves one by key with a revision, so a
   save refuses to overwrite a document changed elsewhere. It ships an
   in-memory adapter and one on the browser's `localStorage`;
   `@eisenhower/tauri` adds one on the Tauri plugin.
10. **The Tauri plugin** (`tauri-plugin-eisenhower`, Rust) reads a
    document's text with its SHA-256 hash and writes it in one rename (a
    temporary file beside it), refused when the file changed on disk since
    it was read, as Donizetti and jerome guard their files.
11. **Distribution: by path or git now, npm and crates.io later.** The
    packages export their TypeScript sources (`"exports": "./src/index.ts"`),
    as jerome's and Donizetti's do, so a Vite and TypeScript app uses them
    without a build step: jerome depends on the npm packages by path and on
    the crate by git or by path. Builds to `dist/` with declarations come
    with publishing. The repository is meant for
    `github.com/Federiker/eisenhower`.
12. **Tooling, as in jerome and Donizetti:** mise pins the tools
    (`mise.toml`), Bun runs the packages, Biome formats and lints, Vitest
    and Playwright test, lefthook runs the hooks (Biome and rustfmt before a
    commit, the commit-message prefix, the type-check before a push), typos
    checks spelling in UK English, knip finds unused code, lychee broken
    links, cargo-nextest, Clippy and cargo-deny check the Rust, Renovate
    updates weekly, GitHub Actions runs `mise run ci`, and Git LFS holds
    binary files. TypeScript sources are imported without an extension.
13. **Tests: 80% coverage or more** on every measure for TypeScript (lines,
    statements, functions, branches) and lines and regions for Rust; CI
    fails below. Every edit operation has its tests on plain data; jerome's
    tests come over with the code they test.
14. **Demo app: one Vite app that is also a Tauri window**: every view in
    the browser for development and the end-to-end tests, and as a small
    desktop app that saves its documents through the plugin, showing how a
    host integrates Eisenhower.

Owner decisions, 27 October 2026, on the views:

15. **The board** shows cards in columns, as jerome's plot board, and the
    same data as a grouped list. A card shows its title, a one-line
    summary, a palette colour and an optional badge the host supplies
    (jerome puts a beat's status and target there); a host may render the
    card itself. Cards outside every column go in a column of their own
    ("No column" by default; jerome calls it "No part"): **first** when it
    has cards; while a card is dragged and it is empty, it is offered
    **after** the other columns (jerome's decision of 26 October 2026,
    carried over).
16. **The timeline** is jerome's: a **Sequence** timeline (steps the author
    names and orders) or a **Dates** timeline (the proleptic Gregorian
    calendar, astronomical years from 999 999 BCE to 999 999 CE, year,
    month or day precision, approximate dates shown "c."), with categories
    as coloured lanes and entries at a point or spanning two.
17. **The gantt chart**: tasks as bars on a day, week or month scale,
    moved and resized with the pointer and the keys; finish-to-start
    dependencies drawn as arrows, with a warning when a task starts before a
    predecessor ends; milestones (no length) and a percentage done; tasks
    grouped under collapsible summary rows that span their tasks. Dates are
    calendar days (`YYYY-MM-DD`).
18. **The todo list**: items with an optional due date (overdue shown), one
    level of subtasks, tags the view filters by, and notes of up to 250
    characters. The same list has a second layout, the **Eisenhower
    matrix**: items flagged urgent and important fall into its four
    quadrants, and moving an item between quadrants changes its flags.
