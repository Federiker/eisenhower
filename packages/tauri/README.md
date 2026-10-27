# @eisenhower/tauri

The typed client of [`tauri-plugin-eisenhower`](../../crates/tauri-plugin/README.md),
for a Tauri 2 app that keeps Eisenhower's documents in files, and a
`StorageAdapter` on it. It depends on `@tauri-apps/api` and
`@eisenhower/model`; the other Eisenhower packages never import Tauri.

- `readDocument(path)` → `{ text, hash }`, or null when there is no file;
  `writeDocument({ path, text, expectedHash? })` → the new hash, refused with
  `changed_on_disk` when the file changed (or went) since it was read.
- `tauriStorage()`: a `StorageAdapter` whose keys are file paths and whose
  revisions are the files' hashes, for `loadDocument` and `saveDocument` from
  `@eisenhower/model`. A file changed on disk is a `StorageError` `changed`;
  other failures are `readFailed` or `writeFailed`, with the plugin's error
  as the `cause`.

A failure of `readDocument` or `writeDocument` is always an
`EisenhowerPluginError` with the plugin's `code` and `params`
(`pluginErrorCodes` lists them), `invalid_response` for an answer of the
wrong shape, or `unknown` for anything else (its text in `params.detail`).
The commands, the error codes and the adapter are in
[the Tauri integration](../../docs/features/tauri.md).

Tests are in `tests` and stand in for the plugin with Tauri's own IPC mocks
(`tests/plugin.ts`), including a plugin that keeps its files in a map.
