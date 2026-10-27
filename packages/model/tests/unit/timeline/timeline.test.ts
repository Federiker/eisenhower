import {
  compareTimelineDates,
  DocumentError,
  isValidTimeline,
  parseDocument,
  precisionOfDate,
  serialiseDocument,
  shiftDate,
  timelineDateSchema,
  timelineDocument,
  timelineProblems,
  timelineSchema,
  writtenYear,
} from "../../../src";
import { acts, date, dated, entry, id, step } from "./fixtures";

describe("timeline dates", () => {
  it("are proleptic Gregorian from 999 999 BCE, a day only with a month and within it", () => {
    expect(timelineDateSchema.safeParse(date(-999_998)).success).toBe(true);
    expect(timelineDateSchema.safeParse(date(999_999, 12, 31)).success).toBe(true);
    expect(timelineDateSchema.safeParse(date(-4, 2, 29)).success).toBe(true);
    for (const bad of [
      date(-999_999),
      date(1_000_000),
      date(1066, 13),
      date(1066, null, 1),
      date(2023, 2, 29),
      date(1.5),
    ]) {
      expect(timelineDateSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
    expect(timelineDateSchema.safeParse({ year: 1066 }).success).toBe(false);
  });

  it("sort a whole year or month before the dates within it", () => {
    const sorted = [date(1066, 3, 14), date(1066), date(-400), date(1066, 3)].sort(compareTimelineDates);
    expect(sorted).toEqual([date(-400), date(1066), date(1066, 3), date(1066, 3, 14)]);
  });

  it("are written with BCE years counted back from 1 BCE", () => {
    expect(writtenYear(0)).toEqual({ year: 1, bce: true });
    expect(writtenYear(-399)).toEqual({ year: 400, bce: true });
    expect(writtenYear(1066)).toEqual({ year: 1066, bce: false });
  });

  it("have a precision and move by years, months or days within the timeline's years", () => {
    expect([precisionOfDate(date(1)), precisionOfDate(date(1, 2)), precisionOfDate(date(1, 2, 3))]).toEqual([
      "year",
      "month",
      "day",
    ]);
    expect(shiftDate(date(0, null, null, true), "year", -1)).toEqual(date(-1, null, null, true));
    expect(shiftDate(date(1066, 12), "month", 1)).toEqual(date(1067, 1));
    expect(shiftDate(date(1066, 1), "month", -1)).toEqual(date(1065, 12));
    expect(shiftDate(date(2024, 1, 31), "month", 1)).toEqual(date(2024, 2, 29));
    expect(shiftDate(date(2024, 2, 29), "year", 1)).toEqual(date(2025, 2, 28));
    expect(shiftDate(date(1066, 12, 31), "day", 1)).toEqual(date(1067, 1, 1));
    expect(shiftDate(date(1067, 1, 1), "day", -1)).toEqual(date(1066, 12, 31));
    expect(shiftDate(date(2024, 3, 1), "day", -1)).toEqual(date(2024, 2, 29));
    expect(shiftDate(date(1066), "month", 1)).toBeNull();
    expect(shiftDate(date(1066, 3), "day", 1)).toBeNull();
    expect(shiftDate(date(999_999), "year", 1)).toBeNull();
    expect(shiftDate(date(-999_998, 1, 1), "day", -1)).toBeNull();
  });
});

describe("timelines", () => {
  it("keep entries on their steps, spans ending at a later step", () => {
    expect(timelineSchema.safeParse(acts([entry(20, step(1), step(2))])).success).toBe(true);
    expect(timelineProblems(acts([entry(20, step(1), step(2))]))).toEqual([]);
    expect(timelineProblems(acts([entry(20, step(2), step(1))]))).toEqual(["A span must end after it starts."]);
    expect(timelineProblems(acts([entry(20, step(4))]))).toEqual(["An entry's points must be steps of the timeline."]);
    expect(timelineProblems(acts([entry(20, date(1066))]))).toEqual([
      "An entry's points must be steps of the timeline.",
    ]);
    expect(timelineProblems(acts([entry(20, step(1), null, id(12))]))).toEqual(["An entry's category must exist."]);
  });

  it("keep dates in a Dates timeline, with ids used once, names that differ and the limits", () => {
    const timeline = dated([entry(20, date(1066), date(1087))]);
    expect(timelineProblems(timeline)).toEqual([]);
    expect(isValidTimeline(timeline)).toBe(true);
    expect(timelineProblems({ ...timeline, entries: [entry(20, date(1066), date(1066))] })).toEqual([
      "A span must end after it starts.",
    ]);
    expect(timelineProblems({ ...timeline, entries: [entry(20, step(1))] })).toEqual([
      "An entry's points must be dates.",
    ]);
    expect(timelineProblems({ ...timeline, steps: acts().steps })).toContain("A Dates timeline has no steps.");
    expect(timelineProblems({ ...timeline, entries: [entry(10, date(1066))] })).toEqual(["Each id is used once."]);
    const twice = dated();
    twice.categories.push({ id: id(12), name: " ships ", colour: 2, line: "dotted" });
    expect(timelineProblems(twice)).toEqual(["Category names must differ."]);
    expect(timelineProblems({ ...acts(), steps: [...acts().steps, { id: id(4), name: "ACT 1" }] })).toEqual([
      "Step names must differ.",
    ]);
    for (const bad of [
      { ...timeline, entries: [entry(20, date(1066), null, id(10), { summary: "one\ntwo" })] },
      { ...timeline, entries: [entry(20, date(1066), null, id(10), { title: " " })] },
      { ...timeline, entries: [entry(20, date(1066), null, id(10), { title: "a".repeat(201) })] },
      { ...timeline, categories: [{ id: id(10), name: "Main", colour: 8, line: "solid" }] },
      { ...timeline, categories: [{ id: id(10), name: "Main", colour: null, line: "solid" }] },
      { ...timeline, categories: [{ id: id(10), name: "Main", colour: 0, line: "wavy" }] },
      { ...timeline, kind: "calendar" },
      { ...timeline, extra: true },
    ]) {
      expect(timelineSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("the timeline's document", () => {
  it("round-trips a timeline of each kind", () => {
    for (const timeline of [
      acts([entry(20, step(1), step(3), id(11), { summary: "Sails at dawn" }), entry(21, step(2))]),
      dated([entry(20, date(-42, null, null, true), date(410)), entry(21, date(1066, 10, 14), null, id(11))]),
    ]) {
      const text = serialiseDocument(timelineDocument, timeline);
      expect(JSON.parse(text)).toMatchObject({ format: "eisenhower", kind: "timeline", version: 1 });
      expect(parseDocument(timelineDocument, text)).toEqual(timeline);
    }
  });

  it("refuses a timeline that breaks its rules, saying why", () => {
    const text = serialiseDocument(timelineDocument, acts([entry(20, step(3), step(1))]));
    expect(() => parseDocument(timelineDocument, text)).toThrow(DocumentError);
    try {
      parseDocument(timelineDocument, text);
    } catch (error) {
      expect((error as DocumentError).details).toEqual(["A span must end after it starts."]);
    }
  });
});
