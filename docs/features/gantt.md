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
| `strings`, `t`, `locale`, `theme`, `className` | | As for every view ([interface](interface.md)) |

## The data

```ts
type Gantt = { groups: GanttGroup[]; tasks: GanttTask[] };
type GanttGroup = { id: string; name: string; collapsed: boolean };
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
  months. **Today** is labelled in the header and drawn as a line.
- **Day scale**: Saturdays and Sundays are shaded.
- **Range**: every task and today, with a week (days), two weeks (weeks)
  or a month (months) of room either side, in whole units. On opening, today
  is a third of the way across; Go to today brings it back; changing the
  scale keeps the day in the middle in the middle.
- **Tasks**: a bar outlined in the task's colour (the accent colour when it
  has none) and filled as far as it is done; a milestone is a diamond.
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
done, the colour, the group and the tasks it depends on: those that depend
on it, through others too, cannot be chosen. Save stores it all at once,
saying why when it is refused; Cancel and Escape change nothing.

### The pointer

Drag a bar to move it and its ends to resize it, snapping to whole days on
every scale; the bar shows its new days in its tooltip while dragged, and
only that row draws until the drop (the arrows follow on the drop). Escape
during a drag cancels it. A milestone moves and never resizes. A double
click opens a task; a right click opens its menu (Open, Rename, Move up,
Move down, Move to group…, Delete task) or a group's (Collapse or Expand,
Rename, Move up, Move down, New task in this group, Delete group).
Ctrl+wheel changes the scale.

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

The owner's decisions of 27 October 2026:

- Alt+← → move a task by a day, and Alt+Shift+← → resize it by a day, on
  every scale, as the pointer snaps to days (the first slice stepped a week
  on the week and month scales).
- The default scale is weeks.
- The limits stay: 2000 tasks, 200 groups, 50 dependencies a task, and
  names of 1 to 120 characters.

## Decisions to confirm

Made for the first slice, to be put to the owner:

- A milestone that depends on a task may not be on that task's last day
  (the same rule as for any task).
- The header labels today in the problem colour.
- Alt+↑ ↓ cross group boundaries (unlike the board, where Alt+← → change
  the column), since Alt+← → move tasks in time here.
- The fold of a group is stored in the chart (`collapsed`), as the brief
  says; a read-only view folds for itself.
