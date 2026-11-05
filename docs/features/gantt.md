# The gantt chart

Tasks as bars on a day, week or month scale, grouped under summary rows
that fold, with milestones, a percentage done and finish-to-start
dependencies drawn as arrows (decision 17). The model is in
`@eisenhower/model` (`packages/model/src/gantt/`), the view is `<Gantt>` in
`@eisenhower/react` (`packages/react/src/gantt/`). jerome has no gantt
chart: the view follows the patterns of jerome's plot board (the menus, the
questions asked in place, the keys) and timeline (the zoom keys).

## Using it

```tsx
import { type Gantt as GanttData, emptyGantt } from "@eisenhower/model";
import { Gantt } from "@eisenhower/react";
import "@eisenhower/react/style.css";

const [chart, setChart] = useState<GanttData>(emptyGantt());
<Gantt value={chart} onChange={setChart} />;
```

| Prop | Type | Meaning |
| --- | --- | --- |
| `value` | `Gantt` | The chart |
| `onChange` | `(next: Gantt) => void` | Every change, as the whole new chart |
| `scale` | `"day" \| "week" \| "month"` | The scale; without it the view keeps its own, starting on weeks |
| `onScaleChange` | `(scale) => void` | When the user changes the scale |
| `today` | `CalendarDay` | Today, marked on the drawing; the user's local date by default |
| `readOnly` | `boolean` | Shows the chart without changing it |
| `onOpenTask` | `(id: string) => void` | Opens a task the host's way; without it the built-in task dialog opens |
| `selectedId` | `string \| null` | The task shown as chosen |
| `autoSchedule` | `boolean` | Move dependent tasks: without it the view keeps its own, starting on |
| `onAutoScheduleChange` | `(on: boolean) => void` | When the user switches Move dependent tasks |
| `strings`, `t`, `locale`, `theme`, `className` | | As for every view ([interface](interface.md)) |

## The data

```ts
type Gantt = { groups: GanttGroup[]; tasks: GanttTask[] };
type GanttGroup = { id: string; name: string; collapsed: boolean; colour?: Colour };
type GanttTask = {
  id: string;
  name: string;
  groupId: string | null;   // one level of groups; null is outside every group
  start: CalendarDay;       // "YYYY-MM-DD"
  end: CalendarDay;         // included: a one-day task ends the day it starts
  milestone: boolean;       // start and end the same day, drawn as a diamond
  progress: number;         // a whole number, 0 to 100
  colour: Colour;           // a palette index, or null
  dependsOn: string[];      // finish-to-start predecessors
};
```

The document kind is `ganttDocument` (`kind: "gantt"`, version 1). Its
checks refuse ids used twice, a task in a group that is not there, an end
before its start, a milestone with a length, a dependency on a task that is
not there, on the task itself or twice, and dependencies that go round in a
cycle. Names are 1 to 120 characters, trimmed. A chart holds at most 2000
tasks (`MAX_GANTT_TASKS`) and 200 groups (`MAX_GANTT_GROUPS`); a task
depends on at most 50 others (`MAX_DEPENDENCIES`).

The rows read in order: the tasks outside every group first (as the board
puts the cards outside every column first), then each group's summary row
and its tasks in the groups' order. Within a group, the tasks keep the
order they have in `tasks`.

Days are calendar days and lengths count calendar days, the last day
included: a task from Monday to Friday lasts five days (decision 17; no
working calendar yet). A task **starts too early** when it starts on or
before the last day of a task it depends on: finish-to-start means it may
start the day after.

### Edit operations

Pure functions returning `{ ok: true, value }` or `{ ok: false, reason }`
with the common problem codes (`blank`, `tooLong`, `limit`, `missing`,
`duplicate`, `order`, `invalid`) and one of the chart's own, `cycle`
(`GanttProblem`):

- Groups: `addGanttGroup`, `renameGanttGroup`, `moveGanttGroup`,
  `setGanttGroupCollapsed`, `toggleGanttGroup`, `deleteGanttGroup` (its
  tasks join the end of the group before, the start of the group after, the
  end of the tasks outside every group, or go with it, with the
  dependencies on them; as jerome's plot parts), `tasksInGanttGroup`.
- Tasks: `blankGanttTask`, `addGanttTask` (at a place in its group),
  `putGanttTask` (the dialog's save: in place, or at the end of another
  group; a milestone's end becomes its start), `renameGanttTask`,
  `deleteGanttTask` (and the dependencies on it), `moveGanttTask` (to a
  group, at a place).
- Days: `shiftTask` (both ends by n days), `resizeTask` (one end by n days;
  never past the other, `order`; a milestone is never resized, `invalid`),
  `setTaskProgress`.
- Dependencies: `addDependency` (refuses `cycle` for the task itself or a
  task that depends on it through others, `duplicate`, `missing`),
  `removeDependency`, `canDependOn`.
- Reading: `ganttSections`, `ganttRows` (the rows as drawn, folded groups
  without their tasks), `groupSpan` (a summary row's first and last day),
  `ganttTaskPlace`, `ganttStepTarget` (where Alt+↑ ↓ takes a task),
  `dependencyConflicts` (each broken dependency) and `lateTasks` (the tasks
  that start too early).

Days outside the calendar's years (0001 to 9999) are refused (`invalid`).
Tasks an edit does not change stay the same objects, so the view draws
again only the rows that changed.

## The view

A toolbar (New task, New group, the scale as three pressed buttons, Go to
today), then a tree grid with the name column on the left, which stays in
place, and the drawing, which scrolls under a header that stays in place:

- **Header**: the larger units above the scale's own, formatted in the
  locale with `Intl`: months over days (each day's weekday letter and
  number), months over weeks (each Monday's day and month) or years over
  months. A month only partly drawn, at either end of the range, is named
  in full when its name fits the width drawn, else in short in the locale
  ("Sep 2026", then "Sep"), else not at all, never clipped; the widths are
  reckoned from the characters (`fittingLabel`), not measured. A label
  shortened or left out has the full name as its title. **Today** is
  labelled in the header and drawn as a line.
- **Day scale**: Saturdays and Sundays are shaded.
- **Range**: every task and today, with a week (days), two weeks (weeks)
  or a month (months) of room either side, in whole units. On opening, today
  is a third of the way across; Go to today brings it back; changing the
  scale keeps the day in the middle in the middle.
- **Tasks**: a bar outlined in the task's colour (the accent colour when it
  has none), filled in that colour as far as it is done and with a faint
  tint of it for the rest; a milestone is a diamond.
- **Groups**: a summary row with a button that folds and unfolds it (the
  fold is stored in the chart) and a black bar from its first task's start
  to its last task's end.
- **Dependencies**: an arrow from the end of each predecessor to the start
  of its task; a task in a folded group is drawn on its group's row.
- **Conflicts**: a task that starts too early has a dashed warning outline
  and a "!" beside its bar, a "Starts too early" badge beside its name, the
  reason in its bar's name ("starts before Sketch ends"), and its arrow is
  dashed in the warning colour; a note above the chart counts them. None of
  it is told by colour alone.

New task adds a five-day task after the focused one (starting the day after
it ends) in its group, or today, at the end of the focused group or outside
every group, and opens its name for editing; New group adds one at the end,
its name open. Deleting a task asks first (an alert dialog above the chart);
deleting a group without tasks does not, and one with tasks asks where they
go (the group before, the group after, outside every group, or deleted with
it).

The built-in task dialog edits the name, the first and last day (date
fields), the milestone switch (which disables the end), the percentage
done, the colour (a menu with a box beside it showing the colour chosen,
as the board's card dialog has), the group and the tasks it depends on: those that depend
on it, through others too, cannot be chosen. Save stores it all at once,
saying why when it is refused; Cancel and Escape change nothing.

### The pointer

Drag a bar to move it and its ends to resize it, snapping to whole days on
every scale; the bar shows its new days in its tooltip while dragged, and
only that row draws until the drop (the arrows follow on the drop). Escape
during a drag cancels it. A milestone moves and never resizes. A double
click opens a task; a right click opens its menu (Open, Rename, Move up,
Move down, Move to group…, Depends on…, Delete task) or a group's
(Collapse or Expand, Rename, Move up, Move down, New task in this group,
Delete group). Ctrl+wheel changes the scale.

Each end of a bar is a zone about 8 pixels wide inside the bar (a quarter
of a short bar, so its middle can still be grabbed), with the resize
cursor and a grip shown on hover and focus: the left end moves the start,
the right end the end, the middle the whole task.

**Reordering.** A task's name in the left column is dragged up or down
the rows (a grip shows on hover): a line shows where it goes, among the
tasks of any group or outside every group, and a folded group it is
dropped on unfolds and takes it at its end. A group's name drags the group,
with its tasks, among the groups. The bar still moves only in time. Escape
cancels; the move is announced as Alt+↑ ↓'s are, and the keys stay the
keyboard's way.

**Linking.** A drag that starts with Ctrl held (⌘ on macOS, where
Ctrl+click is the context menu) links instead of moving: the task dropped on
comes to depend on the task dragged from (dragged from the parent to its
child). While dragging, an arrow is drawn from the end of the task dragged
from to the start of the task under the pointer (or to the pointer), and
the row under the pointer is highlighted; any part of a
task's row takes the drop. A link that cannot be made (a group's row, a
dependency already there, one that would make a cycle, too many) is
previewed dashed in the problem colour with the reason beside the pointer,
and dropping it changes nothing but says why; dropped on the task itself
or outside the rows, it links nothing. Escape cancels. The drop is
announced ("Paint now depends on Sketch"). The keys' way is
the task menu's **Depends on…**: a list of the tasks it may depend on.

### Move dependent tasks

A pressed button in the toolbar, **Move dependent tasks** (on by default;
the `autoSchedule` prop, which the view keeps for itself without it), keeps
every task after the tasks it depends on as the chart is edited:

- A task moved, or whose end moves, later pushes the tasks that depend on
  it (and theirs, and so on) only as far as needed: one that would start
  on or before its predecessor's last day starts the day after, keeping
  its length. A gap (a breather) absorbs the move; moving earlier leaves
  them where they are.
- A task, or its start, goes no earlier than the day after the last day of
  the tasks it depends on: a drag stops there, Alt+← stops there and says
  why, and the dialog's save moves it there (keeping its length).
- A new dependency (by drag, the menu or the dialog) moves the task after
  its new predecessor, and pushes the tasks after it.
- It applies to every edit: drags, keys, the dialog. Tasks that already
  start too early (opened that way, or before the button was pressed) stay
  as they are and flagged, until they or a task they depend on is moved.

Off, nothing moves by itself, and tasks starting too early are only
flagged, as before. In the model the same edits take an option,
`{ autoSchedule: true }`, and `earliestStart` gives the first day a task
may start on.

### Keys

| Keys | On a task | On a group |
| --- | --- | --- |
| ↑ ↓, Home, End | The row above or below, the first or last | The same |
| ← | Its group's row | Fold the group |
| → | | Unfold the group, or its first task |
| Alt+← Alt+→ | Move it a day earlier or later | |
| Alt+Shift+← Alt+Shift+→ | Move its end a day earlier or later | |
| Alt+↑ Alt+↓ | Move it up or down the rows, across groups | Move the group up or down |
| Enter | Open it | Fold or unfold |
| F2 | Rename it in place | Rename it in place |
| Delete | Delete it (asking first) | Delete it (asking where its tasks go) |
| Menu, Shift+F10 | Its menu | Its menu |
| Ctrl+= (or Ctrl++), Ctrl+- | A finer or coarser scale | The same |

The keys move a task, or its end, by a day on every scale, as the pointer
snaps to days. An end goes no further than the other: shortening stops at
one day, and shortening a one-day task says it cannot. Alt+↑ at the top of a group takes the
task to the end of the section above (the group before, or the tasks
outside every group), Alt+↓ at its bottom to the start of the next; a
folded group it goes into unfolds. The scale keys are jerome's timeline
zoom keys.

### Accessibility

The chart is a `treegrid` named "Gantt chart", with a row a task or group
(`aria-level` 2 for a task in a group, `aria-expanded` on a group's row,
`aria-selected` on the chosen task) and two cells; the header row's dates
cell is named with the first and last day drawn, its labels hidden. One
control a row is a Tab stop (the bar, or the group's button), and the
arrows move between them. A bar's name gives the task's name, days, length
and percentage done, or a milestone's day, then the tasks it starts too
early for; a group's button gives its name, its number of tasks and its
days. Moves, resizes, folding, deleting and the scale are announced in the
polite live region ("Sketch: moved to 11 Nov 2026 to 13 Nov 2026"), and the
focus stays on the moved task, goes back to the row after a menu, a dialog
or a question, and to the next row after a delete. In forced colours the
bars and diamonds take the text colour and their done parts the highlight.
A read-only chart moves nothing, offers only Open and folding, and folds
its groups for itself without changing the chart.

## Decisions

The owner's decisions of 5 November 2026:

- A group may have a colour (`colour`, optional in the stored group, so
  version 1 documents read as they are; none when it is left out), chosen
  with the group menu's **Colour…** (the colour picker, None included). Its
  summary bar is drawn in it (black without one), with a swatch beside its
  name. A task made in a group takes the group's colour as its own; tasks
  keep their colours afterwards, when the group's changes or they move.
- A double-click on a task's or a group's name renames it in place. Only a
  group's chevron folds it on a click; its name no longer does (Enter on
  the row still folds, F2 still renames).
- Every colour field is Eisenhower's own colour picker (a button with the
  swatch and name, opening a list with a swatch beside each colour), not a
  native menu.

The owner's decisions of 27 October 2026:

- Alt+← → move a task by a day, and Alt+Shift+← → resize it by a day, on
  every scale, as the pointer snaps to days (the first slice stepped a week
  on the week and month scales).
- The default scale is weeks.
- The limits stay: 2000 tasks, 200 groups, 50 dependencies a task, and
  names of 1 to 120 characters.
- A month's name in the header is shown in full when it fits the width
  drawn, else in short with its year, then in short, else left out; never a
  clipped word (the first slice clipped it: "Septer").

The owner's decisions of 4 November 2026, on reordering: tasks are
dragged up and down the rows by their names (the bar keeps moving in time),
into any group or none; groups are dragged by their names among the groups.

The owner's decisions of 4 November 2026, on dragging and linking:

- A bar's ends are wider zones inside it, with a grip on hover and focus.
- The part of a bar not yet done is a faint tint of its colour, not the
  surface's white or dark.
- Ctrl+drag (⌘+drag on macOS) from task A to task B makes B depend on A
  (the owner turned it round after trying it: A depending on B read as the
  child being the parent), with a preview arrow; any part of B's row takes the drop, and a link that
  cannot be made is previewed in the problem colour and refused with its
  reason. The keys' way is the task menu's Depends on….
- Move dependent tasks is a view setting (`autoSchedule`, a pressed button
  in the toolbar, on by default), not stored in the chart.
- With it on, dependents are pushed only as far as needed (a breather
  absorbs a move; moving earlier pulls nothing), a task stops at the day
  after its predecessors' last day, every edit keeps the rule, and tasks
  already starting too early are left until they or their predecessors
  move.

## Decisions to confirm

Made for the first slice, to be put to the owner:

- A milestone that depends on a task may not be on that task's last day
  (the same rule as for any task).
- The header labels today in the problem colour.
- Alt+↑ ↓ cross group boundaries (unlike the board, where Alt+← → change
  the column), since Alt+← → move tasks in time here.
- The fold of a group is stored in the chart (`collapsed`), as the brief
  says; a read-only view folds for itself.
