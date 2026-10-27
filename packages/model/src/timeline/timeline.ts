import { z } from "zod";

import { idSchema } from "../common/ids";
import { PALETTE_SIZE } from "../common/palette";
import { nameFits, oneLineFits } from "../common/text";
import type { DocumentKind } from "../storage/document";
import { compareTimelineDates, timelineDateSchema } from "./date";

export const MAX_TIMELINE_STEPS = 200;
export const MAX_TIMELINE_CATEGORIES = 24;
export const MAX_TIMELINE_ENTRIES = 2000;
/** The longest title of an entry, in characters (jerome's). */
export const MAX_ENTRY_TITLE_LENGTH = 200;

/**
 * The kind of a timeline, chosen when it is made and never changed (decision 16): steps the author names
 * and orders (`sequence`), or calendar dates (`dates`).
 */
export const timelineKindSchema = z.enum(["sequence", "dates"]);

/** How a category's line is drawn; with the colour, it tells lanes apart beyond the eight colours. */
export const timelineLineSchema = z.enum(["solid", "dashed", "dotted"]);

/** The lines in the order new categories take them. */
export const TIMELINE_LINES = timelineLineSchema.options;

/** A step of a Sequence timeline ("Act 1", "Act 2"…), in the order the author gave. */
export const timelineStepSchema = z
  .object({
    id: idSchema,
    name: z.string().refine((name) => nameFits(name), "A step's name is 1 to 120 characters."),
  })
  .strict();

/** A category of a timeline: a label drawn as a lane in its palette colour and line, lanes in list order. */
export const timelineCategorySchema = z
  .object({
    id: idSchema,
    name: z.string().refine((name) => nameFits(name), "A category's name is 1 to 120 characters."),
    colour: z
      .number()
      .int()
      .min(0)
      .max(PALETTE_SIZE - 1),
    line: timelineLineSchema,
  })
  .strict();

/** A step of a Sequence timeline, by its id. */
export const stepPointSchema = z.object({ step: idSchema }).strict();

/** Where an entry is, or where a span starts or ends: a step (Sequence) or a date (Dates). */
export const timelinePointSchema = z.union([stepPointSchema, timelineDateSchema]);

/** An entry: at one point, or a span from one point to a later one, in a category. */
export const timelineEntrySchema = z
  .object({
    id: idSchema,
    title: z.string().refine((title) => nameFits(title, MAX_ENTRY_TITLE_LENGTH), "A title is 1 to 200 characters."),
    categoryId: idSchema,
    start: timelinePointSchema,
    /** Where a span ends; null for an entry at one point. */
    end: timelinePointSchema.nullable(),
    /** One line; may be empty. */
    summary: z.string().refine((text) => oneLineFits(text), "A summary is one line of up to 500 characters."),
  })
  .strict();

/**
 * A timeline (decision 16): its kind, its steps (a Sequence; none in Dates), its categories (its lanes,
 * in order) and its entries. The host names the document; the timeline has no title of its own. Check the
 * rules between its parts with {@link timelineProblems}.
 */
export const timelineSchema = z
  .object({
    kind: timelineKindSchema,
    steps: z.array(timelineStepSchema).max(MAX_TIMELINE_STEPS),
    categories: z.array(timelineCategorySchema).max(MAX_TIMELINE_CATEGORIES),
    entries: z.array(timelineEntrySchema).max(MAX_TIMELINE_ENTRIES),
  })
  .strict();

export type TimelineKind = z.infer<typeof timelineKindSchema>;
export type TimelineLine = z.infer<typeof timelineLineSchema>;
export type TimelineStep = z.infer<typeof timelineStepSchema>;
export type TimelineCategory = z.infer<typeof timelineCategorySchema>;
export type StepPoint = z.infer<typeof stepPointSchema>;
export type TimelinePoint = z.infer<typeof timelinePointSchema>;
export type TimelineEntry = z.infer<typeof timelineEntrySchema>;
export type Timeline = z.infer<typeof timelineSchema>;

/** A timeline with nothing in it yet. */
export function emptyTimeline(kind: TimelineKind): Timeline {
  return { kind, steps: [], categories: [], entries: [] };
}

/**
 * The order of two points of a timeline (negative when the first comes earlier), or null when either is
 * not a point of its kind (a step it does not have, or a step against a date).
 */
export function compareTimelinePoints(
  first: TimelinePoint,
  second: TimelinePoint,
  steps: readonly TimelineStep[],
): number | null {
  if ("step" in first && "step" in second) {
    const a = steps.findIndex((step) => step.id === first.step);
    const b = steps.findIndex((step) => step.id === second.step);
    return a < 0 || b < 0 ? null : a - b;
  }
  if ("year" in first && "year" in second) return compareTimelineDates(first, second);
  return null;
}

/** The problems of a timeline a schema cannot see, one sentence each for logs; none when it is well formed. */
export function timelineProblems(timeline: Timeline): string[] {
  const problems: string[] = [];
  if (timeline.kind === "dates" && timeline.steps.length > 0) problems.push("A Dates timeline has no steps.");
  const ids = new Set<string>();
  for (const { id } of [...timeline.steps, ...timeline.categories, ...timeline.entries]) {
    if (ids.has(id)) problems.push("Each id is used once.");
    ids.add(id);
  }
  for (const [list, what] of [
    [timeline.steps, "Step"],
    [timeline.categories, "Category"],
  ] as const) {
    const names = new Set<string>();
    for (const { name } of list) {
      if (names.has(name.trim().toLowerCase())) problems.push(`${what} names must differ.`);
      names.add(name.trim().toLowerCase());
    }
  }
  const categories = new Set(timeline.categories.map((category) => category.id));
  for (const entry of timeline.entries) {
    if (!categories.has(entry.categoryId)) problems.push("An entry's category must exist.");
    const points = entry.end ? [entry.start, entry.end] : [entry.start];
    const fits = points.every(
      (point) =>
        "year" in point === (timeline.kind === "dates") && compareTimelinePoints(point, point, timeline.steps) !== null,
    );
    if (!fits) {
      problems.push(
        timeline.kind === "dates"
          ? "An entry's points must be dates."
          : "An entry's points must be steps of the timeline.",
      );
    } else if (entry.end && (compareTimelinePoints(entry.start, entry.end, timeline.steps) ?? 0) >= 0) {
      problems.push("A span must end after it starts.");
    }
  }
  return problems;
}

/** Whether a timeline passes its schema and its checks: what every edit operation's result must do. */
export function isValidTimeline(timeline: Timeline): boolean {
  return timelineSchema.safeParse(timeline).success && timelineProblems(timeline).length === 0;
}

/** A timeline's stored document (decision 9): `{ format: "eisenhower", kind: "timeline", version: 1, data }`. */
export const timelineDocument: DocumentKind<Timeline> = {
  kind: "timeline",
  version: 1,
  schema: timelineSchema,
  problems: timelineProblems,
};
