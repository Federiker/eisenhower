import {
  type Timeline,
  type TimelineDate,
  type TimelineEntry,
  type TimelinePoint,
  writtenYear,
} from "@eisenhower/model";

import type { Translate } from "../strings/translate";

/** What dates are written with: the view's messages and its locale (`Intl`). */
export type DateWords = { t: Translate; locale: string };

/** The months' names in a locale, January first (`Intl`, in UTC so that no month is a day off). */
export function monthNames(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, month) => format.format(new Date(Date.UTC(2000, month, 15))));
}

const months = new Map<string, string[]>();

/** A month's name (1 is January), kept per locale. */
export function monthName(month: number, locale: string): string {
  let names = months.get(locale);
  if (!names) {
    names = monthNames(locale);
    months.set(locale, names);
  }
  return names[month - 1] ?? String(month);
}

/** A year's figures, grouped in thousands only from 10 000 on (1066, but 12,000). */
function figures(year: number, locale: string): string {
  return year >= 10_000 ? new Intl.NumberFormat(locale).format(year) : String(year);
}

/** Whether a Dates timeline has a date before the common era, so CE is written beside the others. */
export function hasBce(timeline: Timeline): boolean {
  const before = (point: TimelinePoint | null) => point !== null && "year" in point && point.year <= 0;
  return timeline.entries.some((entry) => before(entry.start) || before(entry.end));
}

/**
 * A date as the messages order it: "c. 14 October 1066", "March 1066", "400 BCE"; CE only when asked for
 * (beside BCE dates). Month names come from `Intl` in the locale.
 */
export function formatDate(date: TimelineDate, showCe: boolean, { t, locale }: DateWords): string {
  const { year, bce } = writtenYear(date.year);
  const written = figures(year, locale);
  const yearText = bce
    ? t("timeline.date.yearBce", { year: written })
    : showCe
      ? t("timeline.date.yearCe", { year: written })
      : written;
  const month = date.month === null ? null : monthName(date.month, locale);
  // A day always has a month (the model requires it).
  const text =
    month === null
      ? yearText
      : date.day === null
        ? t("timeline.date.monthYear", { month, year: yearText })
        : t("timeline.date.dayMonthYear", { day: String(date.day), month, year: yearText });
  return date.approximate ? t("timeline.date.circa", { date: text }) : text;
}

/** A point as shown: a step's name, or a date. */
export function formatPoint(point: TimelinePoint, timeline: Timeline, showCe: boolean, words: DateWords): string {
  if ("step" in point) return timeline.steps.find((step) => step.id === point.step)?.name ?? "";
  return formatDate(point, showCe, words);
}

/** When an entry is: its point, or the two ends of its span. */
export function formatWhen(entry: TimelineEntry, timeline: Timeline, showCe: boolean, words: DateWords): string {
  const start = formatPoint(entry.start, timeline, showCe, words);
  return entry.end === null
    ? start
    : words.t("timeline.date.range", { start, end: formatPoint(entry.end, timeline, showCe, words) });
}
