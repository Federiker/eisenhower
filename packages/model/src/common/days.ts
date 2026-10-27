import { z } from "zod";

/**
 * A calendar day as ISO 8601 writes it, `YYYY-MM-DD`, in the proleptic Gregorian calendar, years 0001 to 9999:
 * the gantt chart's and the todo list's dates (decisions 17 and 18). A day has no time and no time zone, so it
 * is the same day wherever the document is opened.
 */
export type CalendarDay = string;

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

const remainder = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;

/** Whether a year has 29 February (astronomical years, so 1 BCE is a leap year). */
export function isLeapYear(year: number): boolean {
  return remainder(year, 4) === 0 && (remainder(year, 100) !== 0 || remainder(year, 400) === 0);
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** The year, month (1–12) and day of a calendar day, or null when it is not one. */
export function dayParts(day: string): { year: number; month: number; day: number } | null {
  const match = DAY.exec(day);
  if (!match) return null;
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1 || month < 1 || month > 12 || date < 1 || date > daysInMonth(year, month)) return null;
  return { year, month, day: date };
}

export function isCalendarDay(day: string): boolean {
  return dayParts(day) !== null;
}

export const calendarDaySchema = z.string().refine(isCalendarDay, "A day is written YYYY-MM-DD.");

/** The day's number counted from 1 January 1970 (negative before), for arithmetic. */
export function dayNumber(day: CalendarDay): number {
  const parts = dayParts(day);
  if (!parts) throw new RangeError(`Not a calendar day: ${day}`);
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  return Math.round(date.getTime() / MS_PER_DAY);
}

/** The calendar day of a day number ({@link dayNumber}). */
export function dayOfNumber(number: number): CalendarDay {
  const date = new Date(number * MS_PER_DAY);
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(day: CalendarDay, days: number): CalendarDay {
  return dayOfNumber(dayNumber(day) + days);
}

/** How many days from `from` to `to`: 0 for the same day, negative when `to` is earlier. */
export function daysBetween(from: CalendarDay, to: CalendarDay): number {
  return dayNumber(to) - dayNumber(from);
}

/** Calendar order; `YYYY-MM-DD` also sorts as text, but this says so. */
export function compareDays(first: CalendarDay, second: CalendarDay): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

/** The day of the week, ISO 8601's way: 1 for Monday to 7 for Sunday. */
export function isoWeekday(day: CalendarDay): number {
  // 1 January 1970 was a Thursday.
  return remainder(dayNumber(day) + 3, 7) + 1;
}

/** The Monday of the day's ISO week. */
export function startOfWeek(day: CalendarDay): CalendarDay {
  return addDays(day, 1 - isoWeekday(day));
}

/** The first of the day's month. */
export function startOfMonth(day: CalendarDay): CalendarDay {
  return `${day.slice(0, 8)}01`;
}

/** The first of the month `months` after the day's (before, when negative). */
export function addMonths(day: CalendarDay, months: number): CalendarDay {
  const parts = dayParts(day);
  if (!parts) throw new RangeError(`Not a calendar day: ${day}`);
  const index = parts.year * 12 + parts.month - 1 + months;
  const year = Math.floor(index / 12);
  const month = remainder(index, 12) + 1;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
}

/** Today where the user is (their clock's local date), or the local date of `now`. */
export function today(now: Date = new Date()): CalendarDay {
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** The day as a `Date` at noon UTC, for `Intl.DateTimeFormat` with `timeZone: "UTC"` (never a day off). */
export function dayAsDate(day: CalendarDay): Date {
  return new Date(dayNumber(day) * MS_PER_DAY + MS_PER_DAY / 2);
}
