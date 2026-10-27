# The todo list

A todo list with a second layout, the Eisenhower matrix (decision 18 in
[development.md](../development.md#decisions)): `<TodoList>` in
`@eisenhower/react`, its data and edits in `@eisenhower/model`. jerome has no
todo list, so this view is new; its list, drag and drop, keys, menu and
questions follow jerome's plot list, and the matrix's quadrants its plot
board's columns.

## What it shows

A toolbar, then one of two layouts:

- **The toolbar**: **List** and **Matrix** (toggle buttons), the **Hide
  done** switch, and the tag filter: **All tags**, then a toggle button a
  tag. An item is shown when it has every tag pressed (ignoring case).
- **The list**: the items in the user's order, each with its check box, its
  title (renamed in place: the pencil on hover, a double-click or F2), how
  many of its subtasks are done ("1 of 2 done"), its due day in the locale
  ("Due 2 Nov 2026", or "Overdue: due 2 Nov 2026" once it is past, in words
  and not by colour alone), its tags and its notes, then its ⋮ menu
  button. Subtasks are drawn under their parent, indented. A field at the
  foot adds an item at the end.
- **The matrix**: four quadrants in a 2×2 grid, urgent on the left and
  important at the top: **Do** (urgent and important), **Schedule**
  (important, not urgent), **Delegate** (urgent, not important) and
  **Drop** (neither). Each has its heading, its description, its items in
  the list's order and a field that adds an item to it (with its flags). On
  a narrow screen the quadrants stack in that order.

A ticked item keeps its place, struck through. **Hide done** hides ticked
items; it starts off in the list and on in the matrix, and each layout
remembers its own (a host that passes `hideDone` decides for both).

The details dialog (Enter, or **Details…** in the menu) edits the title,
the due date, the notes (with how many of the 250 characters are used), the
tags (separated by commas) and the urgent and important flags; Save checks
every field and says under each one why it cannot be saved.

## The data

`@eisenhower/model`'s `TodoList` is `{ items: TodoItem[] }`, stored as the
`todo` document, version 1 (`todoDocument`):

| Field | What it is |
| --- | --- |
| `id` | The host's id (new ones from `newId()`) |
| `title` | 1 to 120 characters, trimmed (the names' limit everywhere) |
| `done` | Whether it is ticked |
| `due` | A calendar day (`YYYY-MM-DD`) or `null` |
| `notes` | Up to 250 characters, several lines allowed, trimmed |
| `tags` | Up to 20, each trimmed, one line, 1 to 40 characters, once each ignoring case |
| `urgent`, `important` | The flags that place it in the matrix |
| `parentId` | The top-level item it is a subtask of, or `null` |

The items are in the user's order. A top-level item's subtasks are the
items that name it as their parent, in the order they come; the edits write
them straight after their parent. There is one level of subtasks: a subtask
has none. A document is refused when an id appears twice, a subtask's parent
is missing or is itself a subtask, or an item has a tag twice.

The edits return a new list or a problem code (`Problem`), never throwing:
`addItem` (at the end, at the end of a parent's subtasks, or just after an
item; a new subtask takes its parent's flags unless given its own),
`renameItem`, `setItemNotes`, `setItemDue`, `setItemTags`, `addItemTag`,
`removeItemTag`, `setItemDone` and `toggleItemDone`, `setItemQuadrant`,
`moveItem` (to a place under any parent, as a drop does), `stepItem` (up or
down among its siblings, a parent with its subtasks), `indentItem` (the last
subtask of the top-level item above), `outdentItem` (a top-level item just
after its parent and the parent's other subtasks) and `deleteItem` (with its
subtasks, or keeping them as top-level items where they were).

The queries: `todoOutline`, `subtasksOf`, `subtaskProgress`, `quadrantOf`,
`quadrantFlags`, `quadrantToward`, `itemsInQuadrant`, `allTags`, `hasTag`,
`filterByTags`, `isOverdue` (not done and due before today) and
`shownItems` (the filter and Hide done, keeping the parent of a subtask
shown).

## Props

```tsx
<TodoList
  value={list}                        // TodoList from @eisenhower/model
  onChange={setList}                  // every change, as the whole new list
  layout="list"                       // or "matrix"; the view's own if left out
  onLayoutChange={setLayout}
  tagFilter={["Home"]}                // the view's own (none) if left out
  onTagFilterChange={setTags}
  hideDone={false}                    // the view's own if left out
  onHideDoneChange={setHide}
  today="2026-11-05"                  // the user's local day by default
  readOnly={false}
  strings={…} t={…} locale="en-GB" theme="system" className="…"
/>
```

The layout, the filter and Hide done are controlled when the host gives
them and the view's own otherwise; the `on…Change` callbacks are called
either way.

## Keys

The item's check box is its focus point (named by its title, described by
what the row says and its notes); the common keys of
[interface.md](interface.md#keyboard-shortcuts) apply.

| Keys | In the list | In the matrix |
| --- | --- | --- |
| Space | Tick or untick | Tick or untick |
| ↑ ↓, Home, End | The item before or after, the first or last | The same within the quadrant, on to the quadrant above or below |
| ← → | — | The quadrant beside, the item at the same place |
| Alt+↑, Alt+↓ | Move among its siblings | Move to the quadrant above or below |
| Alt+→ | Make it a subtask of the item above | Move to the quadrant to the right |
| Alt+← | Make it a top-level item | Move to the quadrant to the left |
| Enter | Open the details | Open the details |
| F2 | Rename | Rename |
| Delete | Ask, then delete | Ask, then delete |
| Menu, Shift+F10 | Open the item's menu | Open the item's menu |

Dragging an item onto another puts it just before that one, among its
siblings (the list); onto the space after the items, at the end; onto a
quadrant, into that quadrant (the matrix, where the order is the list's).

The menu: Details…, Rename, Add a subtask (top-level items), Move up, Move
down, Make it a subtask or Make it a top-level item (the list), Move to each
other quadrant, and Delete.

## Accessibility

- The list is an ordered list named "Items", with each parent's subtasks a
  nested list ("Subtasks of …"); each quadrant is a region named by its
  heading and described by its description, with its items in a list.
- Moves are announced in a polite live region ("Book flights: 1 of 3",
  "Read a novel: subtask of Paint the shed, 2 of 3", "Book flights: moved to
  Schedule"), as are items added, deleted, or ticked and hidden.
- The focus stays on a moved item; after a delete, or a tick that hides the
  item, it goes to the next item shown (or the one before, or the field that
  adds items); a closed menu or dialog gives it back to the item.
- Deleting asks in place; a parent's question asks whether its subtasks go
  too. Overdue is said in words, and underlined in forced colours.

## Decisions taken with the view

These change what the user sees and are open to the owner:

- A title has the names' limit, 120 characters.
- Notes may have several lines; the 250 characters count the line breaks.
- Ticking a parent ticks only the parent; its count shows how many of its
  subtasks are done.
- An item's tags must all match the filter's (pressing more tags narrows);
  a subtask that matches brings its parent along.
- A new item (from a field or Add a subtask) takes the filter's tags, so
  that it stays in sight.
- In the matrix, subtasks are placed by their own flags (flattened), each
  saying "Subtask of …"; a new subtask starts with its parent's flags.
- In the matrix, the order within a quadrant is the list's: dragging and
  Alt+arrows only change the quadrant.
- Outdenting puts the item after its parent's other subtasks.
- Hide done starts off in the list and on in the matrix.
