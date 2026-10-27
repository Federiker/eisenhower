// biome-ignore-all lint/a11y/useSemanticElements: a tree grid of divs, so that the name column and the header stay in place as the drawing scrolls, with layers behind and over the rows.
// biome-ignore-all lint/a11y/useFocusableInteractive: the focus is on the control in each row (a bar, a group's button), as a tree grid allows; rows and cells are not stops of their own.
import {
  addDays,
  addGanttGroup,
  addGanttTask,
  blankGanttTask,
  type CalendarDay,
  dayOfNumber,
  daysBetween,
  dependencyConflicts,
  deleteGanttGroup,
  deleteGanttTask,
  freeName,
  type Gantt as GanttData,
  type GanttGroupDisposal,
  type GanttProblem,
  type GanttResult,
  type GanttRow,
  ganttRows,
  ganttSections,
  ganttStepTarget,
  ganttTaskPlace,
  moveGanttGroup,
  moveGanttTask,
  newId,
  renameGanttGroup,
  renameGanttTask,
  resizeTask,
  setGanttGroupCollapsed,
  shiftTask,
  today as localToday,
} from "@eisenhower/model";
import { type KeyboardEvent, type MouseEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Button } from "../controls/Button";
import { classNames } from "../controls/classNames";
import { ContextMenu, type MenuItem, type MenuPlace, placeBelow } from "../controls/ContextMenu";
import { InlineQuestion } from "../controls/InlineQuestion";
import { MoveToDialog } from "../controls/MoveToDialog";
import { Notice } from "../controls/Notice";
import { LiveRegion, useAnnouncer } from "../hooks/useAnnouncer";
import { actionOf, shortcutsIn } from "../keyboard/shortcuts";
import type { MessageKey } from "../strings/en-GB";
import { useLocale, useTranslate } from "../strings/translate";
import { type EisenhowerSettings, ViewRoot } from "../theme/EisenhowerProvider";
import { formatDay, formatLength, formatSpan } from "./format";
import { GanttArrows, GanttBackdrop, GanttHeader } from "./GanttDrawing";
import { type DragMode, GroupRow, ROW_HEIGHT, type RowBridge, TaskRow } from "./GanttRows";
import { type GanttScale, geometryOf, xOfDay, zoomed } from "./scale";
import { TaskDialog } from "./TaskDialog";

/** The name column's width, in pixels (the stylesheet's `--eh-gantt-name-width` is set from it). */
const NAME_WIDTH = 240;
const ZOOM_NAMES: Readonly<Record<GanttScale, MessageKey>> = {
  day: "gantt.scaleDay",
  week: "gantt.scaleWeek",
  month: "gantt.scaleMonth",
};
const SHORTCUTS = shortcutsIn("gantt");

export type GanttProps = EisenhowerSettings & {
  /** The chart (the model's `Gantt`). */
  value: GanttData;
  /** Every change, as the whole new chart. */
  onChange: (next: GanttData) => void;
  /** The scale drawn: a column a day, a week or a month. Without it the chart keeps its own, starting on weeks. */
  scale?: GanttScale;
  onScaleChange?: (scale: GanttScale) => void;
  /** Today (marked on the drawing): the user's local date unless given. */
  today?: CalendarDay;
  /** Shows the chart without changing it: no moving, resizing, adding, renaming or deleting. */
  readOnly?: boolean;
  /** Opens a task the host's own way (Enter, a double click, the menu); without it, the built-in task dialog opens. */
  onOpenTask?: (id: string) => void;
  /** The task shown as chosen (the one the host has open). */
  selectedId?: string | null;
  className?: string;
};

type Menu = { rowKey: string; place: MenuPlace; returnTo: HTMLElement | null };
type TaskAction = "open" | "rename" | "up" | "down" | "moveTo" | "delete";
type GroupAction = "toggle" | "rename" | "up" | "down" | "newTask" | "delete";

const taskKey = (id: string) => `task:${id}`;
const groupKey = (id: string) => `group:${id}`;
const keyOf = (row: GanttRow) => (row.kind === "task" ? taskKey(row.task.id) : groupKey(row.group.id));
const idOf = (rowKey: string) => rowKey.slice(rowKey.indexOf(":") + 1);

/**
 * The gantt chart (decision 17): a tree grid with a row a task or a group, the name column beside the
 * drawing. Tasks are bars (their done part filled), milestones diamonds, groups summary bars over their tasks
 * that fold and unfold; dependencies are arrows, and a task that starts before a predecessor ends is flagged in
 * words as well as drawn. The header dates follow the locale; the day scale shades weekends, and today is
 * marked. Bars move and resize with the pointer (whole days) and the keys; Ctrl+= and Ctrl+- or Ctrl+wheel
 * change the scale.
 */
export function Gantt({ strings, t, locale, theme, className, ...props }: GanttProps) {
  return (
    <ViewRoot strings={strings} t={t} locale={locale} theme={theme} className={classNames("eh-gantt", className)}>
      <GanttView {...props} />
    </ViewRoot>
  );
}

function GanttView({
  value,
  onChange,
  scale: scaleProp,
  onScaleChange,
  today: todayProp,
  readOnly = false,
  onOpenTask,
  selectedId = null,
}: Omit<GanttProps, keyof EisenhowerSettings | "className">) {
  const t = useTranslate();
  const locale = useLocale();
  const { message, announce } = useAnnouncer();
  const [ownScale, setOwnScale] = useState<GanttScale>("week");
  const scale = scaleProp ?? ownScale;
  const today = todayProp ?? localToday();
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState<{ rowKey: string; n: number } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [dialog, setDialog] = useState<string | null>(null);
  const [problem, setProblem] = useState<GanttProblem | "milestone" | null>(null);
  // A read-only chart folds its groups for this view only, without changing the chart.
  const [folded, setFolded] = useState<ReadonlyMap<string, boolean>>(new Map());
  const elements = useRef(new Map<string, HTMLElement>());
  const scroller = useRef<HTMLDivElement>(null);
  const keepCentre = useRef<number | null>(null);

  const rows = useMemo(() => ganttRows(value, readOnly ? folded : undefined), [value, readOnly, folded]);
  // The same geometry while the range and scale stay the same, so that the rows do not all draw again after an edit.
  const drawn = geometryOf(value, scale, today);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the geometry is its scale, first day and length; the rest follows.
  const geometry = useMemo(() => drawn, [drawn.scale, drawn.first, drawn.days]);
  const conflicts = useMemo(() => dependencyConflicts(value), [value]);
  const conflictNames = useMemo(() => {
    const names = new Map<string, string[]>();
    const byId = new Map(value.tasks.map((task) => [task.id, task]));
    for (const conflict of conflicts) {
      const list = names.get(conflict.taskId) ?? [];
      list.push(byId.get(conflict.predecessorId)!.name);
      names.set(conflict.taskId, list);
    }
    return names;
  }, [value, conflicts]);
  const lateCount = conflictNames.size;
  const rowKeys = rows.map(keyOf);
  const selectedKey = selectedId === null ? null : taskKey(selectedId);
  const tabbable =
    (focusKey !== null && rowKeys.includes(focusKey) && focusKey) ||
    (selectedKey !== null && rowKeys.includes(selectedKey) && selectedKey) ||
    rowKeys[0] ||
    null;

  useEffect(() => {
    if (pendingFocus) elements.current.get(pendingFocus.rowKey)?.focus();
  }, [pendingFocus]);

  // Opening: today in view, a third of the way across.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the chart is first drawn.
  useLayoutEffect(() => {
    scrollToDay(today);
  }, []);

  // After a change of scale, the day that was in the middle of the view stays there.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (keepCentre.current === null || !element) return;
    const visible = element.clientWidth - NAME_WIDTH;
    element.scrollLeft = Math.max(0, (keepCentre.current - geometry.first) * geometry.dayWidth - visible / 2);
    keepCentre.current = null;
  }, [geometry]);

  function scrollToDay(day: CalendarDay) {
    const element = scroller.current;
    if (!element) return;
    const visible = Math.max(element.clientWidth - NAME_WIDTH, 0);
    element.scrollLeft = Math.max(0, xOfDay(geometry, day) - visible / 3);
  }

  function focusRow(rowKey: string) {
    setFocusKey(rowKey);
    setPendingFocus((old) => ({ rowKey, n: (old?.n ?? 0) + 1 }));
  }

  function setScale(next: GanttScale) {
    if (next === scale) return;
    const element = scroller.current;
    if (element) {
      const visible = element.clientWidth - NAME_WIDTH;
      keepCentre.current = geometry.first + (element.scrollLeft + visible / 2) / geometry.dayWidth;
    }
    if (scaleProp === undefined) setOwnScale(next);
    onScaleChange?.(next);
    announce(t("gantt.scaleNow", { scale: t(ZOOM_NAMES[next]) }));
  }

  /** Stores an edit's chart, or says why it was refused. */
  function apply(result: GanttResult): GanttData | null {
    if (!result.ok) {
      setProblem(result.reason);
      return null;
    }
    setProblem(null);
    onChange(result.value);
    return result.value;
  }

  const taskOf = (id: string, chart: GanttData = value) => chart.tasks.find((task) => task.id === id);
  const groupOf = (id: string, chart: GanttData = value) => chart.groups.find((group) => group.id === id);
  const isCollapsed = (id: string) => (readOnly ? folded.get(id) : undefined) ?? groupOf(id)?.collapsed ?? false;
  function setCollapsed(id: string, collapsed: boolean) {
    const group = groupOf(id);
    if (!group || isCollapsed(id) === collapsed) return;
    if (readOnly) setFolded(new Map(folded).set(id, collapsed));
    else if (!apply(setGanttGroupCollapsed(value, id, collapsed))) return;
    announce(t(collapsed ? "gantt.collapsed" : "gantt.expanded", { name: group.name }));
  }

  /** The chart with a group unfolded, so that a task moved or added into it stays in view. */
  function unfolded(chart: GanttData, groupId: string | null): GanttData {
    if (groupId === null || !groupOf(groupId, chart)?.collapsed) return chart;
    const result = setGanttGroupCollapsed(chart, groupId, false);
    return result.ok ? result.value : chart;
  }

  function moveDays(id: string, mode: DragMode, days: number) {
    const task = taskOf(id);
    if (!task || readOnly) return;
    if (mode !== "move" && task.milestone) {
      setProblem("milestone");
      return;
    }
    const length = daysBetween(task.start, task.end);
    // An end goes no further than the other: a task is one day at the shortest.
    const by = mode === "start" ? Math.min(days, length) : mode === "end" ? Math.max(days, -length) : days;
    if (by === 0) {
      setProblem("order");
      return;
    }
    const next = apply(mode === "move" ? shiftTask(value, id, by) : resizeTask(value, id, mode, by));
    const moved = next && taskOf(id, next);
    if (!moved) return;
    const dates = formatSpan(moved.start, moved.end, t, locale);
    announce(
      mode === "move"
        ? t("gantt.movedDays", { name: moved.name, dates })
        : t("gantt.resized", { name: moved.name, dates, length: formatLength(moved, t) }),
    );
  }

  function moveTaskTo(id: string, target: { groupId: string | null; index: number } | null) {
    if (!target || readOnly) return;
    const result = moveGanttTask(value, id, target.groupId, target.index);
    const next = apply(result.ok ? { ok: true, value: unfolded(result.value, target.groupId) } : result);
    focusRow(taskKey(id));
    const place = next && ganttTaskPlace(next, id);
    if (!next || !place) return;
    const section = ganttSections(next)[place.section]!;
    announce(
      t("gantt.movedTo", {
        name: taskOf(id, next)!.name,
        group: section.groupId === null ? t("gantt.noGroup") : groupOf(section.groupId, next)!.name,
        position: place.index + 1,
        total: section.tasks.length,
      }),
    );
  }

  function moveGroupBy(id: string, by: number) {
    const index = value.groups.findIndex((group) => group.id === id);
    if (readOnly || index < 0 || index + by < 0 || index + by >= value.groups.length) return;
    if (!apply(moveGanttGroup(value, id, index + by))) return;
    focusRow(groupKey(id));
    announce(
      t("gantt.groupMovedTo", { name: groupOf(id)!.name, position: index + by + 1, total: value.groups.length }),
    );
  }

  function open(id: string) {
    if (onOpenTask) onOpenTask(id);
    else setDialog(id);
  }

  /** The row that takes the focus when some go away: the first one left below them, else the last one above. */
  function neighbourOf(rowKey: string, gone: ReadonlySet<string>): string | null {
    const index = rowKeys.indexOf(rowKey);
    return (
      rowKeys.slice(index + 1).find((key) => !gone.has(key)) ??
      rowKeys
        .slice(0, index)
        .reverse()
        .find((key) => !gone.has(key)) ??
      null
    );
  }

  function removeTask(id: string) {
    const name = taskOf(id)?.name ?? "";
    const neighbour = neighbourOf(taskKey(id), new Set([taskKey(id)]));
    if (!apply(deleteGanttTask(value, id))) return;
    setDeleting(null);
    announce(t("gantt.deleted", { name }));
    if (neighbour) focusRow(neighbour);
  }

  function removeGroup(id: string, disposal: GanttGroupDisposal) {
    const name = groupOf(id)?.name ?? "";
    const gone = new Set([groupKey(id)]);
    if (disposal === "delete") {
      for (const task of value.tasks) if (task.groupId === id) gone.add(taskKey(task.id));
    }
    const neighbour = neighbourOf(groupKey(id), gone);
    if (!apply(deleteGanttGroup(value, id, disposal))) return;
    setDeleting(null);
    announce(t("gantt.deleted", { name }));
    if (neighbour) focusRow(neighbour);
  }

  function askDelete(rowKey: string) {
    if (readOnly) return;
    if (rowKey.startsWith("group:") && !value.tasks.some((task) => task.groupId === idOf(rowKey))) {
      removeGroup(idOf(rowKey), "delete");
      return;
    }
    setDeleting(rowKey);
  }

  function keep(rowKey: string) {
    setDeleting(null);
    focusRow(rowKey);
  }

  /** A new task after the focused one in its group (or at the end of the focused group), open for its name. */
  function newTask(inGroup?: string) {
    if (readOnly) return;
    const focused = focusKey !== null && rowKeys.includes(focusKey) ? focusKey : null;
    const after = focused?.startsWith("task:") && inGroup === undefined ? taskOf(idOf(focused)) : undefined;
    const groupId = inGroup ?? (after ? after.groupId : focused?.startsWith("group:") ? idOf(focused) : null);
    const start = after ? addDays(after.end, 1) : today;
    const task = blankGanttTask(
      newId(),
      freeName(value.tasks, t("gantt.newTaskName")),
      start,
      addDays(start, 4),
      groupId,
    );
    const place = after ? ganttTaskPlace(value, after.id) : null;
    const result = addGanttTask(value, task, place ? place.index + 1 : undefined);
    if (!apply(result.ok ? { ok: true, value: unfolded(result.value, groupId) } : result)) return;
    setFocusKey(taskKey(task.id));
    setRenaming(taskKey(task.id));
  }

  function newGroup() {
    if (readOnly) return;
    const id = newId();
    if (!apply(addGanttGroup(value, id, freeName(value.groups, t("gantt.newGroupName"))))) return;
    setFocusKey(groupKey(id));
    setRenaming(groupKey(id));
  }

  function rename(rowKey: string, name: string | null) {
    setRenaming(null);
    if (name !== null) {
      const id = idOf(rowKey);
      apply(rowKey.startsWith("task:") ? renameGanttTask(value, id, name) : renameGanttGroup(value, id, name));
    }
    focusRow(rowKey);
  }

  function rowKeyDown(event: KeyboardEvent<HTMLElement>, rowKey: string) {
    if (event.nativeEvent.isComposing) return;
    const action = actionOf(event.nativeEvent, SHORTCUTS);
    if (action === null || action === "zoomIn" || action === "zoomOut" || action === "saveText") return;
    const index = rowKeys.indexOf(rowKey);
    const id = idOf(rowKey);
    const task = rowKey.startsWith("task:") ? taskOf(id) : undefined;
    event.preventDefault();
    switch (action) {
      case "focusUp":
      case "focusDown":
      case "focusFirst":
      case "focusLast": {
        const to =
          action === "focusUp"
            ? Math.max(index - 1, 0)
            : action === "focusDown"
              ? Math.min(index + 1, rowKeys.length - 1)
              : action === "focusFirst"
                ? 0
                : rowKeys.length - 1;
        focusRow(rowKeys[to]!);
        break;
      }
      case "focusLeft":
        if (task?.groupId) focusRow(groupKey(task.groupId));
        else if (!task) setCollapsed(id, true);
        break;
      case "focusRight":
        if (!task && isCollapsed(id)) setCollapsed(id, false);
        else if (!task && rowKeys[index + 1]?.startsWith("task:")) focusRow(rowKeys[index + 1]!);
        break;
      case "moveLeft":
      case "moveRight":
        if (task) moveDays(id, "move", action === "moveLeft" ? -1 : 1);
        break;
      case "shortenTask":
      case "lengthenTask":
        if (task) moveDays(id, "end", action === "shortenTask" ? -1 : 1);
        break;
      case "moveUp":
      case "moveDown":
        if (task) moveTaskTo(id, ganttStepTarget(value, id, action === "moveUp" ? "up" : "down"));
        else moveGroupBy(id, action === "moveUp" ? -1 : 1);
        break;
      case "open":
        if (task) open(id);
        else setCollapsed(id, !isCollapsed(id));
        break;
      case "rename":
        if (!readOnly) setRenaming(rowKey);
        break;
      case "delete":
        askDelete(rowKey);
        break;
      case "menu":
        setMenu({ rowKey, place: placeBelow(event.currentTarget), returnTo: event.currentTarget });
        break;
      case "escape":
        setProblem(null);
        break;
    }
  }

  // The rows' bridge is made once; it calls the latest of these through a ref, so the rows never draw again
  // only because the chart's own functions are new.
  const latest = useRef({ rowKeyDown, open, setCollapsed, isCollapsed, moveDays, rename, setMenu, setFocusKey });
  latest.current = { rowKeyDown, open, setCollapsed, isCollapsed, moveDays, rename, setMenu, setFocusKey };
  const bridge = useMemo<RowBridge>(
    () => ({
      key: (event, rowKey) => latest.current.rowKeyDown(event, rowKey),
      focused: (rowKey) => latest.current.setFocusKey(rowKey),
      register: (rowKey, element) => {
        if (element) elements.current.set(rowKey, element);
        else elements.current.delete(rowKey);
      },
      open: (id) => latest.current.open(id),
      toggle: (id) => latest.current.setCollapsed(id, !latest.current.isCollapsed(id)),
      menu: (rowKey, event: MouseEvent<HTMLElement>) => {
        event.preventDefault();
        latest.current.setMenu({
          rowKey,
          place: { left: event.clientX, top: event.clientY },
          returnTo: elements.current.get(rowKey) ?? null,
        });
      },
      drag: (id, mode, days) => latest.current.moveDays(id, mode, days),
      rename: (rowKey, name) => latest.current.rename(rowKey, name),
    }),
    [],
  );

  function closeMenu() {
    const returnTo = menu?.returnTo ?? null;
    setMenu(null);
    returnTo?.focus();
  }

  function taskItems(id: string): MenuItem<TaskAction>[] {
    const items: MenuItem<TaskAction>[] = [{ id: "open", label: t("gantt.open") }];
    if (readOnly) return items;
    return [
      ...items,
      { id: "rename", label: t("common.rename") },
      { id: "up", label: t("common.moveUp"), disabled: !ganttStepTarget(value, id, "up") },
      { id: "down", label: t("common.moveDown"), disabled: !ganttStepTarget(value, id, "down") },
      { id: "moveTo", label: t("gantt.moveToGroup") },
      { id: "delete", label: t("gantt.deleteTask"), separated: true },
    ];
  }

  function groupItems(id: string): MenuItem<GroupAction>[] {
    const index = value.groups.findIndex((group) => group.id === id);
    const toggle: MenuItem<GroupAction> = {
      id: "toggle",
      label: t(isCollapsed(id) ? "gantt.expand" : "gantt.collapse", { name: groupOf(id)?.name ?? "" }),
    };
    if (readOnly) return [toggle];
    return [
      toggle,
      { id: "rename", label: t("common.rename") },
      { id: "up", label: t("common.moveUp"), disabled: index <= 0 },
      { id: "down", label: t("common.moveDown"), disabled: index >= value.groups.length - 1 },
      { id: "newTask", label: t("gantt.newTaskHere") },
      { id: "delete", label: t("gantt.deleteGroup"), separated: true },
    ];
  }

  function chooseTask(action: TaskAction, id: string) {
    setMenu(null);
    const rowKey = taskKey(id);
    switch (action) {
      case "open":
        open(id);
        break;
      case "rename":
        setRenaming(rowKey);
        break;
      case "up":
      case "down":
        moveTaskTo(id, ganttStepTarget(value, id, action));
        break;
      case "moveTo":
        setMoving(id);
        break;
      case "delete":
        setDeleting(rowKey);
        break;
    }
  }

  function chooseGroup(action: GroupAction, id: string) {
    setMenu(null);
    const rowKey = groupKey(id);
    switch (action) {
      case "toggle":
        setCollapsed(id, !isCollapsed(id));
        focusRow(rowKey);
        break;
      case "rename":
        setRenaming(rowKey);
        break;
      case "up":
      case "down":
        moveGroupBy(id, action === "up" ? -1 : 1);
        break;
      case "newTask":
        newTask(id);
        break;
      case "delete":
        askDelete(rowKey);
        break;
    }
  }

  const deletingTask = deleting?.startsWith("task:") ? taskOf(idOf(deleting)) : undefined;
  const deletingGroup = deleting?.startsWith("group:") ? groupOf(idOf(deleting)) : undefined;
  const groupIndex = deletingGroup ? value.groups.indexOf(deletingGroup) : -1;
  const before = value.groups[groupIndex - 1];
  const after = groupIndex >= 0 ? value.groups[groupIndex + 1] : undefined;
  const menuTask = menu?.rowKey.startsWith("task:") ? taskOf(idOf(menu.rowKey)) : undefined;
  const menuGroup = menu?.rowKey.startsWith("group:") ? groupOf(idOf(menu.rowKey)) : undefined;
  const movingTask = moving ? taskOf(moving) : undefined;
  const dialogTask = dialog ? taskOf(dialog) : undefined;
  const firstDay = dayOfNumber(geometry.first);
  const lastDay = dayOfNumber(geometry.first + geometry.days - 1);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Ctrl+= and Ctrl+- change the scale from anywhere in the chart; its controls take the other keys.
    <div
      className="eh-gantt-view"
      style={{ "--eh-gantt-name-width": `${NAME_WIDTH}px`, "--eh-gantt-row": `${ROW_HEIGHT}px` } as object}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        const action = actionOf(event.nativeEvent, SHORTCUTS);
        if (action !== "zoomIn" && action !== "zoomOut") return;
        event.preventDefault();
        setScale(zoomed(scale, action === "zoomIn" ? -1 : 1));
      }}
    >
      <fieldset className="eh-group eh-gantt-tools" aria-label={t("gantt.tools")}>
        {!readOnly && (
          <>
            <Button onClick={() => newTask()}>{t("gantt.newTask")}</Button>
            <Button onClick={newGroup}>{t("gantt.newGroup")}</Button>
          </>
        )}
        <fieldset className="eh-group eh-gantt-scales" aria-label={t("gantt.scale")}>
          {(["day", "week", "month"] as const).map((one) => (
            <Button key={one} pressed={scale === one} onClick={() => setScale(one)}>
              {t(ZOOM_NAMES[one])}
            </Button>
          ))}
        </fieldset>
        <Button onClick={() => scrollToDay(today)}>{t("gantt.goToToday")}</Button>
      </fieldset>
      {deletingTask && (
        <InlineQuestion
          label={t("gantt.deleteTaskNamed", { name: deletingTask.name })}
          question={t("gantt.deleteTaskWarning")}
          onEscape={() => keep(taskKey(deletingTask.id))}
          actions={
            <>
              <Button autoFocus variant="danger" onClick={() => removeTask(deletingTask.id)}>
                {t("gantt.confirmDeleteTask")}
              </Button>
              <Button onClick={() => keep(taskKey(deletingTask.id))}>{t("common.cancel")}</Button>
            </>
          }
        />
      )}
      {deletingGroup && (
        <InlineQuestion
          label={t("gantt.deleteGroupNamed", { name: deletingGroup.name })}
          question={t("gantt.deleteGroupWarning")}
          onEscape={() => keep(groupKey(deletingGroup.id))}
          actions={
            <>
              {before && (
                <Button onClick={() => removeGroup(deletingGroup.id, "before")}>
                  {t("gantt.moveTasksTo", { name: before.name })}
                </Button>
              )}
              {after && (
                <Button onClick={() => removeGroup(deletingGroup.id, "after")}>
                  {t("gantt.moveTasksTo", { name: after.name })}
                </Button>
              )}
              <Button onClick={() => removeGroup(deletingGroup.id, "outside")}>{t("gantt.moveTasksOutside")}</Button>
              <Button variant="danger" onClick={() => removeGroup(deletingGroup.id, "delete")}>
                {t("gantt.deleteWithTasks")}
              </Button>
              <Button autoFocus onClick={() => keep(groupKey(deletingGroup.id))}>
                {t("common.cancel")}
              </Button>
            </>
          }
        />
      )}
      {problem && (
        <Notice tone="problem" className="eh-gantt-problem">
          {t(problem === "milestone" ? "gantt.problem.milestone" : `gantt.problem.${problem}`)}
        </Notice>
      )}
      {lateCount > 0 && <Notice className="eh-gantt-late">{t("gantt.conflictSummary", { count: lateCount })}</Notice>}
      <div
        className="eh-gantt-scroll"
        ref={scroller}
        onWheel={(event) => {
          if (!event.ctrlKey) return;
          event.preventDefault();
          setScale(zoomed(scale, event.deltaY < 0 ? -1 : 1));
        }}
      >
        <div
          role="treegrid"
          aria-label={t("gantt.label")}
          aria-rowcount={rows.length + 1}
          aria-colcount={2}
          aria-readonly={readOnly || undefined}
          className="eh-gantt-grid"
          style={{ width: NAME_WIDTH + geometry.width }}
        >
          <div role="rowgroup" className="eh-gantt-head">
            <div role="row" className="eh-gantt-row" aria-rowindex={1}>
              <div role="columnheader" className="eh-gantt-name">
                {t("gantt.columnName")}
              </div>
              <div
                role="columnheader"
                className="eh-gantt-cell"
                aria-label={t("gantt.columnDatesRange", {
                  start: formatDay(firstDay, locale),
                  end: formatDay(lastDay, locale),
                })}
              >
                <GanttHeader geometry={geometry} today={today} />
              </div>
            </div>
          </div>
          <div role="rowgroup" className="eh-gantt-body">
            <GanttBackdrop geometry={geometry} today={today} height={rows.length * ROW_HEIGHT} />
            <GanttArrows rows={rows} tasks={value.tasks} conflicts={conflicts} geometry={geometry} />
            {rows.map((row, index) =>
              row.kind === "task" ? (
                <TaskRow
                  key={keyOf(row)}
                  task={row.task}
                  index={index}
                  level={row.task.groupId === null ? 1 : 2}
                  geometry={geometry}
                  conflicts={conflictNames.get(row.task.id) ?? NONE}
                  tabbable={tabbable === keyOf(row)}
                  selected={selectedId === row.task.id}
                  renaming={renaming === keyOf(row)}
                  readOnly={readOnly}
                  bridge={bridge}
                />
              ) : (
                <GroupRow
                  key={keyOf(row)}
                  group={row.group}
                  span={row.span}
                  count={row.count}
                  collapsed={isCollapsed(row.group.id)}
                  index={index}
                  geometry={geometry}
                  tabbable={tabbable === keyOf(row)}
                  renaming={renaming === keyOf(row)}
                  bridge={bridge}
                />
              ),
            )}
          </div>
        </div>
      </div>
      {rows.length === 0 && <Notice>{t("gantt.empty")}</Notice>}
      {rows.length > 0 && !readOnly && <Notice className="eh-gantt-help">{t("gantt.help")}</Notice>}
      <LiveRegion message={message} />
      {menu && menuTask && (
        <ContextMenu
          label={t("gantt.taskMenu", { name: menuTask.name })}
          items={taskItems(menuTask.id)}
          place={menu.place}
          onChoose={(action) => chooseTask(action, menuTask.id)}
          onClose={closeMenu}
        />
      )}
      {menu && menuGroup && (
        <ContextMenu
          label={t("gantt.groupMenu", { name: menuGroup.name })}
          items={groupItems(menuGroup.id)}
          place={menu.place}
          onChoose={(action) => chooseGroup(action, menuGroup.id)}
          onClose={closeMenu}
        />
      )}
      {movingTask && (
        <MoveToDialog
          itemTitle={movingTask.name}
          targets={[
            { id: null, title: t("gantt.noGroup"), depth: 0 },
            ...value.groups.map((group) => ({ id: group.id, title: group.name, depth: 0 })),
          ]}
          current={movingTask.groupId}
          onMove={(groupId) => {
            setMoving(null);
            moveTaskTo(movingTask.id, { groupId, index: Number.MAX_SAFE_INTEGER });
          }}
          onClose={() => {
            setMoving(null);
            focusRow(taskKey(movingTask.id));
          }}
        />
      )}
      {dialogTask && (
        <TaskDialog
          gantt={value}
          task={dialogTask}
          onSave={(next) => {
            setDialog(null);
            onChange(unfolded(next, taskOf(dialogTask.id, next)?.groupId ?? null));
            focusRow(taskKey(dialogTask.id));
          }}
          onClose={() => {
            setDialog(null);
            focusRow(taskKey(dialogTask.id));
          }}
        />
      )}
    </div>
  );
}

const NONE: readonly string[] = [];
