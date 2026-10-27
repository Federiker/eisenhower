import {
  type CalendarDay,
  type DependencyConflict,
  dayNumber,
  type GanttRow,
  type GanttTask,
  isoWeekday,
} from "@eisenhower/model";
import { memo, useId } from "react";

import { useLocale, useTranslate } from "../strings/translate";
import { formatDay } from "./format";
import { DIAMOND, ROW_HEIGHT } from "./GanttRows";
import { type Geometry, headerOf, weekendsOf, xOfDay } from "./scale";

/**
 * The dates above the drawing, in the locale: months over days (each day's number and weekday), months over
 * weeks (each Monday's day), or years over months. Hidden from screen readers, which hear the column's name
 * with its first and last day instead, and each bar's own days.
 */
export const GanttHeader = memo(function GanttHeader({ geometry, today }: { geometry: Geometry; today: CalendarDay }) {
  const t = useTranslate();
  const locale = useLocale();
  const { upper, lower } = headerOf(geometry);
  const todayX = dayNumber(today) - geometry.first;
  return (
    <div className="eh-gantt-header" aria-hidden="true" style={{ width: geometry.width }}>
      {upper.map((cell) => (
        <span key={cell.day} className="eh-gantt-header-upper" style={{ left: cell.x, width: cell.width }}>
          {formatDay(cell.day, locale, geometry.scale === "month" ? "year" : "monthYear")}
        </span>
      ))}
      {lower.map((cell) => (
        <span
          key={cell.day}
          className="eh-gantt-header-lower"
          data-weekend={geometry.scale === "day" && isoWeekday(cell.day) >= 6 ? true : undefined}
          style={{ left: cell.x, width: cell.width }}
        >
          {geometry.scale === "day" ? (
            <>
              <span>{formatDay(cell.day, locale, "weekday")}</span> {formatDay(cell.day, locale, "day")}
            </>
          ) : geometry.scale === "week" ? (
            formatDay(cell.day, locale, "short")
          ) : (
            formatDay(cell.day, locale, "month")
          )}
        </span>
      ))}
      {todayX >= 0 && todayX < geometry.days && (
        <span className="eh-gantt-header-today" style={{ left: (todayX + 0.5) * geometry.dayWidth }}>
          {t("gantt.today")}
        </span>
      )}
    </div>
  );
});

/** Behind the rows: the weekends shaded on the day scale, and today's line. */
export const GanttBackdrop = memo(function GanttBackdrop({
  geometry,
  today,
  height,
}: {
  geometry: Geometry;
  today: CalendarDay;
  height: number;
}) {
  const todayX = dayNumber(today) - geometry.first;
  return (
    <div className="eh-gantt-backdrop" aria-hidden="true" style={{ width: geometry.width, height }}>
      {geometry.scale === "day" &&
        weekendsOf(geometry).map((weekend) => (
          <span key={weekend.day} className="eh-gantt-weekend" style={{ left: weekend.x, width: weekend.width }} />
        ))}
      {todayX >= 0 && todayX < geometry.days && (
        <span className="eh-gantt-today" style={{ left: (todayX + 0.5) * geometry.dayWidth }} />
      )}
    </div>
  );
});

/** Where a task's bar begins and ends across the drawing, a milestone's diamond being narrower than its day. */
function barEnds(task: GanttTask, geometry: Geometry): { from: number; to: number } {
  const left = xOfDay(geometry, task.start);
  if (task.milestone) {
    const middle = left + geometry.dayWidth / 2;
    return { from: middle - DIAMOND / 2, to: middle + DIAMOND / 2 };
  }
  return { from: left, to: xOfDay(geometry, task.end) + geometry.dayWidth };
}

/**
 * An arrow's line from the end of a predecessor to the start of the task after it: out to the right, down (or
 * up) to the task's row and in from the left; when the task starts before the predecessor ends, it turns back
 * between the rows.
 */
export function arrowPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const gap = 8;
  if (to.x - gap >= from.x + gap) {
    const turn = from.x + gap;
    return `M ${from.x} ${from.y} H ${turn} V ${to.y} H ${to.x}`;
  }
  const between = to.y + (to.y > from.y ? -ROW_HEIGHT / 2 : ROW_HEIGHT / 2);
  return `M ${from.x} ${from.y} H ${from.x + gap} V ${between} H ${to.x - gap} V ${to.y} H ${to.x}`;
}

/**
 * The finish-to-start dependencies as arrows over the rows, from a predecessor's end to its task's start; one
 * in a collapsed group goes from or to the group's summary row. A broken one (the task starts too early) is
 * drawn dashed in the warning colour; the bars and names say so in words.
 */
export const GanttArrows = memo(function GanttArrows({
  rows,
  tasks,
  conflicts,
  geometry,
}: {
  rows: readonly GanttRow[];
  tasks: readonly GanttTask[];
  conflicts: readonly DependencyConflict[];
  geometry: Geometry;
}) {
  const id = useId();
  const marker = `${id}-arrow`;
  const late = `${id}-late`;
  const rowOf = new Map<string, number>();
  rows.forEach((row, index) => {
    rowOf.set(row.kind === "group" ? `group:${row.group.id}` : row.task.id, index);
  });
  const placeOf = (task: GanttTask) =>
    rowOf.get(task.id) ?? (task.groupId ? rowOf.get(`group:${task.groupId}`) : undefined);
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const broken = new Set(conflicts.map((conflict) => `${conflict.predecessorId}>${conflict.taskId}`));
  const arrows = tasks.flatMap((task) =>
    task.dependsOn.flatMap((predecessorId) => {
      const predecessor = byId.get(predecessorId);
      const to = placeOf(task);
      const from = predecessor && placeOf(predecessor);
      if (!predecessor || to === undefined || from === undefined || from === to) return [];
      const y = (row: number) => row * ROW_HEIGHT + ROW_HEIGHT / 2;
      // A task hidden in a collapsed group is drawn on its group's summary, which spans its days.
      return [
        {
          key: `${predecessorId}>${task.id}`,
          d: arrowPath(
            { x: barEnds(predecessor, geometry).to, y: y(from) },
            { x: barEnds(task, geometry).from, y: y(to) },
          ),
          broken: broken.has(`${predecessorId}>${task.id}`),
        },
      ];
    }),
  );
  return (
    <svg
      className="eh-gantt-arrows"
      aria-hidden="true"
      width={geometry.width}
      height={rows.length * ROW_HEIGHT}
      data-count={arrows.length}
    >
      <defs>
        <marker id={marker} viewBox="0 0 8 8" refX="8" refY="4" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" className="eh-gantt-arrowhead" />
        </marker>
        <marker id={late} viewBox="0 0 8 8" refX="8" refY="4" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" className="eh-gantt-arrowhead" data-late="true" />
        </marker>
      </defs>
      {arrows.map((arrow) => (
        <path
          key={arrow.key}
          className="eh-gantt-arrow"
          data-late={arrow.broken || undefined}
          d={arrow.d}
          markerEnd={`url(#${arrow.broken ? late : marker})`}
        />
      ))}
    </svg>
  );
});
