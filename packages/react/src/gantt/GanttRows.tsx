// biome-ignore-all lint/a11y/useSemanticElements: a tree grid of divs, so that the name column and the header stay in place as the drawing scrolls, with layers behind and over the rows.
// biome-ignore-all lint/a11y/useFocusableInteractive: the focus is on the control in each row (a bar, a group's button), as a tree grid allows; rows and cells are not stops of their own.
import { addDays, type CalendarDay, daysBetween, type GanttGroup, type GanttTask } from "@eisenhower/model";
import {
  type KeyboardEvent,
  memo,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  useState,
} from "react";

import { ColourSwatch } from "../controls/ColourSwatch";
import { InlineRename } from "../controls/InlineRename";
import { isMac } from "../keyboard/shortcuts";
import { useLocale, useTranslate } from "../strings/translate";
import { colourVar } from "../theme/palette";
import { describeTask, formatSpan } from "./format";
import { type Geometry, xOfDay } from "./scale";

/** How tall a row is drawn, in pixels (the stylesheet's `--eh-gantt-row` is the same). */
export const ROW_HEIGHT = 32;
/** How wide a milestone's diamond is drawn. */
export const DIAMOND = 16;

/** What a pointer drag does to a task: moves it, or one of its ends. */
export type DragMode = "move" | "start" | "end";

/**
 * What the rows ask of the chart, the same object for the whole life of the chart so that a row draws again
 * only when its own task, its focus or the scale changes (a few hundred rows stay smooth).
 */
export type RowBridge = {
  key: (event: KeyboardEvent<HTMLElement>, rowKey: string) => void;
  focused: (rowKey: string) => void;
  register: (rowKey: string, element: HTMLElement | null) => void;
  open: (id: string) => void;
  toggle: (id: string) => void;
  menu: (rowKey: string, event: MouseEvent<HTMLElement>) => void;
  drag: (id: string, mode: DragMode, days: number) => void;
  rename: (rowKey: string, name: string | null) => void;
  /** Opens a row's name for renaming in place (a double-click on it). */
  beginRename: (rowKey: string) => void;
  /** A link drag (Ctrl, or ⌘ on macOS, held as it starts): from a task, the pointer's place, the drop, a cancel. */
  linkStart: (id: string, x: number, y: number) => void;
  linkMove: (x: number, y: number) => void;
  linkEnd: () => void;
  linkCancel: () => void;
};

/** How a row takes part in a link drag: the task dragged from, the one under the pointer, or one that cannot depend on it. */
export type LinkRole = "source" | "target" | "refused";

/** The row element and its two cells: the name column and the drawing. */
function Row({
  rowKey,
  level,
  index,
  expanded,
  selected,
  kind,
  link,
  moving,
  name,
  drawing,
  onMenu,
}: {
  rowKey: string;
  level: number;
  index: number;
  expanded?: boolean;
  selected?: boolean;
  kind: "task" | "group";
  link?: LinkRole;
  /** Being dragged up or down the rows by its name. */
  moving?: boolean;
  name: ReactNode;
  drawing: ReactNode;
  onMenu: (event: MouseEvent<HTMLElement>) => void;
}) {
  return (
    <div
      role="row"
      className="eh-gantt-row"
      data-kind={kind}
      data-row-key={rowKey}
      data-link={link}
      data-moving={moving || undefined}
      aria-level={level}
      aria-rowindex={index + 2}
      aria-expanded={expanded}
      aria-selected={selected}
      onContextMenu={onMenu}
    >
      <div role="gridcell" className="eh-gantt-name" style={{ paddingInlineStart: 8 + (level - 1) * 16 }}>
        {name}
      </div>
      <div role="gridcell" className="eh-gantt-cell">
        {drawing}
      </div>
    </div>
  );
}

/**
 * A task's days as drawn while it is dragged: moved, or with one end moved, never past the other. With
 * `earliest` (Move dependent tasks), its start stops at that day once the drag moves at all.
 */
function draggedDays(
  task: GanttTask,
  mode: DragMode,
  days: number,
  earliest: CalendarDay | null = null,
): { start: CalendarDay; end: CalendarDay; by: number } {
  const length = daysBetween(task.start, task.end);
  let wanted = days;
  if (earliest !== null && mode !== "end" && days !== 0) wanted = Math.max(days, daysBetween(task.start, earliest));
  const by = mode === "start" ? Math.min(wanted, length) : mode === "end" ? Math.max(wanted, -length) : wanted;
  return {
    start: mode === "end" ? task.start : addDays(task.start, by),
    end: mode === "start" ? task.end : addDays(task.end, by),
    by,
  };
}

/** How far a drag moved, in whole days (rounded to the nearest), and so how many days it moves the task. */
export function dragDays(
  task: GanttTask,
  mode: DragMode,
  pixels: number,
  dayWidth: number,
  earliest: CalendarDay | null = null,
): number {
  return draggedDays(task, mode, Math.round(pixels / dayWidth), earliest).by;
}

type TaskRowProps = {
  task: GanttTask;
  index: number;
  level: number;
  geometry: Geometry;
  conflicts: readonly string[];
  tabbable: boolean;
  selected: boolean;
  renaming: boolean;
  readOnly: boolean;
  link?: LinkRole;
  moving?: boolean;
  /** The first day it may start on (Move dependent tasks), or null. */
  earliest?: CalendarDay | null;
  bridge: RowBridge;
};

/**
 * A task's row: its name (with a visible warning when it starts too early) and its bar, or a milestone's
 * diamond. The bar is the row's control: it takes the focus and the keys, is dragged to move the task and by
 * its ends to resize it (snapping to whole days, only this row drawing again until the drop), and opens on a
 * double click.
 */
export const TaskRow = memo(function TaskRow({
  task,
  index,
  level,
  geometry,
  conflicts,
  tabbable,
  selected,
  renaming,
  readOnly,
  link,
  moving,
  earliest = null,
  bridge,
}: TaskRowProps) {
  const t = useTranslate();
  const locale = useLocale();
  const rowKey = `task:${task.id}`;
  const [drag, setDrag] = useState<{ mode: DragMode; x: number; dx: number } | null>(null);
  const [linking, setLinking] = useState(false);
  const shown = drag ? draggedDays(task, drag.mode, Math.round(drag.dx / geometry.dayWidth), earliest) : task;
  const left = xOfDay(geometry, shown.start);
  const width = (daysBetween(shown.start, shown.end) + 1) * geometry.dayWidth;
  const label = describeTask(task, conflicts, t, locale);
  const late = conflicts.length > 0;

  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (readOnly || event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    // Ctrl (⌘ on macOS, where Ctrl+click is the context menu) links instead of moving.
    if (isMac() ? event.metaKey : event.ctrlKey) {
      event.preventDefault();
      setLinking(true);
      bridge.linkStart(task.id, event.clientX, event.clientY);
      return;
    }
    const edge = (event.target as HTMLElement).dataset.edge;
    const mode: DragMode = !task.milestone && (edge === "start" || edge === "end") ? edge : "move";
    setDrag({ mode, x: event.clientX, dx: 0 });
  }

  function pointerUp() {
    if (linking) {
      setLinking(false);
      bridge.linkEnd();
      return;
    }
    if (!drag) return;
    setDrag(null);
    const days = dragDays(task, drag.mode, drag.dx, geometry.dayWidth, earliest);
    if (days !== 0) bridge.drag(task.id, drag.mode, days);
  }

  const style = {
    "--eh-gantt-bar": task.colour === null ? "var(--eh-accent)" : colourVar(task.colour),
    left: task.milestone ? left + geometry.dayWidth / 2 - DIAMOND / 2 : left,
    width: task.milestone ? DIAMOND : width,
  } as const;

  return (
    <Row
      kind="task"
      rowKey={rowKey}
      level={level}
      index={index}
      selected={selected || undefined}
      link={link}
      moving={moving}
      onMenu={(event) => bridge.menu(rowKey, event)}
      name={
        renaming ? (
          <InlineRename
            title={task.name}
            label={t("gantt.renameTask", { name: task.name })}
            onRename={(name) => bridge.rename(rowKey, name)}
            onCancel={() => bridge.rename(rowKey, null)}
          />
        ) : (
          <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: a pointer shortcut for F2, the row's rename key. */}
            <span className="eh-gantt-task-name" title={task.name} onDoubleClick={() => bridge.beginRename(rowKey)}>
              {task.name}
            </span>
            {late && <span className="eh-gantt-badge">{t("gantt.conflictBadge")}</span>}
          </>
        )
      }
      drawing={
        <button
          type="button"
          className={task.milestone ? "eh-gantt-milestone" : "eh-gantt-bar"}
          data-late={late || undefined}
          data-dragging={drag ? drag.mode : undefined}
          aria-label={label}
          title={drag ? formatSpan(shown.start, shown.end, t, locale) : label}
          tabIndex={tabbable ? 0 : -1}
          style={style}
          ref={(element) => bridge.register(rowKey, element)}
          onFocus={() => bridge.focused(rowKey)}
          onKeyDown={(event) => {
            if ((drag || linking) && event.key === "Escape") {
              event.preventDefault();
              setDrag(null);
              if (linking) {
                setLinking(false);
                bridge.linkCancel();
              }
              return;
            }
            bridge.key(event, rowKey);
          }}
          onDoubleClick={() => bridge.open(task.id)}
          onPointerDown={pointerDown}
          onPointerMove={(event) => {
            if (linking) bridge.linkMove(event.clientX, event.clientY);
            else if (drag) setDrag({ ...drag, dx: event.clientX - drag.x });
          }}
          onPointerUp={pointerUp}
          onPointerCancel={() => {
            setDrag(null);
            if (linking) {
              setLinking(false);
              bridge.linkCancel();
            }
          }}
        >
          {!task.milestone && <span className="eh-gantt-progress" style={{ width: `${task.progress}%` }} />}
          {!task.milestone && !readOnly && <span className="eh-gantt-handle" data-edge="start" />}
          {!task.milestone && !readOnly && <span className="eh-gantt-handle" data-edge="end" />}
          {late && <span className="eh-gantt-flag">!</span>}
        </button>
      }
    />
  );
});

type GroupRowProps = {
  group: GanttGroup;
  span: { start: CalendarDay; end: CalendarDay } | null;
  count: number;
  collapsed: boolean;
  index: number;
  geometry: Geometry;
  tabbable: boolean;
  renaming: boolean;
  link?: LinkRole;
  moving?: boolean;
  bridge: RowBridge;
};

/**
 * A group's summary row: a button that folds and unfolds the group (the row's control, named with the group,
 * its tasks and its days) and a summary bar from its first task's start to its last task's end.
 */
export const GroupRow = memo(function GroupRow({
  group,
  span,
  count,
  collapsed,
  index,
  geometry,
  tabbable,
  renaming,
  link,
  moving,
  bridge,
}: GroupRowProps) {
  const t = useTranslate();
  const locale = useLocale();
  const rowKey = `group:${group.id}`;
  const label = span
    ? t("gantt.groupSummaryDates", { name: group.name, count, dates: formatSpan(span.start, span.end, t, locale) })
    : t("gantt.groupSummary", { name: group.name, count });
  const toggle: Ref<HTMLButtonElement> = (element) => bridge.register(rowKey, element);
  return (
    <Row
      kind="group"
      rowKey={rowKey}
      link={link}
      moving={moving}
      level={1}
      index={index}
      expanded={!collapsed}
      onMenu={(event) => bridge.menu(rowKey, event)}
      name={
        <>
          <button
            type="button"
            className="eh-gantt-toggle"
            aria-label={label}
            aria-expanded={!collapsed}
            title={t(collapsed ? "gantt.expand" : "gantt.collapse", { name: group.name })}
            tabIndex={tabbable ? 0 : -1}
            ref={toggle}
            onFocus={() => bridge.focused(rowKey)}
            onClick={(event) => {
              // A pointer folds the group by its chevron only (its name renames on a double-click); a key on the
              // button (no pointer detail) folds it from anywhere.
              const chevron = (event.target as HTMLElement).closest(".eh-gantt-chevron");
              if (chevron || event.detail === 0) bridge.toggle(group.id);
            }}
            onDoubleClick={(event) => {
              if (!(event.target as HTMLElement).closest(".eh-gantt-chevron")) bridge.beginRename(rowKey);
            }}
            onKeyDown={(event) => bridge.key(event, rowKey)}
          >
            <span className="eh-gantt-chevron" aria-hidden="true">
              {collapsed ? "▸" : "▾"}
            </span>
            {group.colour != null && <ColourSwatch colour={group.colour} className="eh-gantt-group-swatch" />}
            {!renaming && <span className="eh-gantt-group-name">{group.name}</span>}
          </button>
          {renaming && (
            <InlineRename
              title={group.name}
              label={t("gantt.renameGroup", { name: group.name })}
              onRename={(name) => bridge.rename(rowKey, name)}
              onCancel={() => bridge.rename(rowKey, null)}
            />
          )}
        </>
      }
      drawing={
        span && (
          <span
            className="eh-gantt-summary"
            style={
              {
                left: xOfDay(geometry, span.start),
                width: (daysBetween(span.start, span.end) + 1) * geometry.dayWidth,
                ...(group.colour != null && { "--eh-gantt-summary": colourVar(group.colour) }),
              } as object
            }
          />
        )
      }
    />
  );
});
