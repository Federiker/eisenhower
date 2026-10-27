import { type CalendarDay, dayAsDate, daysBetween, type GanttTask } from "@eisenhower/model";

import type { Translate } from "../strings/translate";

type DayStyle = "full" | "short" | "day" | "weekday" | "month" | "monthYear" | "year";

const OPTIONS: Readonly<Record<DayStyle, Intl.DateTimeFormatOptions>> = {
  full: { day: "numeric", month: "short", year: "numeric" },
  short: { day: "numeric", month: "short" },
  day: { day: "numeric" },
  weekday: { weekday: "narrow" },
  month: { month: "short" },
  monthYear: { month: "long", year: "numeric" },
  year: { year: "numeric" },
};

const formatters = new Map<string, Intl.DateTimeFormat>();

/** A calendar day written in the locale (`Intl`, in UTC so it is never a day off), in one of the chart's styles. */
export function formatDay(day: CalendarDay, locale: string, style: DayStyle = "full"): string {
  const key = `${locale}\n${style}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { ...OPTIONS[style], timeZone: "UTC" });
    formatters.set(key, formatter);
  }
  return formatter.format(dayAsDate(day));
}

/** A task's days in words: "3 Nov 2026 to 7 Nov 2026" (one day when it starts and ends the same day). */
export function formatSpan(start: CalendarDay, end: CalendarDay, t: Translate, locale: string): string {
  if (start === end) return formatDay(start, locale);
  return t("gantt.span", { start: formatDay(start, locale), end: formatDay(end, locale) });
}

/** How many days a task lasts, its last day included: "5 days". */
export function formatLength(task: Pick<GanttTask, "start" | "end">, t: Translate): string {
  return t("gantt.days", { count: daysBetween(task.start, task.end) + 1 });
}

/**
 * What a task's bar is called for a screen reader: its name, days, length and progress ("Frame, 9 Nov 2026 to
 * 13 Nov 2026, 5 days, 40% done"), or a milestone's day; then the tasks it starts too early for, by name.
 */
export function describeTask(task: GanttTask, conflictsWith: readonly string[], t: Translate, locale: string): string {
  const name = task.milestone
    ? t("gantt.milestoneName", { name: task.name, day: formatDay(task.start, locale) })
    : t("gantt.taskName", {
        name: task.name,
        dates: formatSpan(task.start, task.end, t, locale),
        length: formatLength(task, t),
        progress: task.progress,
      });
  if (conflictsWith.length === 0) return name;
  return t("gantt.conflicts", {
    name,
    conflicts: conflictsWith.map((other) => t("gantt.conflict", { name: other })).join("; "),
  });
}
