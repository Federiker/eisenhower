import { daysInMonth } from "../common/days";
import { characterCount, MAX_SUMMARY_LENGTH } from "../common/text";
import { EARLIEST_TIMELINE_YEAR, LATEST_TIMELINE_YEAR, writtenYear } from "./date";
import {
  compareTimelinePoints,
  MAX_ENTRY_TITLE_LENGTH,
  type Timeline,
  type TimelineEntry,
  type TimelinePoint,
} from "./timeline";

/** A date as typed in an entry's form: the written year and its era, the month and the day ("" for none). */
export type DateDraft = { year: string; bce: boolean; month: string; day: string; approximate: boolean };

/** A point as chosen in the form: a step, or a date being typed. */
export type PointDraft = { step: string } | DateDraft;

/** An entry as its form holds it, before it is checked ({@link entryFromDraft}). */
export type EntryDraft = {
  title: string;
  categoryId: string;
  start: PointDraft;
  span: boolean;
  end: PointDraft;
  summary: string;
};

/** Why an entry as typed cannot be saved yet. */
export type EntryProblem =
  | "titleBlank"
  | "titleTooLong"
  | "summaryTooLong"
  | "category"
  | "step"
  | "year"
  | "day"
  | "order";

/** Where a new entry starts when it is begun from the drawing: a lane and a point on it. */
export type EntryPreset = { categoryId: string; start: TimelinePoint };

const blankDate: DateDraft = { year: "", bce: false, month: "", day: "", approximate: false };

function pointDraft(point: TimelinePoint): PointDraft {
  if ("step" in point) return { step: point.step };
  const { year, bce } = writtenYear(point.year);
  return {
    year: String(year),
    bce,
    month: point.month === null ? "" : String(point.month),
    day: point.day === null ? "" : String(point.day),
    approximate: point.approximate,
  };
}

/** The form's starting values for an entry. */
export function draftOf(entry: TimelineEntry): EntryDraft {
  const start = pointDraft(entry.start);
  return {
    title: entry.title,
    categoryId: entry.categoryId,
    start,
    span: entry.end !== null,
    end: entry.end === null ? start : pointDraft(entry.end),
    summary: entry.summary,
  };
}

/**
 * The form's starting values for a new entry: where it was begun on the drawing, or else the first
 * category, at the first step or with no date yet.
 */
export function newDraft(timeline: Timeline, preset: EntryPreset | null = null): EntryDraft {
  const point: PointDraft = preset
    ? pointDraft(preset.start)
    : timeline.kind === "sequence"
      ? { step: timeline.steps[0]?.id ?? "" }
      : blankDate;
  return {
    title: "",
    categoryId: preset?.categoryId ?? timeline.categories[0]?.id ?? "",
    start: point,
    span: false,
    end: point,
    summary: "",
  };
}

function pointOf(draft: PointDraft, timeline: Timeline): TimelinePoint | EntryProblem {
  if ("step" in draft) return timeline.steps.some((step) => step.id === draft.step) ? { step: draft.step } : "step";
  if (!/^\d{1,6}$/.test(draft.year.trim()) || Number(draft.year) < 1) return "year";
  const year = draft.bce ? 1 - Number(draft.year) : Number(draft.year);
  if (year < EARLIEST_TIMELINE_YEAR || year > LATEST_TIMELINE_YEAR) return "year";
  const month = draft.month === "" ? null : Number(draft.month);
  const day = draft.day.trim() === "" ? null : Number(draft.day);
  if (day !== null && (month === null || !Number.isInteger(day) || day < 1 || day > daysInMonth(year, month)))
    return "day";
  return { year, month, day, approximate: draft.approximate };
}

/** The entry the form describes, or why it cannot be saved yet (every problem at once). */
export function entryFromDraft(
  draft: EntryDraft,
  id: string,
  timeline: Timeline,
): { entry: TimelineEntry } | { problems: EntryProblem[] } {
  const problems: EntryProblem[] = [];
  const title = draft.title.trim();
  if (title === "") problems.push("titleBlank");
  else if (characterCount(title) > MAX_ENTRY_TITLE_LENGTH) problems.push("titleTooLong");
  // A summary is one line: line breaks pasted into it become spaces.
  const summary = draft.summary.trim().replace(/[\r\n]+/g, " ");
  if (characterCount(summary) > MAX_SUMMARY_LENGTH) problems.push("summaryTooLong");
  if (!timeline.categories.some((category) => category.id === draft.categoryId)) problems.push("category");
  const start = pointOf(draft.start, timeline);
  const end = draft.span ? pointOf(draft.end, timeline) : null;
  for (const point of [start, end]) if (typeof point === "string" && !problems.includes(point)) problems.push(point);
  if (
    typeof start !== "string" &&
    end !== null &&
    typeof end !== "string" &&
    (compareTimelinePoints(start, end, timeline.steps) ?? 0) >= 0
  ) {
    problems.push("order");
  }
  if (problems.length > 0 || typeof start === "string" || typeof end === "string") return { problems };
  return { entry: { id, title, categoryId: draft.categoryId, start, end, summary } };
}
