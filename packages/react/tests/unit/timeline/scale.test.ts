import type { Timeline } from "@eisenhower/model";
import { describe, expect, it } from "vitest";

import { lanesOf } from "../../../src/timeline/layout";
import {
  BREAK_WIDTH,
  civilDate,
  dayNumber,
  extentOf,
  MIN_STEP_WIDTH,
  periodOf,
  pointAt,
  precisionOf,
  scaleOf,
  ticksOf,
  valueAt,
  xOf,
} from "../../../src/timeline/scale";
import { d, dated, e, id } from "./fixtures";

// Copied from jerome's timeline-scale.test.ts, made generic.
describe("days", () => {
  it("count the proleptic Gregorian calendar both ways, across BCE and leap years", () => {
    expect(dayNumber(1970)).toBe(0);
    expect(dayNumber(2000, 3, 1) - dayNumber(2000, 2, 28)).toBe(2);
    expect(dayNumber(1900, 3, 1) - dayNumber(1900, 2, 28)).toBe(1);
    for (const date of [
      { year: -399, month: 3, day: 15 },
      { year: 0, month: 2, day: 29 },
      { year: 1066, month: 10, day: 14 },
      { year: -999_998, month: 1, day: 1 },
    ]) {
      expect(civilDate(dayNumber(date.year, date.month, date.day))).toEqual(date);
    }
    expect(periodOf(d(1066))).toEqual([dayNumber(1066), dayNumber(1067)]);
    expect(periodOf(d(1066, 12))).toEqual([dayNumber(1066, 12), dayNumber(1067)]);
    expect(periodOf(d(1066, 3))).toEqual([dayNumber(1066, 3), dayNumber(1066, 4)]);
    expect(periodOf(d(1066, 10, 14))).toEqual([dayNumber(1066, 10, 14), dayNumber(1066, 10, 15)]);
  });
});

describe("the axis", () => {
  it("gives each step an even column, at least the narrowest, and zooms within its limits", () => {
    const acts: Timeline = {
      ...dated([]),
      kind: "sequence",
      steps: [
        { id: id(1), name: "Act 1" },
        { id: id(2), name: "Act 2" },
      ],
    };
    const fitted = scaleOf(acts, 800, 1)!;
    expect(fitted.unit).toBe(400);
    expect(
      scaleOf({ ...acts, steps: Array.from({ length: 20 }, (_, n) => ({ id: id(n + 1), name: `S${n}` })) }, 800, 1)!
        .unit,
    ).toBe(MIN_STEP_WIDTH);
    expect(scaleOf(acts, 800, 10)!.unit).toBe(400);
    const entry = e(20, { step: id(2) });
    expect(extentOf(entry, acts)).toEqual({ from: 1.5, to: 1.5, marker: 1.5, band: null });
    expect(extentOf(e(21, { step: id(1) }, { step: id(2) }), acts)).toEqual({
      from: 0.5,
      to: 1.5,
      marker: null,
      band: null,
    });
    expect(extentOf(e(22, { step: id(9) }), acts)).toBeNull();
    expect(extentOf(e(23, d(1066)), acts)).toBeNull();
    expect(pointAt(acts, fitted, 420)).toEqual({ step: id(2) });
    expect(scaleOf({ ...acts, steps: [] }, 800, 1)).toBeNull();
  });

  it("draws dates to scale and collapses an empty stretch longer than a quarter of the whole", () => {
    const timeline = dated([e(20, d(-9699)), e(21, d(1066), d(1087)), e(22, d(1086))]);
    const scale = scaleOf(timeline, 1000, 1)!;
    expect(scale.segments.map((segment) => segment.collapsed)).toEqual([false, true, false]);
    const gap = scale.segments[1]!;
    expect(gap.width).toBe(BREAK_WIDTH);
    expect(gap.edges!.map((day) => civilDate(day).year)).toEqual([-9699, 1066]);
    expect(Math.round(scale.width)).toBe(1000);
    // Positions and times map to each other, except in the break.
    const landing = xOf(scale, dayNumber(1066));
    expect(valueAt(scale, landing)).toBeCloseTo(dayNumber(1066), 3);
    expect(valueAt(scale, gap.x + 5)).toBeNull();
    expect(valueAt(scale, -5)).toBeNull();
    expect(xOf(scale, dayNumber(0))).toBe(gap.x + gap.width / 2);
    expect(xOf(scale, dayNumber(-20_000))).toBe(0);
    expect(pointAt(timeline, scale, gap.x + 5)).toBeNull();
    // Two entries far apart are readable to scale: nothing is collapsed.
    expect(scaleOf(dated([e(20, d(1066)), e(21, d(1086))]), 1000, 1)!.segments).toHaveLength(1);
    expect(scaleOf(dated([e(20, d(-9699)), e(21, d(1086))]), 1000, 1)!.segments).toHaveLength(1);
    expect(scaleOf(dated([]), 1000, 1)).toBeNull();
    expect(extentOf(e(23, { step: id(1) }), timeline)).toBeNull();
  });

  it("marks round written years (no year 0), then months and days as it zooms in", () => {
    expect(precisionOf(0.0005)).toEqual({ unit: "year", every: 500 });
    expect(precisionOf(3)).toEqual({ unit: "month", every: 1 });
    expect(precisionOf(80)).toEqual({ unit: "day", every: 1 });
    const scale = scaleOf(dated([e(20, d(-249)), e(21, d(250))]), 1000, 1)!;
    const years = ticksOf(scale).map((tick) => tick.date.year);
    expect(years).toContain(-199); // 200 BCE
    expect(years).toContain(100); // 100 CE
    expect(years).not.toContain(0);
    expect(years).not.toContain(-200);
    const zoomed = scaleOf(dated([e(20, d(1066, 10, 14)), e(21, d(1066, 12, 25))]), 1000, 1)!;
    expect(precisionOf(zoomed.unit).unit).toBe("month");
    const point = pointAt(dated([]), zoomed, xOf(zoomed, dayNumber(1066, 11, 10)));
    expect(point).toEqual({ year: 1066, month: 11, day: null, approximate: false });
    const days = scaleOf(dated([e(20, d(1066, 10, 14)), e(21, d(1066, 10, 20))]), 1000, 1)!;
    expect(precisionOf(days.unit).unit).toBe("day");
    expect(ticksOf(days).some((tick) => tick.date.day === 14)).toBe(true);
    expect(pointAt(dated([]), days, xOf(days, dayNumber(1066, 10, 16) + 0.5))).toEqual(d(1066, 10, 16));
    const years100 = scaleOf(dated([e(20, d(1000)), e(21, d(1100))]), 1000, 1)!;
    expect(pointAt(dated([]), years100, xOf(years100, dayNumber(1050, 6, 1)))).toEqual(d(1050));
  });
});

describe("lanes", () => {
  it("stack entries that would overlap into rows, one lane per category in order", () => {
    const timeline = dated(
      [e(20, d(1066)), e(21, d(1066, 10)), e(22, d(1500)), e(23, d(1066), d(1500), id(11)), e(24, d(1), null, id(19))],
      [
        { id: id(10), name: "Ships", colour: 0, line: "solid" },
        { id: id(11), name: "Harbour", colour: 1, line: "dashed" },
      ],
    );
    const scale = scaleOf(timeline, 1000, 1)!;
    const lanes = lanesOf(timeline, scale, 40);
    expect(lanes.map((lane) => lane.category.name)).toEqual(["Ships", "Harbour"]);
    expect(lanes[0]!.entries.map((placed) => [placed.entry.id, placed.row])).toEqual([
      [id(20), 0],
      [id(21), 1],
      [id(22), 0],
    ]);
    expect(lanes[0]!.rows).toBe(2);
    expect(lanes[1]!.top).toBe(40 + lanes[0]!.height);
    expect(lanes[1]!.entries[0]!.x2).toBeGreaterThan(lanes[1]!.entries[0]!.x1);
  });
});
