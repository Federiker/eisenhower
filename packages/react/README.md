# @eisenhower/react

Published on npm as
[`@frodobaggins.jr/eisenhower-react`](https://www.npmjs.com/package/@frodobaggins.jr/eisenhower-react)
(`bun add @frodobaggins.jr/eisenhower-react`, with `react` and `react-dom`;
its stylesheet is `@frodobaggins.jr/eisenhower-react/style.css`); in the
workspace it is `@eisenhower/react`.

The views (`<Board>`, `<Timeline>` and `<TimelineEditor>`, `<Gantt>`,
`<TodoList>`) and what they share: the strings, the theme, the keys and the
controls. See
[theming, strings and keys](../../docs/features/interface.md).

- `src/theme/`: `EisenhowerProvider`, `ViewRoot`, the theme's variables
  (`theme.css`) and the palette.
- `src/strings/`: the typed en-GB messages, one file an area under `en-GB/`,
  and the host's overrides (`translate.ts`).
- `src/keyboard/shortcuts.ts`: every keyboard shortcut, one file an area
  beside it.
- `src/controls/`: buttons, fields, menus, dialogues and lists, from jerome's
  components.
- `src/hooks/`: the live region (`useAnnouncer`) and `useHistory`.
- `src/gantt/`: `<Gantt>`, its scale, rows, drawing and task dialog (see
  [the gantt chart](../../docs/features/gantt.md)).
- `src/style.css`: the one stylesheet, themed by `--eh-*` variables.
- `src/timeline/`: `<Timeline>` and `<TimelineEditor>` ([the
  timeline](../../docs/features/timeline.md)).
