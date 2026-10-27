import { type EntryPart, partUnit, type Timeline, type TimelineEntry } from "@eisenhower/model";

import type { Lane } from "./layout";
import { civilDate, periodOf } from "./scale";

/** How far, in pixels, the pointer goes before a press on an entry becomes a drag (less is a click). */
export const DRAG_THRESHOLD = 4;

/**
 * How many steps (a Sequence) or units of the part's precision (Dates: years, months or days, as the model's
 * `partUnit` says) a drag of `delta` along the axis moves a part of an entry, to the nearest: the part's
 * period, taken at its unit, counts as moved once the drag has carried its middle into the next one.
 */
export function dragCount(timeline: Timeline, entry: TimelineEntry, part: EntryPart, delta: number): number {
  if (timeline.kind === "sequence") return Math.round(delta);
  const point = part === "end" ? entry.end : entry.start;
  if (point === null || !("year" in point)) return 0;
  const unit = partUnit(entry, part);
  const [from, to] = periodOf({
    ...point,
    month: unit === "year" ? null : point.month,
    day: unit === "day" ? point.day : null,
  });
  const landed = Math.floor((from + to) / 2 + delta);
  if (unit === "day") return landed - from;
  const start = civilDate(from);
  const target = civilDate(landed);
  if (unit === "month") return (target.year - start.year) * 12 + target.month - start.month;
  return target.year - start.year;
}

/** The lane at a height on the drawing: the first above the lanes, the last below them. */
export function laneAt(lanes: readonly Lane[], y: number): Lane | undefined {
  return lanes.find((lane) => y < lane.top + lane.height) ?? lanes.at(-1);
}
