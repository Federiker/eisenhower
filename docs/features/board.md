# The board

Cards in columns, as jerome's plot board, and the same data as a list
grouped by column (decision 15 in [development.md](../development.md)). It is
jerome's plot board and list made generic: a plot's parts are the board's
columns and its beats are cards, without a beat's status, target, links or
notes, which a host shows in a card's badge or its own editor.

## Using it

```tsx
import { Board, useHistory } from "@eisenhower/react";
import { boardDocument, emptyBoard, parseDocument, serialiseDocument } from "@eisenhower/model";
import "@eisenhower/react/style.css";

const history = useHistory(emptyBoard());
<Board
  value={history.value}
  onChange={history.set}
  layout="board"                      // or "list"
  badge={(card) => statusOf(card.id)} // optional, on each card and row
/>;
```

The board is controlled (decision 7): it draws `value` and hands every
change back through `onChange` as the whole new board, made by the model's
edit operations. It never reads or writes files; a host stores the board as
a document with `serialiseDocument(boardDocument, board)` and reads it back
with `parseDocument(boardDocument, text)`.

### Props

| Prop | What it does |
| --- | --- |
| `value` | The board (`Board` from `@eisenhower/model`). |
| `onChange(next)` | Every change, as the whole new board. |
| `layout` | `"board"` (default): columns side by side; `"list"`: the groups one under another, a row a card. |
| `readOnly` | No editing: no tools, no dragging, no moving, renaming or deleting; cards still open, read-only. |
| `badge(card)` | The host's node shown on each card and row with its details (jerome: a beat's status and target). |
| `renderCard(card)` | The host's own content for a card's details, in place of its summary, colour's name and badge; the title (which opens the card and takes the keys) and the menu stay. |
| `onOpenCard(id)` | Opens a card in the host's own editor (a click or Enter on its title, a double-click, Open in its menu). New card then adds a card named "New card" at once and opens it. Without it, the board's own dialog edits the card. |
| `selectedId` | The card shown as chosen (`aria-current`); by default, the card last opened. New cards go after it. |
| `strings`, `t`, `locale`, `theme`, `className` | As for every view ([interface.md](interface.md)). |

## The data

`@eisenhower/model`'s `Board` is `{ columns: BoardColumn[]; cards:
BoardCard[] }`, stored as the document kind `board`, version 1
(`boardDocument`):

- A **column** is `{ id, name }`: a name of 1 to 120 characters, names may
  repeat. At most 50 columns (`MAX_BOARD_COLUMNS`, jerome's limit for
  parts).
- A **card** is `{ id, title, columnId, summary, colour }`: a title of 1 to
  120 characters, its column's id or `null` for none, a one-line summary of
  up to 500 characters (it may be empty), and a palette colour (0 to 7) or
  `null`. At most 500 cards (`MAX_BOARD_CARDS`).
- The cards of a column are the board's cards with its id, in the board's
  order. Every id is used once (columns and cards alike), and every card's
  column is on the board (`boardProblems`); a document that breaks a rule
  is refused with the reasons.

The edit operations are pure functions that return the new board or a
problem code (`blank`, `tooLong`, `limit`, `missing`, `duplicate`,
`invalid`), and never throw for what a user did: `addColumn`,
`renameColumn`, `moveColumn`, `deleteColumn` (its cards go to the end of
the column before, the start of the one after, out of every column, or with
it), `addCard`, `addCardAt` (after a card, as `newCardSpot` says),
`editCard` (a card given another column goes to its end), `moveCard`,
`placeBefore` (a card dropped on another), `stepCard` and
`cardStepTarget` (up, down, the column before or after), `deleteCard`.
`boardGroups` gives the cards outside every column first, then each
column's; `cardPlace` a card's place there; `boardNeighbour` the card the
focus goes to.

## What it shows

- **Columns**, 15rem wide, scrolling sideways inside the board, each with
  its heading: the name, read as text with a pencil (a double-click also
  edits it), how many cards it has, and its menu (Rename, Move left, Move
  right, Delete column; in the list, Move up and Move down).
- **Cards**: a stripe of the card's colour, the title (the button that opens
  the card), its menu, the summary (up to three lines), then the colour's
  name (never the colour alone) and the host's badge. In the list a card is
  a row: the colour named, the title, the summary on one line and the
  badge.
- **No column**: the cards outside every column are a column of their own,
  first when it has cards. While a card is dragged and it has none, it is
  offered **after** the other columns on the board, saying "Drop a card here
  to take it out of its column."; a card dropped there makes it first (it
  then has cards). The list keeps it first. A board without columns shows
  its cards in it (a plain list in the list layout). Hosts rename it with
  the `board.noColumn` string (jerome: "No part").
- **New card** and **New column** above the board. A new column is named
  "New column" ("New column 2"… when taken) and opens for its name; a new
  card opens the card dialog titled "New card", and goes after the card
  last opened, else at the end of the last column, else out of every column.
- A short help under the board, a problem when an edit was refused, and an
  empty board says so.

## The card dialog

Without `onOpenCard`, a card opens in a modal dialog: its title, summary,
column and colour (with a swatch beside it). Save lists every reason it
cannot save (a blank or too long title, a summary too long, a column no
longer there), else saves and closes, the focus on the card; a card given
another column goes to its end. Cancel or Escape discards the changes,
asking first when something changed ("Discard" or "Keep editing"). Delete
card asks first. A new card is on the board only once saved. Read-only, the
fields only show the card, and Close or Escape closes it.

## Keys

The shared keys ([interface.md](interface.md#keyboard-shortcuts)); the board
adds none of its own.

| Keys | On a card | On a column's heading |
| --- | --- | --- |
| ↑ ↓ | The card above or below in its column (in the list, the card before or after) | |
| ← → | The nearest column with cards, at the same place (or its last card) | |
| Home, End | The first or last card of its column (in the list, of all) | |
| Alt+↑, Alt+↓ | Move the card within its column | Move the column before or after |
| Alt+←, Alt+→ | Move the card to the end of the column before or the start of the one after; the cards outside every column count as the column before the first | Move the column before or after |
| Enter | Open the card | |
| F2 | Rename the card in place (Enter saves, Escape keeps it) | Rename the column |
| Delete | Delete the card, asking first | Delete the column (at once when it is empty; else asking where its cards go) |
| Menu, Shift+F10 | The card's menu: Open, Rename, Move up, Move down, Move to column…, Delete card | The column's menu |

## Dragging

A card is dragged onto a card (it goes before it), onto a column (it goes at
its end) or onto the No column offered while it is dragged; a column's
heading onto another (it takes its place). The place it would go is drawn: a
line above the card or heading, a border round the column. A drag that ends
without a drop changes nothing. Drags from elsewhere are not taken.

## Accessibility

The board is a region named "Board"; each column a region named by its
name, with its name as a heading; cards are list items whose title is a
button (`aria-current` on the chosen one). Menus, dialogues and questions
are named. Every move (by keys, menu, Move to or dragging) is announced in
the polite live region ("Draft: moved to Doing, 2 of 3"; a column "Doing:
moved to 1 of 3"), and the focus stays on the moved card or the moved
column's menu button. After a delete the focus goes to the next card (or
the previous, or New card), after a column's delete to the next column (or
New column); a closed menu, dialog or question gives it back. In forced
colours the colour stripe is not drawn (the colour's name is written) and
the drop line is a border. Nothing animates.

## Decisions

- Decision 15 and the owner's note after decision 18 (No column after the
  others while a card is dragged; first once a card is dropped there), from
  jerome's 6cece75, checked case by case in
  `packages/react/tests/unit/board/no-column.test.tsx`.
- Proposed here, for the owner: the board layout is the default; the dialog
  keeps a card's column beside its title, summary and colour; a column's
  heading also moves with Alt+← and Alt+→ (the board lays columns out
  sideways); F2 renames a card in place; with `onOpenCard`, New card adds the
  card at once; jerome's narrow-page fallback (the board shown as the list
  below 600px) is left to the host, which chooses `layout`.
