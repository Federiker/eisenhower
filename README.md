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

What is built and what was decided are in [docs/](docs/README.md); remaining
work is in [TODO.md](TODO.md).

## Licence

[CC0 1.0](LICENSE): Eisenhower is dedicated to the public domain. Its
dependencies are all under permissive licences (MIT, BSD, Apache-2.0 and the
like), checked by `mise run audit`; see
[decision 1](docs/development.md#decisions).

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

### Commands

`mise tasks` lists them all; the main ones:

| Command | What it does |
| --- | --- |
| `mise run dev` | The demo app in the browser (Vite) |
| `mise run tauri:dev` | The demo app as a native window |
| `mise run build` | The demo app's production build |
| `mise run test` | The TypeScript tests (Vitest) |
| `mise run coverage` | The same, failing below 80% |
| `mise run rust:test` | The Rust tests (nextest when installed) |
| `mise run test:e2e` | Playwright tests of the demo app |
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
| `packages/model` | `@eisenhower/model` | Each view's data: schema, edit operations, storage interface |
| `packages/react` | `@eisenhower/react` | `<Board>`, `<Timeline>`, `<Gantt>`, `<TodoList>`: strings, keys, styles |
| `packages/tauri` | `@eisenhower/tauri` | The typed client of the Tauri plugin and its storage adapter |
| `packages/app` | `@eisenhower/app` | The demo app, browser and Tauri |
| [packages/tooling](packages/tooling) | `@eisenhower/tooling` | Shared TypeScript settings |
| `crates/tauri-plugin` | `tauri-plugin-eisenhower` | The Tauri plugin: documents on disk with a hash guard |
| `tests/e2e` | `@eisenhower/e2e` | Playwright tests of the demo app |

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
