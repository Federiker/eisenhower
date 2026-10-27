import { z } from "zod";

import { daysInMonth } from "../common/days";

/** 999 999 BCE, as an astronomical year (1 BCE is 0). */
export const EARLIEST_TIMELINE_YEAR = -999_998;
/** 999 999 CE. */
export const LATEST_TIMELINE_YEAR = 999_999;

/**
 * A date of a Dates timeline in the proleptic Gregorian calendar (as ISO 8601): an astronomical year
 * (1 BCE is 0, 2 BCE is −1), and optionally a month and (only with a month) a day. A year or a month
 * alone stands for the whole of it. `approximate` is shown as "c." (decision 16).
 */
export const timelineDateSchema = z
  .object({
    year: z.number().int().min(EARLIEST_TIMELINE_YEAR).max(LATEST_TIMELINE_YEAR),
    month: z.number().int().min(1).max(12).nullable(),
    day: z.number().int().min(1).max(31).nullable(),
    approximate: z.boolean(),
  })
  .strict()
  .refine(
    (date) => date.day === null || (date.month !== null && date.day <= daysInMonth(date.year, date.month)),
    "A day needs a month and must be in it.",
  );

export type TimelineDate = z.infer<typeof timelineDateSchema>;

/**
 * The order of dates: by when they start, a whole year or month before the months and days within it
 * (1066, March 1066, 14 March 1066). Approximation does not change the order.
 */
export function compareTimelineDates(first: TimelineDate, second: TimelineDate): number {
  return first.year - second.year || (first.month ?? 0) - (second.month ?? 0) || (first.day ?? 0) - (second.day ?? 0);
}

/** A year as written, from an astronomical one: 1 BCE is 0, 2 BCE is −1. */
export function writtenYear(year: number): { year: number; bce: boolean } {
  return year <= 0 ? { year: 1 - year, bce: true } : { year, bce: false };
}

/** How precise a date is: a year, a month or a day. */
export type DatePrecision = "year" | "month" | "day";

export function precisionOfDate(date: TimelineDate): DatePrecision {
  return date.month === null ? "year" : date.day === null ? "month" : "day";
}

const remainder = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;

/**
 * The date `by` years, months or days later (earlier when negative), keeping its precision and whether
 * it is approximate; a day past the end of the new month comes back to its last day (31 January and a
 * month is 28 or 29 February). Null outside the years a timeline holds.
 */
export function shiftDate(date: TimelineDate, unit: DatePrecision, by: number): TimelineDate | null {
  let { year, month, day } = date;
  if (unit === "year") year += by;
  else if (unit === "month") {
    if (month === null) return null;
    const index = year * 12 + month - 1 + by;
    year = Math.floor(index / 12);
    month = remainder(index, 12) + 1;
  } else {
    if (month === null || day === null) return null;
    // Day by day through month ends; a timeline's moves are a day at a time, so this stays short.
    let left = by;
    while (left !== 0) {
      if (left > 0) {
        day += 1;
        if (day > daysInMonth(year, month)) {
          day = 1;
          month += 1;
          if (month > 12) {
            month = 1;
            year += 1;
          }
        }
        left -= 1;
      } else {
        day -= 1;
        if (day < 1) {
          month -= 1;
          if (month < 1) {
            month = 12;
            year -= 1;
          }
          day = daysInMonth(year, month);
        }
        left += 1;
      }
    }
  }
  if (year < EARLIEST_TIMELINE_YEAR || year > LATEST_TIMELINE_YEAR) return null;
  if (month !== null && day !== null) day = Math.min(day, daysInMonth(year, month));
  return { year, month, day, approximate: date.approximate };
}
