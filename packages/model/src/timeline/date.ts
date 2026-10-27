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

/** Days from 1 January 1970 in the proleptic Gregorian calendar, astronomical years (Howard Hinnant's method). */
function dayCount(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  return (
    era * 146_097 + yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear - 719_468
  );
}

/** The day a {@link dayCount} falls on. */
function dayOfCount(count: number): { year: number; month: number; day: number } {
  const z = count + 719_468;
  const era = Math.floor(z / 146_097);
  const dayOfEra = z - era * 146_097;
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36_524) - Math.floor(dayOfEra / 146_096)) / 365,
  );
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const shifted = Math.floor((5 * dayOfYear + 2) / 153);
  const month = shifted + (shifted < 10 ? 3 : -9);
  return {
    year: yearOfEra + era * 400 + (month <= 2 ? 1 : 0),
    month,
    day: dayOfYear - Math.floor((153 * shifted + 2) / 5) + 1,
  };
}

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
    // Through day numbers, so a long drag across the years costs no more than a day's move.
    ({ year, month, day } = dayOfCount(dayCount(year, month, day) + by));
  }
  if (year < EARLIEST_TIMELINE_YEAR || year > LATEST_TIMELINE_YEAR) return null;
  if (month !== null && day !== null) day = Math.min(day, daysInMonth(year, month));
  return { year, month, day, approximate: date.approximate };
}
