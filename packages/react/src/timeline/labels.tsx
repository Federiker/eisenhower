import type { EntryProblem, Problem, TimelineCategory, TimelineLine } from "@eisenhower/model";

import type { MessageKey } from "../strings/en-GB";
import { colourVar } from "../theme/palette";

/** Why a change to a timeline (its steps, categories or entries) was refused, as the view says it. */
export const PROBLEM_LABELS = {
  blank: "timeline.problem.blank",
  tooLong: "timeline.problem.tooLong",
  duplicate: "timeline.problem.duplicate",
  limit: "timeline.problem.limit",
  missing: "timeline.problem.missing",
  order: "timeline.problem.order",
  invalid: "timeline.problem.invalid",
} as const satisfies Record<Problem, MessageKey>;

/** Why an entry as typed cannot be saved yet. */
export const ENTRY_PROBLEM_LABELS = {
  titleBlank: "timeline.problem.titleBlank",
  titleTooLong: "timeline.problem.titleTooLong",
  summaryTooLong: "timeline.problem.summaryTooLong",
  category: "timeline.problem.category",
  step: "timeline.problem.step",
  year: "timeline.problem.year",
  day: "timeline.problem.day",
  order: "timeline.problem.spanOrder",
} as const satisfies Record<EntryProblem, MessageKey>;

export const LINE_LABELS = {
  solid: "timeline.line.solid",
  dashed: "timeline.line.dashed",
  dotted: "timeline.line.dotted",
} as const satisfies Record<TimelineLine, MessageKey>;

/** The pencil of the lists' names and choices (EditableText). */
export const editIcon = (
  <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M11.5 1.5l3 3L5 14H2v-3z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

/** A category's colour and line, as its lane is drawn. */
export function CategorySwatch({ category }: { category: Pick<TimelineCategory, "colour" | "line"> }) {
  return (
    <span
      className="eh-timeline-swatch"
      aria-hidden="true"
      style={{ borderTopColor: colourVar(category.colour), borderTopStyle: category.line }}
    />
  );
}
