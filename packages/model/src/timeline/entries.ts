import { done, type EditResult, refused } from "../common/result";
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

/** A point `by` steps (a Sequence) or units of a date later, earlier when negative; null past the timeline. */
function shiftPoint(timeline: Timeline, point: TimelinePoint, unit: DatePrecision, by: number): TimelinePoint | null {
  if ("step" in point) {
    const index = timeline.steps.findIndex((step) => step.id === point.step);
    const step = index < 0 ? undefined : timeline.steps[index + by];
    return step ? { step: step.id } : null;
  }
  return shiftDate(point, unit, by);
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
  const start = shiftPoint(timeline, entry.start, unit, by);
  const end = entry.end === null ? null : shiftPoint(timeline, entry.end, unit, by);
  if (start === null || (entry.end !== null && end === null)) return refused("limit");
  return putEntry(timeline, { ...entry, start, end });
}

/** What a pointer drags of an entry: the whole of it, or one end of a span. */
export type EntryPart = "whole" | "start" | "end";

/**
 * A pointer's drag of an entry: the part dragged, how far (`by` steps in a Sequence, or `by` of the part's
 * {@link partUnit} in Dates, later when positive) and the category (lane) it is dropped in.
 */
export type EntryDrag = { part: EntryPart; by: number; categoryId: string };

/**
 * The unit a part of an entry moves by in a Dates timeline: the whole entry by its {@link shiftUnit}, as
 * Alt+← → move it; one end of a span by that date's own precision (a year, a month or a day).
 */
export function partUnit(entry: TimelineEntry, part: EntryPart): DatePrecision {
  const point = part === "end" ? entry.end : entry.start;
  return part === "whole" || point === null || !("year" in point) ? shiftUnit(entry) : precisionOfDate(point);
}

/**
 * The entry as a drag leaves it, for the drawing while it is dragged and for the drop: moved whole (a point,
 * or a span keeping its length), or with one end of a span moved, and in the drag's category. It goes as far
 * towards `by` as it can: to the first or last step, the years a timeline holds, or the last place before the
 * span's other end. Refused when the entry or the category is not there (`missing`), or for an end of an entry
 * at one point (`invalid`).
 */
export function draggedEntry(timeline: Timeline, id: string, drag: EntryDrag): EditResult<TimelineEntry> {
  const entry = timeline.entries.find((each) => each.id === id);
  if (!entry || !timeline.categories.some((category) => category.id === drag.categoryId)) return refused("missing");
  const { part } = drag;
  const end = entry.end;
  if (part !== "whole" && end === null) return refused("invalid");
  const unit = partUnit(entry, part);
  const before = (first: TimelinePoint, second: TimelinePoint) =>
    (compareTimelinePoints(first, second, timeline.steps) ?? 0) < 0;
  const moved = (by: number): TimelineEntry | null => {
    if (by === 0) return entry;
    if (part === "end") {
      const to = shiftPoint(timeline, end!, unit, by);
      return to && before(entry.start, to) ? { ...entry, end: to } : null;
    }
    const start = shiftPoint(timeline, entry.start, unit, by);
    if (part === "start") return start && before(start, end!) ? { ...entry, start } : null;
    const to = end === null ? null : shiftPoint(timeline, end, unit, by);
    return start && (end === null || to) ? { ...entry, start, end: to } : null;
  };
  // The furthest count towards `by` that keeps the entry in the timeline and its ends in order, found by
  // halving, since every count nearer to none fits as well.
  const sign = Math.sign(drag.by);
  let fits = Math.abs(Math.trunc(drag.by));
  if (!moved(sign * fits)) {
    let fails = fits;
    fits = 0;
    while (fails - fits > 1) {
      const middle = Math.floor((fits + fails) / 2);
      if (moved(sign * middle)) fits = middle;
      else fails = middle;
    }
  }
  return done({ ...moved(sign * fits)!, categoryId: drag.categoryId });
}

/** Drops a dragged entry where {@link draggedEntry} puts it: the drawing's pointer moves. */
export function dragEntry(timeline: Timeline, id: string, drag: EntryDrag): EditResult<Timeline> {
  const dragged = draggedEntry(timeline, id, drag);
  return dragged.ok ? putEntry(timeline, dragged.value) : dragged;
}
