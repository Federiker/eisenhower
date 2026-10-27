# @eisenhower/react

The views (`<Board>`, `<Timeline>`, `<Gantt>`, `<TodoList>`, to come) and
what they share: the strings, the theme, the keys and the controls. See
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
