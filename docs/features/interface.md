# Theming, strings and keys

What every view of `@eisenhower/react` shares (decisions 5 to 8): the
theme, the interface text and its override, the locale, the keyboard
shortcuts, the live region, undo and redo, and the controls the views are
built from.

## Using it

```tsx
import { EisenhowerProvider, useHistory } from "@eisenhower/react";
import "@eisenhower/react/style.css";

<EisenhowerProvider
  theme="system"                      // "light", "dark" or "system" (default)
  locale="en-GB"                      // for dates and numbers (Intl)
  strings={{ "common.cancel": "…" }}  // or t={(key, values) => …}
>
  <Board value={board} onChange={setBoard} />
</EisenhowerProvider>;
```

The provider is optional: each view takes the same four props (`strings`,
`t`, `locale`, `theme`) and works alone. Inside a provider, a view's own
props win over the provider's, key by key: its `strings` over the
provider's `strings` and `t`, its `t`, `locale` and `theme` over theirs.
Providers nest the same way.

A view draws itself in a `ViewRoot`. Alone, or with a `theme` of its own,
that is a `div.eh-root`, which carries the theme; inside a provider it is a
plain `div.eh-view` that takes the provider's variables, so a host's
overrides on the provider reach every view in it.

## Theme

One stylesheet, `@eisenhower/react/style.css`: the theme, then the
controls, then each view. Every colour, size and font is a custom property
on `.eh-root` (not `:root`, so a host's page is not restyled); a host
overrides any of them on `.eh-root`, on the provider (`style` or
`className`) or on an element of its own inside it.

- **Light** by default, **dark** when the system prefers it (unless
  `data-theme="light"`), and dark with `data-theme="dark"`; `color-scheme`
  follows, so native controls and scroll bars match. The provider sets
  `data-theme` from its `theme` prop when it is not `system`.
- **Forced colours** (Windows' contrast themes) replace every colour with the
  system's (`Canvas`, `CanvasText`, `Highlight`…); the palette's colours all
  become the text colour, so the views never tell things apart by colour
  alone.
- The **focus ring** is 2px of `--eh-focus`, outside the element.

| Variable | Use | Light | Dark |
| --- | --- | --- | --- |
| `--eh-background` | Behind everything | `#f5f6f3` | `#202722` |
| `--eh-panel` | Columns, menus, dialogues | `#f7f8f5` | `#222a24` |
| `--eh-surface` | Fields, cards | `#fcfbf7` | `#262d27` |
| `--eh-ink` | Text | `#28342d` | `#e1e7dc` |
| `--eh-muted` | Secondary text | `#59675d` | `#a5b0a3` |
| `--eh-line` | Borders and rules | `#dce2d9` | `#3b453c` |
| `--eh-accent` | Main actions, checked boxes | `#446b4a` | `#afcba2` |
| `--eh-selected` | A chosen or hovered item | `#e1eadc` | `#374a36` |
| `--eh-focus` | The focus ring | `#28342d` | `#afcba2` |
| `--eh-good` | Done, on time | `#3c8a4b` | `#8fcf8a` |
| `--eh-warning` | Due soon, a dependency broken | `#c06f0c` | `#f0b35a` |
| `--eh-problem` | Errors, overdue | `#b3261e` | `#f28b82` |
| `--eh-colour-0` … `-7` | The palette | below | below |
| `--eh-radius` | Corners | `6px` | |
| `--eh-space-1` … `-4` | Spacing | `4px`, `8px`, `12px`, `16px` | |
| `--eh-font` | Font family | `system-ui, sans-serif` | |
| `--eh-font-size` | Text size | `13px` | |

The colours are jerome's workspace colours.

### The palette

Eight colours a card, an entry, a bar or a tag may take, the Okabe–Ito
colours (colour-blind safe), each in a tone for the light theme and one for
the dark, moved only in lightness until a line reaches 3:1 against every
background it is drawn on (jerome's timeline palette). A model stores a
colour as its index (0–7, `@eisenhower/model`'s `Colour`); a view draws it
with `colourVar(index)`, which gives `var(--eh-colour-N)`. `PALETTE` lists
each colour's name (a message key) and tones, for a colour picker.

| Index | Name | Light | Dark |
| --- | --- | --- | --- |
| 0 | Orange | `#b97500` | `#e69f00` |
| 1 | Sky blue | `#288dc0` | `#56b4e9` |
| 2 | Bluish green | `#00966c` | `#16a479` |
| 3 | Yellow | `#938500` | `#f0e442` |
| 4 | Blue | `#0072b2` | `#3b97da` |
| 5 | Vermilion | `#d55e00` | `#e66e22` |
| 6 | Reddish purple | `#bb6a98` | `#cc79a7` |
| 7 | Black | `#000000` | `#9a9a9a` |

### Class names

Every class the package draws starts `eh-`: `eh-root`, `eh-provider`,
`eh-view`, then the controls' (`eh-button`, `eh-icon-button`, `eh-field`,
`eh-checkbox`, `eh-group`, `eh-note`, `eh-problem`, `eh-question`,
`eh-editable`, `eh-labelled-field`, `eh-inline-rename`, `eh-name-field`,
`eh-reorder-list`, `eh-menu`, `eh-dialog`, `eh-visually-hidden`) and each
view's (`eh-board`, `eh-timeline`…). Buttons and fields are styled inside
`:where()`, as weakly as element rules, so a view's or a host's own rules
win.

## Strings

All interface text comes from typed messages in UK English
(`packages/react/src/strings/en-GB.ts`); no component holds a raw string.
Keys are prefixed by area: `common.*` for the controls and the keys,
`board.*`, `timeline.*`, `gantt.*` and `todo.*` for the views. A message
may have `{name}` placeholders, and a plural message is an object keyed by
the categories of `Intl.PluralRules` (`one`, `other`…), chosen by the
`count` value (or the first number given).

A host changes them in one of two ways:

- **`strings`**: a partial object of messages, which replace the built-in
  ones (`{ "common.cancel": "Never mind" }`).
- **`t(key, values)`**: its own translator, asked for every key first; when it
  returns the key itself or an empty string, the built-in message (or the
  `strings` one) is used. A host with its own translations routes every key
  through it.

`createTranslate({ strings, t, locale })` makes the same translator outside
React; inside, `useTranslate()` gives the one in context (UK English outside
any provider).

## Locale

`locale` (default `en-GB`) is the BCP 47 locale the views format dates and
numbers in, with `Intl`: numbers filled into messages, plural forms, and
each view's dates. `useLocale()` gives it.

## Undo and redo

The views are controlled (decision 7): each takes its `value` and reports
every change as the whole new value through `onChange`. Undo and redo are
the host's; `useHistory(initial, { limit })` keeps them for a host that
wants them:

```tsx
const history = useHistory(initialBoard);   // up to 100 steps by default
<Board value={history.value} onChange={history.set} />;
// history.undo(), history.redo(), history.canUndo, history.canRedo,
// history.reset(loadedBoard) (nothing to undo after a load)
```

Setting the same value is no step; a change after an undo drops what was
undone; past the limit, the oldest steps go first.

## Keyboard shortcuts

Every shortcut is listed in `packages/react/src/keyboard/shortcuts.ts`
(decision 8), one file an area beside it (`common.ts`, then each view's),
with its description among the strings. The same action has the same keys
in every view: focus moves with the arrows, and Alt with an arrow moves the
focused card, entry, bar or item, as in jerome's plot board. Ctrl is ⌘ on
macOS and Alt is ⌥. AltGr combinations and keys typed in an input method
never trigger a shortcut.

| Keys | Action |
| --- | --- |
| ↑ ↓ ← → | Focus the item above, below, to the left or to the right |
| Home, End | Focus the first or last item |
| Alt+↑, Alt+↓ | Move the item up or down |
| Alt+←, Alt+→ | Move the item to the left or right (the column, lane or quadrant before or after) |
| Enter | Open or edit the item; in a one-line field, save |
| Ctrl+Enter | Save a text of several lines |
| F2 | Rename the item |
| Delete | Delete the item (asking first where the view does) |
| Menu, Shift+F10 | Open the item's menu |
| Esc | Close the menu or dialogue, or cancel the edit |

In an open menu, ↑ ↓, Home and End move between its items, Enter or an
item's underlined letter chooses one, and Esc or Tab closes it. In a
dialogue, Tab and Shift+Tab stay inside it and Esc cancels.

Each view adds its own keys after these:

| View | Keys | Action |
| --- | --- | --- |
| [Timeline](timeline.md#keys) | Ctrl+=, Ctrl++ | Zoom in |
| Timeline | Ctrl+- | Zoom out |
| Timeline | Ctrl+0 | Fit the drawing to its width |

`actionOf(event, shortcuts)` turns a key press into an action
(`shortcutsIn("board")` gives a view's list: the common keys and its own);
`describeShortcut` writes a shortcut for people ("Alt+↑", "⌥↑") and
`ariaKeyShortcuts` for `aria-keyshortcuts` ("Alt+ArrowUp").

## Accessibility

Accessibility is part of each feature (decision 8):

- **Roles and names**: lists, menus (`menu`, `menuitem`,
  `menuitemcheckbox`), dialogues (`dialog`, `alertdialog`) and fields are
  named; the tests find elements by role and name.
- **Focus kept where the user is**: a moved item keeps the focus; a closed
  menu or dialogue gives it back to what opened it; a deleted item gives it
  to the one in its place.
- **Moves announced**: each view draws one polite live region
  (`<LiveRegion>`, `role="status"`, hidden on screen) and announces a move
  through `useAnnouncer()` ("Draft: moved to Doing, 2 of 3"); the same text
  twice is announced twice.
- **Forced colours**: the theme follows the system's colours, and nothing is
  told apart by colour alone.

## The controls

From jerome's components, with their tests, their keys and their ARIA:
`Button`, `IconButton`, `TextField`, `TextArea`, `Select`, `Checkbox`,
`Notice`, `InlineQuestion` (a question asked in place), `EditableText`
(text with a pencil that becomes a field), `LabelledField`, `InlineRename`,
`NameField`, `ReorderList` (rows put in order by dragging, Alt+↑ ↓ or their
menu), `ContextMenu` with `opensMenu` and `placeBelow`, `TreeDialog` (a
small modal form) and `MoveToDialog`. They must be drawn inside an
`.eh-root`, whose variables they use.

## Adding a view's parts

A view adds, each in its own file:

- its messages in `strings/en-GB/<view>.ts` (keys `<view>.*`), spread into
  `enGB` in `strings/en-GB.ts`;
- its shortcuts in `keyboard/<view>.ts`, with its area added to
  `ShortcutArea` and spread into `SHORTCUTS`, and this document's table;
- its styles, `@import`ed in `style.css` after the controls'.
