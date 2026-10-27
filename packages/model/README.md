# @eisenhower/model

Published on npm as
[`@frodobaggins.jr/eisenhower-model`](https://www.npmjs.com/package/@frodobaggins.jr/eisenhower-model);
in the workspace it is `@eisenhower/model`.

The data of Eisenhower's four views (a board, a timeline, a gantt chart and
a todo list), with their schemas (zod), their edit operations and the
storage of their documents. Plain TypeScript, no React: each edit is a pure
function that returns a new value or a problem code, and never throws for a
user's input. See [the models](../../docs/features/model.md).

```sh
bun add @frodobaggins.jr/eisenhower-model
```

- `src/board/`, `src/timeline/`, `src/gantt/`, `src/todo/`: each view's
  schema, empty value, edit operations and `DocumentKind` (`boardDocument`,
  `timelineDocument`, `ganttDocument`, `todoDocument`).
- `src/storage/`: the document (`{ format: "eisenhower", kind, version,
  data }`), the `StorageAdapter` with its revisions, `loadDocument` and
  `saveDocument`, and the in-memory and `localStorage` adapters.
- `src/common/`: days, identifiers, the palette, results and text.

Tests are in `tests`, on plain data.
