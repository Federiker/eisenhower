import {
  addMonths,
  type CalendarDay,
  dayNumber,
  dayOfNumber,
  type Gantt,
  isoWeekday,
  startOfMonth,
  startOfWeek,
} from "@eisenhower/model";

/** How finely the chart draws time: a column a day, a week or a month. */
export type GanttScale = "day" | "week" | "month";

/** The scales from the finest to the coarsest: zooming in goes left, out goes right. */
export const SCALES: readonly GanttScale[] = ["day", "week", "month"];

/** How wide a day is drawn on each scale, in pixels. */
export const DAY_WIDTH: Readonly<Record<GanttScale, number>> = { day: 32, week: 12, month: 4 };

/** The days left empty before the first task and after the last (or around today), on each scale. */
const PADDING: Readonly<Record<GanttScale, number>> = { day: 7, week: 14, month: 31 };

/** How far Alt and an arrow move a task, or its end, on each scale (decided for the gantt chart; see its doc). */
export const KEY_STEP: Readonly<Record<GanttScale, number>> = { day: 1, week: 7, month: 7 };

/**
 * The days the chart draws: from `first` (a day number) for `days` days, on a scale `dayWidth` pixels a day.
 * The range holds every task and today, with some room either side, and starts and ends on whole units of
 * the scale (a Monday, the first of a month).
 */
export type Geometry = { scale: GanttScale; first: number; days: number; dayWidth: number; width: number };

/** The finer or coarser scale, or the same one at the end of the list. */
export function zoomed(scale: GanttScale, by: -1 | 1): GanttScale {
  const index = SCALES.indexOf(scale) + by;
  return SCALES[Math.max(0, Math.min(SCALES.length - 1, index))]!;
}

/** The start of the unit (week or month) a day is in, on a scale. */
function unitStart(scale: GanttScale, day: CalendarDay): CalendarDay {
  if (scale === "week") return startOfWeek(day);
  if (scale === "month") return startOfMonth(day);
  return day;
}

/** The first day after the unit a day is in. */
function unitEnd(scale: GanttScale, day: CalendarDay): CalendarDay {
  if (scale === "week") return dayOfNumber(dayNumber(startOfWeek(day)) + 7);
  if (scale === "month") return addMonths(day, 1);
  return dayOfNumber(dayNumber(day) + 1);
}

export function geometryOf(gantt: Gantt, scale: GanttScale, today: CalendarDay): Geometry {
  let low = dayNumber(today);
  let high = low;
  for (const task of gantt.tasks) {
    low = Math.min(low, dayNumber(task.start));
    high = Math.max(high, dayNumber(task.end));
  }
  const first = dayNumber(unitStart(scale, dayOfNumber(low - PADDING[scale])));
  const after = dayNumber(unitEnd(scale, dayOfNumber(high + PADDING[scale])));
  const dayWidth = DAY_WIDTH[scale];
  return { scale, first, days: after - first, dayWidth, width: (after - first) * dayWidth };
}

/** Where a day's column starts, in pixels from the start of the drawing. */
export function xOfDay(geometry: Geometry, day: CalendarDay): number {
  return (dayNumber(day) - geometry.first) * geometry.dayWidth;
}

/** A label of the header: where it starts, how wide it is and the day it stands for. */
export type HeaderCell = { x: number; width: number; day: CalendarDay };

/**
 * The header's two lines: the larger units above (months on the day and week scales, years on the month
 * scale) and the scale's own units below (days, weeks from Monday, months), each cut to the drawn range.
 */
export function headerOf(geometry: Geometry): { upper: HeaderCell[]; lower: HeaderCell[] } {
  const end = geometry.first + geometry.days;
  const cells = (next: (day: CalendarDay) => CalendarDay, start: CalendarDay) => {
    const list: HeaderCell[] = [];
    for (let day = start; dayNumber(day) < end; day = next(day)) {
      const from = Math.max(dayNumber(day), geometry.first);
      const to = Math.min(dayNumber(next(day)), end);
      list.push({ x: (from - geometry.first) * geometry.dayWidth, width: (to - from) * geometry.dayWidth, day });
    }
    return list;
  };
  const first = dayOfNumber(geometry.first);
  const nextDay = (day: CalendarDay) => dayOfNumber(dayNumber(day) + 1);
  const nextWeek = (day: CalendarDay) => dayOfNumber(dayNumber(day) + 7);
  const nextMonth = (day: CalendarDay) => addMonths(day, 1);
  const nextYear = (day: CalendarDay) => addMonths(day, 12);
  if (geometry.scale === "month") {
    return { upper: cells(nextYear, `${first.slice(0, 4)}-01-01`), lower: cells(nextMonth, startOfMonth(first)) };
  }
  return {
    upper: cells(nextMonth, startOfMonth(first)),
    lower: geometry.scale === "week" ? cells(nextWeek, startOfWeek(first)) : cells(nextDay, first),
  };
}

/** The weekends of the drawn range (Saturday and Sunday as one stretch), for the day scale's shading. */
export function weekendsOf(geometry: Geometry): HeaderCell[] {
  const list: HeaderCell[] = [];
  const firstDay = dayOfNumber(geometry.first);
  // The Saturday on or before the first day, then every week.
  let saturday = geometry.first - ((isoWeekday(firstDay) + 1) % 7);
  for (; saturday < geometry.first + geometry.days; saturday += 7) {
    const from = Math.max(saturday, geometry.first);
    const to = Math.min(saturday + 2, geometry.first + geometry.days);
    if (to > from) {
      list.push({
        x: (from - geometry.first) * geometry.dayWidth,
        width: (to - from) * geometry.dayWidth,
        day: dayOfNumber(from),
      });
    }
  }
  return list;
}
