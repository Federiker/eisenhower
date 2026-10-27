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
11. **Distribution: tarballs on GitHub releases, the plugin by git**
    (owner decisions, 27 October 2026, replacing "by path or git now";
    no npm registry and no crates.io). `@eisenhower/model`,
    `@eisenhower/react` and `@eisenhower/tauri` keep their names and are
    released as tarballs attached to the GitHub release of the tag
    `v<version>` of `github.com/Federiker/eisenhower`, named as `npm pack`
    names them (`eisenhower-react-0.1.0.tgz`). A host installs them by URL:
    `bun add https://github.com/Federiker/eisenhower/releases/download/v0.1.0/eisenhower-react-0.1.0.tgz`.
    In the workspace the packages export their TypeScript sources, so the
    demo app and the tests need no build step; the tarballs hold **built
    files**: each package's `dist/index.js` (Vite's library mode, ES
    modules, every dependency left external) with tsc's declarations of
    `src` (each package's `tsconfig.build.json`), and for the views one
    `dist/style.css` with its imports inlined (`<package>/style.css`). Their
    manifests are made in `tmp/release/<package>/`, never in the tracked
    `package.json` files: the catalog's ranges resolved, a sibling as its
    tarball's URL on the same release, React and React DOM as peers, no
    devDependencies; each tarball holds `dist`, the package's README and
    the licence. `tauri-plugin-eisenhower` is not published: a Cargo host
    takes it by git at the release's tag,
    `tauri-plugin-eisenhower = { git = "https://github.com/Federiker/eisenhower", tag = "v0.1.0" }`.
    One version for all, the root `Cargo.toml`'s `[workspace.package]`
    version (0.1.0 first).

    `scripts/release.ts` makes the release. `mise run release:dry` runs the
    type-check, the tests and Clippy, builds and packs the packages,
    installs the three tarballs together in a throwaway consumer (the
    siblings' URLs overridden by the local tarballs; imported with Node,
    type-checked with `nodenext`) and lists what releasing would do: the
    tag's checks, the calls to GitHub and the release's notes.

    To release, `mise run tag` (`scripts/tag.ts`) asks at each step, Enter
    taking the default. On `main`, with nothing uncommitted or untracked and
    nothing on origin's main this one lacks, it asks the new version (the
    next patch; the current one when it was never tagged, as for 0.1.0;
    `x.y.z` or a pre-release such as `0.2.0-alpha.1`, after the current one,
    its tag not taken here or on origin), writes it to the root
    `Cargo.toml` and `Cargo.lock` (only the workspace's own crates' lines),
    commits those two files alone (`[release] Eisenhower <version>`, the
    hooks run, no trailer: the owner's commit), makes the annotated tag
    `v<version>`, shows what goes to origin and asks before
    `git push --atomic origin main v<version>`, then asks before running the
    release. Ctrl+C or the end of the input at a question changes nothing
    before the commit; after it, the script says what it has done and the
    commands that undo it here (`git tag -d`, `git reset --hard HEAD~1`),
    printed, never run. `mise run release` releases a pushed tag: it stops
    unless `v<version>` is at HEAD here and on origin with HEAD on origin's
    main, runs the checks and the build, creates the release when there is
    none (its notes from `scripts/release/notes.ts`) and uploads each
    tarball, skipping one already there, so a release that stopped half way
    is run again as it is. The token (`GITHUB_TOKEN`, fine-grained,
    Contents: read and write) is in the gitignored `.env`
    ([.env.example](../.env.example)) and goes only in the requests to
    GitHub's API. jerome may install the released tarballs instead of
    depending on paths.
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
    calendar days (`YYYY-MM-DD`), and lengths count calendar days: the day
    scale shades Saturdays and Sundays and marks today (working calendars
    may come later).
18. **The todo list**: items with an optional due date (overdue shown), one
    level of subtasks, tags the view filters by, and notes of up to 250
    characters. The same list has a second layout, the **Eisenhower
    matrix**: items flagged urgent and important fall into its four
    quadrants, and moving an item between quadrants changes its flags. The
    quadrants are headed **Do**, **Schedule**, **Delegate** and **Drop**,
    each described ("Urgent and important"…); hosts may rename them. A
    ticked item keeps its place, struck through; a **Hide done** switch hides
    ticked items, and the matrix hides them unless they are shown.

Owner decision, 27 October 2026: after a card is dropped in the "No column"
column offered at the end of the board, that column has cards and so moves
to first place, exactly as jerome's 6cece75 does (decision 15).
