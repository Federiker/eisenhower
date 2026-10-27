import { emptyTimeline, type Timeline, type TimelineDate, type TimelineEntry, type TimelinePoint } from "../../../src";

/** Invented timelines for the tests, as jerome's timeline tests build theirs. */
export const id = (n: number) => `id-${n}`;
export const step = (n: number) => ({ step: id(n) });
export const date = (
  year: number,
  month: number | null = null,
  day: number | null = null,
  approximate = false,
): TimelineDate => ({ year, month, day, approximate });

export function entry(
  n: number,
  start: TimelinePoint,
  end: TimelinePoint | null = null,
  categoryId = id(10),
  extra: Partial<TimelineEntry> = {},
): TimelineEntry {
  return { id: id(n), title: `Entry ${n}`, categoryId, start, end, summary: "", ...extra };
}

/** A Sequence of three acts and two lanes. */
export function acts(entries: TimelineEntry[] = []): Timeline {
  return {
    ...emptyTimeline("sequence"),
    steps: [
      { id: id(1), name: "Act 1" },
      { id: id(2), name: "Act 2" },
      { id: id(3), name: "Act 3" },
    ],
    categories: [
      { id: id(10), name: "Ships", colour: 0, line: "solid" },
      { id: id(11), name: "Harbour", colour: 1, line: "solid" },
    ],
    entries,
  };
}

/** A Dates timeline with two lanes. */
export function dated(entries: TimelineEntry[] = []): Timeline {
  return {
    ...emptyTimeline("dates"),
    categories: [
      { id: id(10), name: "Ships", colour: 0, line: "solid" },
      { id: id(11), name: "Harbour", colour: 1, line: "dashed" },
    ],
    entries,
  };
}
