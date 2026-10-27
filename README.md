# Eisenhower

Eisenhower is a React component library of planning views, with what a
[Tauri](https://tauri.app) app needs to keep their data on disk. It is named
after Dwight D. Eisenhower (1890–1969), whose urgent/important matrix is one
of its views.

- **Board**: cards in columns, dragged or moved with the keys, and the same
  cards as a grouped list.
- **Timeline**: entries at a point or over a span, on named steps or on
  calendar dates (BCE included, approximate dates marked), in coloured
  lanes.
- **Gantt chart**: tasks as bars on a day, week or month scale, with
  dependencies, milestones, progress and collapsible groups.
- **Todo list**: items with due dates, subtasks, tags and short notes, and
  the same list as an **Eisenhower matrix** of urgent and important.

Each view has its own data model, is controlled by its host (value in,
changes out), works with the keyboard alone, follows the light or dark theme
and speaks UK English unless the host translates it. The first host is
[jerome](https://github.com/Federiker/jerome).

The demo app ([packages/app](packages/app/README.md)) shows each view on an
invented sample. The board, with a card's colour named beside its stripe:

![A house move as a board: four columns of cards, each with its title, summary and colour](docs/screenshots/board-light.png)

A Dates timeline, BCE and approximate dates included, with its entries'
table below it:

![A history of science as a timeline: three coloured lanes from 430 BCE to 1808, a break over the empty centuries](docs/screenshots/timeline-light.png)

A gantt chart on the week scale, in the dark theme: groups, milestones,
dependencies, today, and a task that starts too early flagged in words:

![A product launch as a gantt chart in the dark theme, the press release marked Starts too early](docs/screenshots/gantt-dark.png)

The todo list, and the same items as the Eisenhower matrix:

![A todo list with tags, subtasks, due days and two overdue items](docs/screenshots/todo-light.png)

![The same list as the Eisenhower matrix: Do, Schedule, Delegate and Drop](docs/screenshots/matrix-light.png)

The other pictures in [docs/screenshots](docs/screenshots) are written by
`mise run screenshots`.

What is built and what was decided are in [docs/](docs/README.md); remaining
work is in [TODO.md](TODO.md).

## Licence

[CC0 1.0](LICENSE): Eisenhower is dedicated to the public domain. Its
dependencies are all under permissive licences (MIT, BSD, Apache-2.0 and the
like), checked by `mise run audit`; see
[decision 1](docs/development.md#decisions).

## Use it in an app

The packages are tarballs on each
[GitHub release](https://github.com/Federiker/eisenhower/releases),
installed by URL; the Tauri plugin is taken by git at the release's tag:

```sh
bun add https://github.com/Federiker/eisenhower/releases/download/v0.1.0/eisenhower-react-0.1.0.tgz \
        https://github.com/Federiker/eisenhower/releases/download/v0.1.0/eisenhower-model-0.1.0.tgz
# in a Tauri app, with the plugin:
bun add https://github.com/Federiker/eisenhower/releases/download/v0.1.0/eisenhower-tauri-0.1.0.tgz
```

```toml
# src-tauri/Cargo.toml, in a Tauri app
tauri-plugin-eisenhower = { git = "https://github.com/Federiker/eisenhower", tag = "v0.1.0" }
```

Each view takes its data as `value` and gives every change back as the
whole new value; `useHistory` adds undo and redo, and `EisenhowerProvider`
sets the theme, the locale and the strings of every view inside it:

```tsx
import { emptyBoard } from "@eisenhower/model";
import { Board, EisenhowerProvider, Gantt, TimelineEditor, TodoList, useHistory } from "@eisenhower/react";
import "@eisenhower/react/style.css";

const board = useHistory(emptyBoard());
<EisenhowerProvider theme="system" locale="en-GB">
  <Board value={board.value} onChange={board.set} layout="board" />  {/* or "list" */}
  <TimelineEditor value={timeline} onChange={setTimeline} />        {/* emptyTimeline("dates") or ("sequence") */}
  <Gantt value={chart} onChange={setChart} scale="week" onScaleChange={setScale} />
  <TodoList value={list} onChange={setList} layout="matrix" />       {/* or "list" */}
</EisenhowerProvider>;
```

The views never read or write files. A host keeps each one as a document
through a storage adapter, with its view's `DocumentKind` (`boardDocument`,
`timelineDocument`, `ganttDocument`, `todoDocument`) and the revision it
read, so a save never overwrites a change made elsewhere unseen:

```ts
import { boardDocument, loadDocument, localStorageAdapter, saveDocument } from "@eisenhower/model";

const storage = localStorageAdapter("my-app:"); // or memoryStorage(), or tauriStorage() from @eisenhower/tauri
const loaded = await loadDocument(storage, "board", boardDocument); // null when nothing is stored
const revision = await saveDocument(storage, "board", boardDocument, board.value, loaded?.revision);
```

In a Tauri app, `tauri-plugin-eisenhower` and `@eisenhower/tauri` keep the
documents in files with a hash guard; the demo app in
[packages/app](packages/app/README.md) shows the whole integration, in the
browser and as a window. See [docs/features/](docs/README.md) for each view
and package.

## Requirements

- Git with Git LFS (binary fixtures and images)
- [mise](https://mise.jdx.dev) for the pinned tools ([mise.toml](mise.toml): Bun,
  cargo-nextest, cargo-machete, cargo-deny, typos, lychee, Lefthook) and
  [rustup](https://rustup.rs) for Rust 1.99.1 ([rust-toolchain.toml](rust-toolchain.toml));
  the install scripts below install both when missing
- Tauri platform prerequisites, for the demo app's native window:
  - Windows: Microsoft C++ Build Tools, Windows SDK and WebView2
  - macOS: Xcode command-line tools
  - Linux: the Tauri/WebKitGTK development libraries for your distribution

## Develop

Set up a machine once (again after the pinned tools change):

```sh
scripts/install.sh      # macOS and Linux
scripts\install.bat     # Windows (uses winget); from Git Bash, scripts/install.sh runs it
```

They install mise, rustup and the pinned Rust toolchain when missing, then the
tools in `mise.toml`, the Git LFS files, the Bun packages and the Git hooks. They
do not install the Tauri prerequisites above. Then:

```sh
mise run dev         # the demo app in the browser
mise run tauri:dev   # the demo app as a desktop app
```

### Local scratch data

Use the root `tmp/` folder for downloads, temporary scripts and experiments.
Git and Biome ignore the whole folder; create task-specific subfolders as
needed. It is disposable local developer data, not a required build input.
Do not stage it or depend on another developer having its contents; keep
durable findings in tracked documentation.

### Releasing

`@eisenhower/model`, `@eisenhower/react` and `@eisenhower/tauri` are
released as tarballs on the GitHub release of the tag `v<version>`, built
(`dist/index.js`, declarations and, for the views, `style.css`); there is
no npm registry. `tauri-plugin-eisenhower` is not published: hosts take it
by git at the tag. Everything takes the version in the root `Cargo.toml`
(`[workspace.package]`). See [decision 11](docs/development.md#decisions).

```sh
mise run release:dry   # the checks, the tarballs in tmp/release, a consumer of them, the plan and the notes
mise run release       # on a clean tree: tags v<version> and stops for you to push, then (run again) releases
```

To release: bump the version in `Cargo.toml` and commit; `mise run release`
creates the annotated tag `v<version>` at HEAD and says what to push
(`git push origin main v<version>`); push; then `mise run release` again
makes the release and uploads the tarballs. A tarball the release has
already is skipped, so a release that stopped half way is run again as it
is. The release's notes are made by
[scripts/release/notes.ts](scripts/release/notes.ts).
`mise run release:dry --allow-dirty` dry-runs with uncommitted changes and
`--skip-checks` without the type-check, the tests and Clippy. Releasing
needs `GITHUB_TOKEN` in the gitignored `.env` (copy
[.env.example](.env.example)): a fine-grained token with Contents: read and
write on the repository.

### Commands

`mise tasks` lists them all; the main ones:

| Command | What it does |
| --- | --- |
| `mise run dev` | The demo app in the browser (Vite) |
| `mise run tauri:dev` | The demo app as a native window |
| `mise run build` | The demo app's production build |
| `mise run release:dry` | Check, build and verify the release's tarballs; list what releasing does |
| `mise run release` | Tag `v<version>`, then (once pushed) the GitHub release and its tarballs |
| `mise run test` | The TypeScript tests (Vitest) |
| `mise run coverage` | The same, failing below 80% |
| `mise run rust:test` | The Rust tests (nextest when installed) |
| `mise run test:e2e` | Playwright tests of the demo app |
| `mise run screenshots` | The demo app's pictures in docs/screenshots |
| `mise run fix` | Format and apply safe fixes |
| `mise run ci` | Every check CI runs, in its order |
| `mise run audit` | Advisories and licences, npm and Rust |

### Faster Rust builds

On Windows, Rust links with **rust-lld**, which ships with the toolchain
([.cargo/config.toml](.cargo/config.toml)); dev builds keep only line tables
as debug info for Eisenhower's crates and none for dependencies
([Cargo.toml](Cargo.toml), `[profile.dev]`). Excluding `target`, Cargo's and
Bun's caches from Microsoft Defender, or working on a Dev Drive, helps further.

## Workspace

| Path | Package or crate | What it is |
| --- | --- | --- |
| [packages/model](packages/model) | `@eisenhower/model` | Each view's data: schema, edit operations, storage interface |
| [packages/react](packages/react) | `@eisenhower/react` | `<Board>`, `<Timeline>`, `<Gantt>`, `<TodoList>`: strings, keys, styles |
| [packages/tauri](packages/tauri) | `@eisenhower/tauri` | The typed client of the Tauri plugin and its storage adapter |
| [packages/app](packages/app) | `@eisenhower/app` | The demo app, browser and Tauri |
| [packages/tooling](packages/tooling) | `@eisenhower/tooling` | Shared TypeScript settings |
| [crates/tauri-plugin](crates/tauri-plugin) | `tauri-plugin-eisenhower` | The Tauri plugin: documents on disk with a hash guard |
| [tests/e2e](tests/e2e) | `@eisenhower/e2e` | Playwright tests of the demo app |

Model, react and tauri are released as tarballs on GitHub releases, under
these names; the plugin is taken by git at a release's tag
([Releasing](#releasing)). The others stay private.

## Checks

`mise run ci` runs what CI runs: Biome, rustfmt, typos, lychee, knip, the
licences, the type-check, cargo-machete, cargo-deny, Clippy, the tests with
coverage (80% or more), the end-to-end tests and the builds.

## Git conventions

[.gitattributes](.gitattributes) normalises text to LF, with CRLF for Windows
batch/command scripts. Binary files (images, fonts, archives) use Git LFS.

### Hooks

[Lefthook](lefthook.yml) runs three hooks, installed by the install scripts:

- **before a commit**, Biome and rustfmt format the staged files and stage the
  result;
- **on the commit message**, the first line must start with a prefix below;
- **before a push**, the type-check (`mise run typecheck`).

`git commit --no-verify` skips them; CI runs the same checks anyway.

### Commit messages

The first line is `[prefix] What changed`, in UK English, for example
`[fix] Board: a card dropped on its own column keeps its place`. One commit,
one prefix: when a change is two kinds of work, it is usually two commits.
Git's own `Merge`, `Revert` and `fixup!` messages are accepted as they are.

| Prefix | For | Why it is its own word |
| --- | --- | --- |
| `[add]` | Something new: a feature, a view, a command | The most common kind of change; its tests and docs come with it |
| `[fix]` | A bug fixed | Lets a reader find when a behaviour was wrong and when it was mended |
| `[remove]` | A feature, file or dead code taken out | Removal is a decision worth finding again, not a side effect of `[add]` |
| `[refactor]` | Code reorganised with the same behaviour | Tells a reviewer that nothing should change for the user |
| `[rename]` | Files, packages or identifiers renamed or moved, nothing else | Moves make large diffs; keeping them alone keeps history readable |
| `[perf]` | Faster or smaller, same behaviour | Its measurements belong in the message |
| `[look]` | Visual only: styles, icons, layout | A change you see but that does nothing new; screenshots go with it |
| `[strings]` | Interface wording only (the locale files) | Copy changes are reviewed for tone and language, not code |
| `[docs]` | Documentation only | Never changes what Eisenhower does |
| `[test]` | Tests only | Adds confidence without touching the code |
| `[fmt]` | Formatting only | Large ones are listed in `.git-blame-ignore-revs`, so `git blame` skips them |
| `[build]` | Tooling, scripts, CI and configuration | The workshop, not the product |
| `[deps]` | Dependency updates (Renovate uses it) | Upgrades are where regressions often come from |
| `[security]` | A fix for a vulnerability or an advisory | Must be easy to find and to back-port |
| `[release]` | Version numbers and release notes | Marks the points users receive |
| `[revert]` | Undoing an earlier commit by hand | Names the commit it undoes; Git's own `Revert "…"` works too |
| `[init]` | The repository's first commit | Historical: used once |
