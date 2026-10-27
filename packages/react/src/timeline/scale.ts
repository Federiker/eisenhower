import type { Timeline, TimelineDate, TimelineEntry, TimelinePoint } from "@eisenhower/model";

/** How wide a collapsed empty stretch is drawn. */
export const BREAK_WIDTH = 36;
/** An empty stretch longer than this share of the whole range is collapsed (jerome's decision). */
export const GAP_SHARE = 0.25;
/** The narrowest a step's column is drawn, and the widest zoom allows. */
export const MIN_STEP_WIDTH = 96;
export const MAX_STEP_WIDTH = 300;
/** The most a day is drawn across when zoomed in. */
export const MAX_DAY_WIDTH = 20;

/** Days from 1 January 1970 in the proleptic Gregorian calendar (astronomical years; Howard Hinnant's method). */
export function dayNumber(year: number, month = 1, day = 1): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}

/** The date a day number falls on. */
export function civilDate(days: number): { year: number; month: number; day: number } {
  const z = Math.floor(days) + 719_468;
  const era = Math.floor(z / 146_097);
  const dayOfEra = z - era * 146_097;
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36_524) - Math.floor(dayOfEra / 146_096)) / 365,
  );
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const mp = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  return { year: yearOfEra + era * 400 + (month <= 2 ? 1 : 0), month, day };
}

/** The days a date stands for: a whole year, a whole month, or one day (the end is excluded). */
export function periodOf(date: TimelineDate): [number, number] {
  if (date.month === null) return [dayNumber(date.year), dayNumber(date.year + 1)];
  if (date.day === null) {
    return [
      dayNumber(date.year, date.month),
      date.month === 12 ? dayNumber(date.year + 1) : dayNumber(date.year, date.month + 1),
    ];
  }
  const start = dayNumber(date.year, date.month, date.day);
  return [start, start + 1];
}

/**
 * Where an entry is on the time axis, in days (Dates) or steps (Sequence): the marker of a point, or a
 * span's two ends, and the period a point's partial date covers. A step is the column [i, i + 1), its
 * marker in the middle; a date's marker is where its period starts; a span runs from the start of its
 * first period to the end of its last.
 */
export type Extent = { from: number; to: number; marker: number | null; band: [number, number] | null };

export function extentOf(entry: TimelineEntry, timeline: Timeline): Extent | null {
  const stepAt = (point: TimelinePoint) =>
    "step" in point ? timeline.steps.findIndex((step) => step.id === point.step) : -1;
  if (timeline.kind === "sequence") {
    const start = stepAt(entry.start);
    const end = entry.end === null ? start : stepAt(entry.end);
    if (start < 0 || end < 0) return null;
    return entry.end === null
      ? { from: start + 0.5, to: start + 0.5, marker: start + 0.5, band: null }
      : { from: start + 0.5, to: end + 0.5, marker: null, band: null };
  }
  if (!("year" in entry.start) || (entry.end !== null && !("year" in entry.end))) return null;
  const [start, startEnd] = periodOf(entry.start);
  if (entry.end === null)
    return { from: start, to: start, marker: start, band: startEnd - start > 1 ? [start, startEnd] : null };
  return { from: start, to: periodOf(entry.end as TimelineDate)[1], marker: null, band: null };
}

/**
 * A stretch of the axis: drawn to scale, or collapsed into a break of fixed width; a break knows the
 * last day before it and the first day after it that something is on.
 */
export type Segment = {
  from: number;
  to: number;
  x: number;
  width: number;
  collapsed: boolean;
  edges?: [number, number];
};

export type Scale = {
  segments: Segment[];
  /** Pixels per day (Dates) or per step (Sequence) in the stretches drawn to scale. */
  unit: number;
  width: number;
  /** The zoom that fits the drawing to the width it was made for (1), and the most zoom allows. */
  maxZoom: number;
};

/** Where a time falls on the drawing; a time inside a collapsed stretch is at its break. */
export function xOf(scale: Scale, value: number): number {
  const segment =
    scale.segments.find((each) => value >= each.from && value <= each.to) ??
    (value < scale.segments[0]!.from ? scale.segments[0]! : scale.segments[scale.segments.length - 1]!);
  if (segment.collapsed) return segment.x + segment.width / 2;
  return segment.x + (Math.min(Math.max(value, segment.from), segment.to) - segment.from) * scale.unit;
}

/** The time at a place on the drawing, or null inside a break or outside the axis. */
export function valueAt(scale: Scale, x: number): number | null {
  const segment = scale.segments.find((each) => x >= each.x && x <= each.x + each.width);
  if (!segment || segment.collapsed) return null;
  return segment.from + (x - segment.x) / scale.unit;
}

/**
 * The axis of a timeline fitted to `width` and multiplied by `zoom`: one even column per step in a
 * Sequence; in Dates, real time between the first and last entries with a little room either side, and
 * every empty stretch longer than {@link GAP_SHARE} of the whole collapsed into a break, when entries on
 * one side of it are at more than one place. Null when there
 * is nothing to draw.
 */
export function scaleOf(timeline: Timeline, width: number, zoom: number): Scale | null {
  if (timeline.kind === "sequence") {
    const steps = timeline.steps.length;
    if (steps === 0) return null;
    const fitted = Math.max(MIN_STEP_WIDTH, width / steps);
    const maxZoom = Math.max(1, MAX_STEP_WIDTH / fitted);
    const unit = fitted * Math.min(Math.max(zoom, 1), maxZoom);
    return {
      segments: [{ from: 0, to: steps, x: 0, width: steps * unit, collapsed: false }],
      unit,
      width: steps * unit,
      maxZoom,
    };
  }
  const extents = timeline.entries
    .map((entry) => extentOf(entry, timeline))
    .filter((extent): extent is Extent => extent !== null)
    .map(
      (extent) =>
        (extent.band
          ? [Math.min(extent.from, extent.band[0]), Math.max(extent.to, extent.band[1])]
          : [extent.from, Math.max(extent.to, extent.from + 1)]) as [number, number],
    )
    .sort((a, b) => a[0] - b[0]);
  if (extents.length === 0) return null;
  const merged: [number, number][] = [];
  for (const [from, to] of extents) {
    const last = merged[merged.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else merged.push([from, to]);
  }
  const whole = merged[merged.length - 1]![1] - merged[0]![0];
  const room = Math.max(whole * 0.02, 1);
  // A gap is worth collapsing only when it makes room for entries at different places on one side of it
  // (two entries far apart are perfectly readable to scale).
  const starts = [...new Set(extents.map(([from]) => from))];
  const crowded = (before: number) =>
    starts.filter((start) => start < before).length >= 2 || starts.filter((start) => start >= before).length >= 2;
  const pieces: { from: number; to: number; collapsed: boolean; edges?: [number, number] }[] = [];
  merged.forEach(([from, to], index) => {
    if (index === 0) pieces.push({ from: from - room, to, collapsed: false });
    else {
      const gap = from - merged[index - 1]![1];
      if (gap > whole * GAP_SHARE && crowded(from)) {
        pieces[pieces.length - 1]!.to = merged[index - 1]![1] + room;
        pieces.push(
          {
            from: merged[index - 1]![1] + room,
            to: from - room,
            collapsed: true,
            edges: [merged[index - 1]![1] - 1, from],
          },
          { from: from - room, to, collapsed: false },
        );
      } else {
        pieces[pieces.length - 1]!.to = to;
      }
    }
  });
  pieces[pieces.length - 1]!.to += room;
  const breaks = pieces.filter((piece) => piece.collapsed).length;
  const days = pieces.filter((piece) => !piece.collapsed).reduce((sum, piece) => sum + piece.to - piece.from, 0);
  const fitted = Math.max(width - breaks * BREAK_WIDTH, 120) / days;
  const maxZoom = Math.max(1, MAX_DAY_WIDTH / fitted);
  const unit = fitted * Math.min(Math.max(zoom, 1), maxZoom);
  let x = 0;
  const segments = pieces.map((piece) => {
    const segment = { ...piece, x, width: piece.collapsed ? BREAK_WIDTH : (piece.to - piece.from) * unit };
    x += segment.width;
    return segment;
  });
  return { segments, unit, width: x, maxZoom };
}

/** How fine the axis is: the unit its ticks mark and how many of them each tick is apart. */
export type Precision = { unit: "day" | "month" | "year"; every: number };

const YEAR_STEPS = [
  1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000,
];
/** The least room between two ticks. */
const TICK_ROOM = 72;

/** The finest axis that leaves room between ticks at this many pixels per day. */
export function precisionOf(pixelsPerDay: number): Precision {
  if (pixelsPerDay >= TICK_ROOM) return { unit: "day", every: 1 };
  if (pixelsPerDay * 30.44 >= TICK_ROOM) return { unit: "month", every: 1 };
  const every = YEAR_STEPS.find((years) => years * 365.25 * pixelsPerDay >= TICK_ROOM) ?? 1_000_000;
  return { unit: "year", every };
}

/** The ticks of the axis within the stretches drawn to scale, each with the date it marks. */
export function ticksOf(scale: Scale): { value: number; date: TimelineDate }[] {
  const precision = precisionOf(scale.unit);
  const ticks: { value: number; date: TimelineDate }[] = [];
  for (const segment of scale.segments.filter((each) => !each.collapsed)) {
    const first = civilDate(segment.from);
    if (precision.unit === "year") {
      // Round years as they are written (100 BCE, 100 CE): BCE years count back from 1 BCE, and there is no year 0.
      const written = (year: number) => (year <= 0 ? year - 1 : year);
      const astronomical = (signed: number) => (signed < 0 ? signed + 1 : signed);
      for (
        let signed = Math.ceil(written(first.year) / precision.every) * precision.every;
        ticks.length < 2000;
        signed += precision.every
      ) {
        if (signed === 0) continue;
        const year = astronomical(signed);
        const value = dayNumber(year);
        if (value > segment.to) break;
        if (value >= segment.from) ticks.push({ value, date: { year, month: null, day: null, approximate: false } });
      }
    } else if (precision.unit === "month") {
      let { year, month } = first;
      for (
        let value = dayNumber(year, month);
        value <= segment.to && ticks.length < 2000;
        value = dayNumber(year, month)
      ) {
        if (value >= segment.from) ticks.push({ value, date: { year, month, day: null, approximate: false } });
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
      }
    } else {
      for (let value = Math.ceil(segment.from); value <= segment.to && ticks.length < 2000; value += 1) {
        const { year, month, day } = civilDate(value);
        ticks.push({ value, date: { year, month, day, approximate: false } });
      }
    }
  }
  return ticks;
}

/** The point at a place on the drawing, as fine as the axis shows; null in a break or without steps. */
export function pointAt(timeline: Timeline, scale: Scale, x: number): TimelinePoint | null {
  const value = valueAt(scale, x);
  if (value === null) return null;
  if (timeline.kind === "sequence") {
    const step = timeline.steps[Math.min(Math.max(Math.floor(value), 0), timeline.steps.length - 1)];
    return step ? { step: step.id } : null;
  }
  const { year, month, day } = civilDate(value);
  const precision = precisionOf(scale.unit);
  return {
    year,
    month: precision.unit === "year" ? null : month,
    day: precision.unit === "day" ? day : null,
    approximate: false,
  };
}
