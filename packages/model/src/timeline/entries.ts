import { type EditResult, refused } from "../common/result";
import { type DatePrecision, precisionOfDate, shiftDate, type TimelineDate } from "./date";
import { checkedTimeline } from "./edit";
import {
  compareTimelinePoints,
  MAX_TIMELINE_ENTRIES,
  type Timeline,
  type TimelineEntry,
  type TimelinePoint,
} from "./timeline";

/** Adds the entry, or replaces the one with its id. */
export function putEntry(timeline: Timeline, entry: TimelineEntry): EditResult<Timeline> {
  const exists = timeline.entries.some((old) => old.id === entry.id);
  if (!exists && timeline.entries.length >= MAX_TIMELINE_ENTRIES) return refused("limit");
  const entries = exists
    ? timeline.entries.map((old) => (old.id === entry.id ? entry : old))
    : [...timeline.entries, entry];
  return checkedTimeline({ ...timeline, entries });
}

export function deleteEntry(timeline: Timeline, id: string): EditResult<Timeline> {
  if (!timeline.entries.some((entry) => entry.id === id)) return refused("missing");
  return checkedTimeline({ ...timeline, entries: timeline.entries.filter((entry) => entry.id !== id) });
}

/**
 * The entries in time order: by start, a point before a span starting there, then shorter spans, then lane
 * order, then title.
 */
export function sortedEntries(timeline: Timeline): TimelineEntry[] {
  const lane = new Map(timeline.categories.map((category, index) => [category.id, index]));
  const compare = (a: TimelinePoint, b: TimelinePoint) => compareTimelinePoints(a, b, timeline.steps) ?? 0;
  return [...timeline.entries].sort(
    (a, b) =>
      compare(a.start, b.start) ||
      (a.end === null ? (b.end === null ? 0 : -1) : b.end === null ? 1 : compare(a.end, b.end)) ||
      (lane.get(a.categoryId) ?? 0) - (lane.get(b.categoryId) ?? 0) ||
      a.title.localeCompare(b.title),
  );
}

/**
 * Moves an entry to the category (lane) `by` places after its own (before, when negative): Alt+↑ and
 * Alt+↓ on the drawing. Refused (`limit`) past the first or last lane.
 */
export function moveEntryToLane(timeline: Timeline, id: string, by: number): EditResult<Timeline> {
  const entry = timeline.entries.find((each) => each.id === id);
  if (!entry) return refused("missing");
  const index = timeline.categories.findIndex((category) => category.id === entry.categoryId);
  const target = timeline.categories[index + by];
  if (index < 0 || !target) return refused("limit");
  return putEntry(timeline, { ...entry, categoryId: target.id });
}

const COARSE: readonly DatePrecision[] = ["year", "month", "day"];

/** The unit an entry moves by in a Dates timeline: the coarsest precision of its dates (a year, a month or a day). */
export function shiftUnit(entry: TimelineEntry): DatePrecision {
  const dates = [entry.start, entry.end].filter((point): point is TimelineDate => point !== null && "year" in point);
  return COARSE[Math.min(...dates.map((date) => COARSE.indexOf(precisionOfDate(date))))] ?? "year";
}

/**
 * Moves an entry `by` steps later (earlier, when negative) in a Sequence, or by `by` of its {@link shiftUnit}
 * in Dates, both ends of a span together: Alt+← and Alt+→ on the drawing. Refused (`limit`) past the first or
 * last step, or the years a timeline holds.
 */
export function shiftEntry(timeline: Timeline, id: string, by: number): EditResult<Timeline> {
  const entry = timeline.entries.find((each) => each.id === id);
  if (!entry) return refused("missing");
  const unit = shiftUnit(entry);
  const shift = (point: TimelinePoint): TimelinePoint | null => {
    if ("step" in point) {
      const index = timeline.steps.findIndex((step) => step.id === point.step);
      const step = index < 0 ? undefined : timeline.steps[index + by];
      return step ? { step: step.id } : null;
    }
    return shiftDate(point, unit, by);
  };
  const start = shift(entry.start);
  const end = entry.end === null ? null : shift(entry.end);
  if (start === null || (entry.end !== null && end === null)) return refused("limit");
  return putEntry(timeline, { ...entry, start, end });
}
