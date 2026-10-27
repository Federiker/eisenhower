import {
  deleteEntry,
  draftOf,
  type EditResult,
  type EntryDraft,
  entryFromDraft,
  isValidTimeline,
  MAX_TIMELINE_ENTRIES,
  moveEntryToLane,
  newDraft,
  putEntry,
  shiftEntry,
  shiftUnit,
  sortedEntries,
  type Timeline,
  type TimelineEntry,
} from "../../../src";
import { acts, date, dated, entry, id, step } from "./fixtures";

const ok = (result: EditResult<Timeline>): Timeline => {
  if (!result.ok) throw new Error(result.reason);
  expect(isValidTimeline(result.value)).toBe(true);
  return result.value;
};

// Copied from jerome's timeline-entries.test.ts, made generic.
describe("the entry form's values", () => {
  it("become an entry with an astronomical year, or every reason they cannot", () => {
    const timeline = dated();
    const draft: EntryDraft = {
      ...newDraft(timeline),
      title: " Harbour opens ",
      summary: " The first ship\ncomes in ",
      start: { year: "1066", bce: false, month: "10", day: "14", approximate: false },
    };
    expect(entryFromDraft(draft, id(20), timeline)).toEqual({
      entry: {
        id: id(20),
        title: "Harbour opens",
        categoryId: id(10),
        start: date(1066, 10, 14),
        end: null,
        summary: "The first ship comes in",
      },
    });
    const bce = { ...draft, start: { year: "400", bce: true, month: "", day: "", approximate: true } };
    expect(entryFromDraft(bce, id(20), timeline)).toMatchObject({ entry: { start: date(-399, null, null, true) } });
    expect(entryFromDraft({ ...newDraft(timeline) }, id(20), timeline)).toEqual({ problems: ["titleBlank", "year"] });
    const leap = { ...draft, start: { year: "2023", bce: false, month: "2", day: "29", approximate: false } };
    expect(entryFromDraft(leap, id(20), timeline)).toEqual({ problems: ["day"] });
    const backwards = {
      ...draft,
      span: true,
      end: { year: "1000", bce: false, month: "", day: "", approximate: false },
    };
    expect(entryFromDraft(backwards, id(20), timeline)).toEqual({ problems: ["order"] });
    expect(
      entryFromDraft({ ...draft, start: { ...draft.start, year: "0" } as EntryDraft["start"] }, id(20), timeline),
    ).toEqual({ problems: ["year"] });
    expect(
      entryFromDraft({ ...draft, start: { ...draft.start, year: "1000000" } as EntryDraft["start"] }, id(20), timeline),
    ).toEqual({ problems: ["year"] });
    // 999 999 BCE is the earliest year.
    expect(
      entryFromDraft(
        { ...draft, start: { ...draft.start, year: "999999", bce: true } as EntryDraft["start"] },
        id(20),
        timeline,
      ),
    ).toMatchObject({ entry: { start: { year: -999_998 } } });
    expect(
      entryFromDraft(
        { ...draft, title: "a".repeat(201), summary: "a".repeat(501), categoryId: id(19) },
        id(20),
        timeline,
      ),
    ).toEqual({ problems: ["titleTooLong", "summaryTooLong", "category"] });
    // An entry's values come back as they were typed.
    const saved = entry(21, date(-399, 3), date(1066, 10, 14, true));
    expect(draftOf(saved)).toMatchObject({
      span: true,
      start: { year: "400", bce: true, month: "3", day: "" },
      end: { year: "1066", bce: false, month: "10", day: "14", approximate: true },
    });
    expect(draftOf(entry(22, date(1066)))).toMatchObject({ span: false, end: { year: "1066" } });
  });

  it("start at the first step in a Sequence, which must exist, or where the entry was begun", () => {
    expect(newDraft(acts()).start).toEqual(step(1));
    expect(entryFromDraft({ ...newDraft(acts()), title: "Opening" }, id(20), acts())).toMatchObject({
      entry: { start: step(1) },
    });
    const bare: Timeline = { ...acts(), steps: [] };
    expect(entryFromDraft({ ...newDraft(bare), title: "Opening" }, id(20), bare)).toEqual({ problems: ["step"] });
    expect(newDraft(acts(), { categoryId: id(11), start: step(3) })).toMatchObject({
      categoryId: id(11),
      start: step(3),
      end: step(3),
    });
    expect(newDraft({ ...dated(), categories: [] }).categoryId).toBe("");
  });
});

describe("entries", () => {
  it("are added, replaced and deleted, and listed in time order", () => {
    let timeline = dated();
    const add = (next: TimelineEntry) => {
      timeline = ok(putEntry(timeline, next));
    };
    add(entry(20, date(1066, 10, 14)));
    add(entry(21, date(1066), date(1087), id(11)));
    add(entry(22, date(1066)));
    add(entry(23, date(-399)));
    add(entry(24, date(1066), date(1070)));
    add({ ...entry(20, date(1066, 10, 14)), title: "Harbour opens" });
    expect(timeline.entries).toHaveLength(5);
    expect(sortedEntries(timeline).map((each) => each.title)).toEqual([
      "Entry 23",
      "Entry 22",
      "Entry 24",
      "Entry 21",
      "Harbour opens",
    ]);
    expect(ok(deleteEntry(timeline, id(23))).entries.map((each) => each.id)).toEqual([id(20), id(21), id(22), id(24)]);
    expect(deleteEntry(timeline, id(99))).toEqual({ ok: false, reason: "missing" });
    expect(putEntry(timeline, entry(25, date(1066), null, id(19)))).toEqual({ ok: false, reason: "invalid" });
    const full = {
      ...dated(),
      entries: Array.from({ length: MAX_TIMELINE_ENTRIES }, (_, n) => entry(100 + n, date(1))),
    };
    expect(putEntry(full, entry(20, date(1)))).toEqual({ ok: false, reason: "limit" });
  });

  it("sort by lane, then title, when they are at the same place", () => {
    const timeline = acts([
      entry(20, step(1), null, id(11)),
      entry(21, step(1)),
      { ...entry(22, step(1)), title: "A" },
    ]);
    expect(sortedEntries(timeline).map((each) => each.id)).toEqual([id(22), id(21), id(20)]);
  });
});

describe("moving an entry with the keys", () => {
  it("takes it to the lane above or below, not past the first or last", () => {
    const timeline = acts([entry(20, step(1))]);
    expect(ok(moveEntryToLane(timeline, id(20), 1)).entries[0]!.categoryId).toBe(id(11));
    expect(moveEntryToLane(timeline, id(20), -1)).toEqual({ ok: false, reason: "limit" });
    expect(moveEntryToLane(timeline, id(99), 1)).toEqual({ ok: false, reason: "missing" });
  });

  it("moves it a step at a time in a Sequence, both ends of a span together", () => {
    const timeline = acts([entry(20, step(1), step(2)), entry(21, step(3))]);
    expect(ok(shiftEntry(timeline, id(20), 1)).entries[0]).toMatchObject({ start: step(2), end: step(3) });
    expect(shiftEntry(timeline, id(20), -1)).toEqual({ ok: false, reason: "limit" });
    expect(shiftEntry(timeline, id(21), 1)).toEqual({ ok: false, reason: "limit" });
    expect(ok(shiftEntry(timeline, id(21), -1)).entries[1]).toMatchObject({ start: step(2), end: null });
    expect(shiftEntry(timeline, id(99), 1)).toEqual({ ok: false, reason: "missing" });
  });

  it("moves dates by their coarsest precision", () => {
    const span = entry(20, date(1066, 10, 14), date(1087));
    expect(shiftUnit(span)).toBe("year");
    expect(shiftUnit(entry(21, date(1066, 10), date(1066, 12, 1)))).toBe("month");
    expect(shiftUnit(entry(22, date(1066, 10, 14)))).toBe("day");
    expect(shiftUnit(entry(23, step(1)))).toBe("year");
    const timeline = dated([span, entry(21, date(1066, 10), date(1066, 12, 1)), entry(22, date(1066, 12, 31))]);
    expect(ok(shiftEntry(timeline, id(20), 1)).entries[0]).toMatchObject({
      start: date(1067, 10, 14),
      end: date(1088),
    });
    expect(ok(shiftEntry(timeline, id(21), -1)).entries[1]).toMatchObject({
      start: date(1066, 9),
      end: date(1066, 11, 1),
    });
    expect(ok(shiftEntry(timeline, id(22), 1)).entries[2]).toMatchObject({ start: date(1067, 1, 1) });
    const edge = dated([entry(20, date(-999_998), date(999_999))]);
    expect(shiftEntry(edge, id(20), 1)).toEqual({ ok: false, reason: "limit" });
  });
});
