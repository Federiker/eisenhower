import { emptyTimeline, type Timeline, type TimelineDate, type TimelineEntry } from "@eisenhower/model";

/** Invented timelines for the timeline's tests, built as jerome's timeline tests build theirs. */
export const id = (n: number) => `id-${n}`;
export const d = (
  year: number,
  month: number | null = null,
  day: number | null = null,
  approximate = false,
): TimelineDate => ({ year, month, day, approximate });

export const e = (
  n: number,
  start: TimelineEntry["start"],
  end: TimelineEntry["end"] = null,
  categoryId = id(10),
  extra: Partial<TimelineEntry> = {},
): TimelineEntry => ({ id: id(n), title: `Entry ${n}`, categoryId, start, end, summary: "", ...extra });

/** A Dates timeline with one lane, or the lanes given. */
export function dated(entries: TimelineEntry[], categories?: Timeline["categories"]): Timeline {
  return {
    ...emptyTimeline("dates"),
    categories: categories ?? [{ id: id(10), name: "Main", colour: 0, line: "solid" }],
    entries,
  };
}

/** A Sequence of three acts, two lanes and three entries. */
export const acts: Timeline = {
  ...emptyTimeline("sequence"),
  steps: [
    { id: id(1), name: "Act 1" },
    { id: id(2), name: "Act 2" },
    { id: id(3), name: "Act 3" },
  ],
  categories: [
    { id: id(10), name: "Ships", colour: 0, line: "solid" },
    { id: id(11), name: "Harbour", colour: 1, line: "dashed" },
  ],
  entries: [
    e(20, { step: id(1) }, { step: id(2) }, id(10), { title: "Fleet sails" }),
    e(21, { step: id(3) }, null, id(10), { title: "Storm" }),
    e(22, { step: id(1) }, null, id(11), { title: "Pier built" }),
  ],
};

/** A Dates timeline of two lanes. */
export function harbour(entries: TimelineEntry[] = []): Timeline {
  return dated(entries, [
    { id: id(10), name: "Ships", colour: 0, line: "solid" },
    { id: id(11), name: "Harbour", colour: 1, line: "dashed" },
  ]);
}
