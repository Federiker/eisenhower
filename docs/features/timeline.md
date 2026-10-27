# The timeline

Jerome's timelines, made generic (decision 16): what happened when, drawn
as lanes across time. `@eisenhower/model` holds the data and its edit
operations; `@eisenhower/react` draws it as `<Timeline>` (the drawing) and
`<TimelineEditor>` (the drawing with the lists that edit it).

## What it shows

A timeline is one of two kinds, chosen when it is made and never changed:

- **Sequence**: steps the author names and orders ("Act 1", "Act 2"…),
  drawn as even columns.
- **Dates**: the proleptic Gregorian calendar, astronomical years from
  999 999 BCE to 999 999 CE, each date a year, a month or a day, and
  approximate when it says so. Time is drawn to scale; an empty stretch
  longer than a quarter of the whole is collapsed into a break with the
  years either side of it, when entries on one side are at more than one
  place.

Each **category** is a lane, in list order, in a palette colour and a solid,
dashed or dotted line, so lanes are told apart without colour too. Each
**entry** is in one category, at a point (a dot) or spanning two (a bar),
its title above it. An approximate end is drawn hollow and dashed; a year
or a month alone has its whole period drawn faintly behind its dot. Entries
that would overlap take more rows in their lane.

Dates read "14 October 1066", "March 1066", "1066", "c. 43 BCE"; CE is
written beside the others only when some date is BCE. Years from 10 000 are
grouped ("12,000 BCE"). Month names come from `Intl` in the view's locale;
the order of day, month and year is a message a host may change
(`timeline.date.dayMonthYear`).

In a space narrower than 600 pixels the drawing becomes a list, the entries
grouped under the step or date they start at.

## Data model

```ts
type Timeline = {
  kind: "sequence" | "dates";
  steps: { id: string; name: string }[];              // none in Dates
  categories: { id: string; name: string; colour: number; line: "solid" | "dashed" | "dotted" }[];
  entries: {
    id: string;
    title: string;                                      // 1–200 characters
    categoryId: string;
    start: TimelinePoint;                               // { step } or a date
    end: TimelinePoint | null;                          // a span's end, or null
    summary: string;                                    // one line, up to 500
  }[];
};
type TimelineDate = { year: number; month: number | null; day: number | null; approximate: boolean };
```

Ids are any string the host chooses (new ones from `newId()`). The
timeline has no name or title of its own: the host names its documents.
`timelineDocument` stores it as `{ format: "eisenhower", kind: "timeline",
version: 1, data }`; reading refuses a document that breaks a rule, saying
which:

- a Dates timeline has no steps; each id is used once;
- step names differ, and category names differ (ignoring case);
- an entry's category exists, and its points are of the timeline's kind
  (steps it has, or dates);
- a span ends after it starts (a whole year or month sorts before the
  months and days in it);
- at most 200 steps, 24 categories and 2000 entries; names 1 to 120
  characters; colours 0 to 7.

The edit operations (jerome's) return the new timeline or a problem code
(`blank`, `tooLong`, `duplicate`, `limit`, `missing`, `order`, `invalid`):
`addStep`, `renameStep`, `moveStep` (refused when a span would turn round),
`deleteStep` (its entries move to the step before or after, or go with it),
`addCategory` (in the next free colour and line: solid, then dashed, then
dotted), `updateCategory`, `moveCategory`, `deleteCategory` (its entries
move to another category, or go with it), `putEntry`, `deleteEntry`,
`sortedEntries`, and for the keys `moveEntryToLane` and `shiftEntry` (a
step at a time, or a year, month or day by the coarsest precision of the
entry's dates, both ends of a span together). For the pointer,
`draggedEntry` gives the entry as a drag leaves it (`{ part, by,
categoryId }`: the whole entry moved, or one end of a span, by steps or by
`partUnit`, in a lane), going as far towards `by` as it can (the first or
last step, the years a timeline holds, the last place before the other
end), and `dragEntry` drops it. The entry dialog's form is
`draftOf`, `newDraft` and `entryFromDraft`, which gives every reason an
entry cannot be saved yet, so a host's own editor may use it too.

## Using it

```tsx
import { emptyTimeline } from "@eisenhower/model";
import { Timeline, TimelineEditor } from "@eisenhower/react";

<TimelineEditor value={timeline} onChange={setTimeline} />;
<Timeline value={timeline} readOnly />;
```

| Prop | Use |
| --- | --- |
| `value` | The timeline |
| `onChange(next)` | Every change, as the whole new timeline |
| `readOnly` | Nothing can be changed; entries open to be read |
| `onOpenEntry(id, preset)` | Opens entries in the host's editor instead of the dialog; a new one has an id not yet in the timeline and, when begun on the drawing, `preset` (its lane and point) |
| `selectedId` | The entry shown as chosen; by default the one in the dialog |
| `zoom`, `onZoomChange` | The zoom (1 fits the width), when the host keeps it |
| `defaultZoom` | The zoom to start at when the view keeps it |
| `strings`, `t`, `locale`, `theme`, `className` | As for every view |

`<Timeline>` is the drawing: the zoom buttons, New entry, the drawing (or
the narrow list), the entry's menu and dialog. `<TimelineEditor>` adds
jerome's timeline page below it: the entries as a table in time order, the
steps (a Sequence) and the categories, each in a list put in order by
dragging, Alt+↑ ↓ or its menu.

The view never stores anything: jerome kept each drawing's zoom in
`localStorage`; here the zoom is the view's own state unless the host passes
`zoom` and keeps what `onZoomChange` reports. `timelineCsv(timeline, words)`
(the entries as a spreadsheet table) and `timelineSvg(timeline, name,
width, zoom, words)` (the whole drawing as an image) give text the host
saves where it likes; `formatTimelineDate`, `formatTimelinePoint` and
`formatTimelineWhen` write dates as the view does.

## The pointer

A click on an entry's title opens it, a right-click opens its menu. In a
timeline that may be edited, the pointer drags entries (owner decision, 27
October 2026):

- **Along the axis**, by its title or its mark: a point moves, and a span
  moves whole, keeping its length. A span's two ends resize it, never to or
  past the other end.
- **Up and down**, while moving an entry whole: it goes to the lane it is
  dropped on (above the lanes, the first; below them, the last). Resizing
  keeps its lane.
- **Snapping**: to steps in a Sequence; in Dates, to the entry's precision,
  as Alt+← → move it (a year, month or day: the coarsest of its dates for
  the whole entry, an end's own for a resize), never outside the years a
  timeline holds. A part moves once its middle has crossed into the next
  step, year, month or day.
- A drag starts once the pointer has moved 4 pixels, so a click still
  opens the entry; the click that ends a drag opens nothing. While
  dragging, the new place is drawn over the drawing with its date or step
  in words (the title's tooltip says it too); only the dragged entry draws
  again until the drop. Escape, or a cancelled pointer, drops nothing.
- The drop is announced as a key move is ("Storm: moved to Harbour, Act
  2", "Fleet sails: now Act 1 – Act 3"), and the entry's title takes the
  focus.

## Keys

The common keys ([interface](interface.md#keyboard-shortcuts)) first, on an
entry's title in the drawing:

| Keys | Action |
| --- | --- |
| ← → ↑ ↓ | The entry before or after, in time order |
| Home, End | The first or last entry |
| Enter, F2 | Open the entry |
| Alt+↑, Alt+↓ | Move the entry to the lane above or below |
| Alt+←, Alt+→ | Move the entry a step, or a year, month or day, earlier or later |
| Delete | Delete the entry, after asking |
| Menu, Shift+F10 | Edit or Delete |
| Ctrl+=, Ctrl++ | Zoom in |
| Ctrl+- | Zoom out |
| Ctrl+0 | Fit to the width |

Ctrl with the wheel zooms too, and a double-click on an empty spot of a
lane starts an entry there (New entry does the same from the keyboard). In
the table and the narrow list, Enter opens an entry, Delete asks to delete
it and the Menu key opens its menu. In the steps and categories lists,
Alt+↑ ↓ move a row, F2 or its pencil renames it, Delete deletes it (asking
where its entries go) and the Menu key opens its menu.

## Accessibility

- Each entry's title is a button named by its lane, title and place
  ("Ships: Fleet sails, Act 1 to Act 2"), with `aria-keyshortcuts`; the
  marks and the axis are hidden from assistive technology, as the titles
  say all they show. The chosen entry has `aria-current`.
- A moved entry keeps the focus and its move is announced ("Fleet sails:
  moved to Harbour"); so is a moved step or category ("Act 2: moved to 1 of
  3"). After a deletion the entry next to it in the same part takes the
  focus (or New entry); after the dialog, the entry's title.
- In forced colours the lanes' lines keep their dashes and the chosen
  entry is outlined in the system's highlight.

## Decisions

- The timeline itself has no title or summary: the host owns its
  documents' names, and passes a name to `timelineSvg` when it needs one.
- Jerome's links to documents, characters and locations and an entry's
  notes file stay in jerome, which keeps them by entry id.
- Moving an entry with Alt and the arrows is new: jerome's drawing had no
  key to move an entry, and decision 8 wants one. Past the first or last
  lane or step nothing happens, as in a list. The owner's decision, 27
  October 2026: keep the Alt+arrow moves, and drag entries with the
  pointer now too ([the pointer](#the-pointer)); jerome's entries were not
  dragged.
- New entry is beside the zoom buttons, so `<Timeline>` alone can add
  entries; jerome had it under the entries' table.
- Ctrl+0 (fit) is new; jerome had only the Fit button.
- The image's font is the system's sans-serif, not jerome's.
