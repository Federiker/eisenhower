import { PALETTE_SIZE } from "../common/palette";
import { done, type EditResult, type Problem, refused } from "../common/result";
import { nameProblem } from "../common/text";
import {
  compareTimelinePoints,
  isValidTimeline,
  MAX_TIMELINE_CATEGORIES,
  MAX_TIMELINE_STEPS,
  TIMELINE_LINES,
  type Timeline,
  type TimelineCategory,
  type TimelineEntry,
  type TimelineLine,
  type TimelinePoint,
} from "./timeline";

/** What happens to the entries on a step that is deleted: they move to the step before or after, or go too. */
export type StepDisposal = "before" | "after" | "delete";

/** Why a name cannot be used: blank, too long, or another item's (ignoring case). */
function namedProblem(
  name: string,
  others: readonly { id: string; name: string }[],
  except: string | null,
): Problem | null {
  const problem = nameProblem(name);
  if (problem) return problem;
  const trimmed = name.trim().toLowerCase();
  const taken = others.some((other) => other.id !== except && other.name.trim().toLowerCase() === trimmed);
  return taken ? "duplicate" : null;
}

/** The finished timeline, or `invalid` when it would not pass its schema and checks. */
export function checkedTimeline(timeline: Timeline): EditResult<Timeline> {
  return isValidTimeline(timeline) ? done(timeline) : refused("invalid");
}

/** Moves the item with this id to another place in its list (its index after the move). */
function moved<T extends { id: string }>(list: readonly T[], id: string, to: number): T[] | null {
  const from = list.findIndex((item) => item.id === id);
  if (from < 0) return null;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item!);
  return next;
}

export function addStep(timeline: Timeline, id: string, name: string): EditResult<Timeline> {
  const problem = namedProblem(name, timeline.steps, null);
  if (problem) return refused(problem);
  if (timeline.steps.length >= MAX_TIMELINE_STEPS) return refused("limit");
  return checkedTimeline({ ...timeline, steps: [...timeline.steps, { id, name: name.trim() }] });
}

export function renameStep(timeline: Timeline, id: string, name: string): EditResult<Timeline> {
  if (!timeline.steps.some((step) => step.id === id)) return refused("missing");
  const problem = namedProblem(name, timeline.steps, id);
  if (problem) return refused(problem);
  return checkedTimeline({
    ...timeline,
    steps: timeline.steps.map((step) => (step.id === id ? { ...step, name: name.trim() } : step)),
  });
}

/**
 * Moves a step to another place in the order. A span whose end would then come before (or at) its start
 * is refused (`order`), as moving the step would turn it round.
 */
export function moveStep(timeline: Timeline, id: string, to: number): EditResult<Timeline> {
  const steps = moved(timeline.steps, id, to);
  if (!steps) return refused("missing");
  const next = { ...timeline, steps };
  const reversed = next.entries.some(
    (entry) => entry.end !== null && (compareTimelinePoints(entry.start, entry.end, steps) ?? 0) >= 0,
  );
  if (reversed) return refused("order");
  return checkedTimeline(next);
}

const atStep = (point: TimelinePoint | null, id: string) => point !== null && "step" in point && point.step === id;

/** How many entries start or end at a step. */
export function entriesAtStep(timeline: Timeline, id: string): number {
  return timeline.entries.filter((entry) => atStep(entry.start, id) || atStep(entry.end, id)).length;
}

/**
 * Deletes a step. Its entries move to the step before or after it, or are deleted; a span starting or
 * ending there moves that end, and a span whose two ends then meet becomes an entry at that one step.
 */
export function deleteStep(timeline: Timeline, id: string, disposal: StepDisposal): EditResult<Timeline> {
  const index = timeline.steps.findIndex((step) => step.id === id);
  if (index < 0) return refused("missing");
  const steps = timeline.steps.filter((step) => step.id !== id);
  if (disposal === "delete") {
    return checkedTimeline({
      ...timeline,
      steps,
      entries: timeline.entries.filter((entry) => !atStep(entry.start, id) && !atStep(entry.end, id)),
    });
  }
  const neighbour = timeline.steps[disposal === "before" ? index - 1 : index + 1];
  if (!neighbour) return refused("missing");
  const entries = timeline.entries.map((entry): TimelineEntry => {
    const start = atStep(entry.start, id) ? { step: neighbour.id } : entry.start;
    const end = atStep(entry.end, id) ? { step: neighbour.id } : entry.end;
    const meets = end !== null && "step" in end && "step" in start && end.step === start.step;
    return { ...entry, start, end: meets ? null : end };
  });
  return checkedTimeline({ ...timeline, steps, entries });
}

/** The first colour and line not yet used, in the order solid colours, then dashed, then dotted. */
export function nextLook(categories: readonly TimelineCategory[]): { colour: number; line: TimelineLine } {
  for (const line of TIMELINE_LINES) {
    for (let colour = 0; colour < PALETTE_SIZE; colour += 1) {
      if (!categories.some((category) => category.colour === colour && category.line === line)) return { colour, line };
    }
  }
  return { colour: categories.length % PALETTE_SIZE, line: "solid" };
}

/** Adds a category at the end, in the next free colour and line ({@link nextLook}). */
export function addCategory(timeline: Timeline, id: string, name: string): EditResult<Timeline> {
  const problem = namedProblem(name, timeline.categories, null);
  if (problem) return refused(problem);
  if (timeline.categories.length >= MAX_TIMELINE_CATEGORIES) return refused("limit");
  return checkedTimeline({
    ...timeline,
    categories: [...timeline.categories, { id, name: name.trim(), ...nextLook(timeline.categories) }],
  });
}

/** Renames a category, or changes its colour or line. */
export function updateCategory(timeline: Timeline, category: TimelineCategory): EditResult<Timeline> {
  if (!timeline.categories.some((old) => old.id === category.id)) return refused("missing");
  const problem = namedProblem(category.name, timeline.categories, category.id);
  if (problem) return refused(problem);
  const next = { ...category, name: category.name.trim() };
  return checkedTimeline({
    ...timeline,
    categories: timeline.categories.map((old) => (old.id === category.id ? next : old)),
  });
}

/** Moves a category (a lane) to another place in the order. */
export function moveCategory(timeline: Timeline, id: string, to: number): EditResult<Timeline> {
  const categories = moved(timeline.categories, id, to);
  if (!categories) return refused("missing");
  return checkedTimeline({ ...timeline, categories });
}

export function entriesInCategory(timeline: Timeline, id: string): number {
  return timeline.entries.filter((entry) => entry.categoryId === id).length;
}

/** Deletes a category; its entries move to another category (`moveTo`), or are deleted when it is null. */
export function deleteCategory(timeline: Timeline, id: string, moveTo: string | null): EditResult<Timeline> {
  if (!timeline.categories.some((category) => category.id === id)) return refused("missing");
  if (moveTo !== null && (moveTo === id || !timeline.categories.some((category) => category.id === moveTo)))
    return refused("missing");
  const categories = timeline.categories.filter((category) => category.id !== id);
  const entries =
    moveTo === null
      ? timeline.entries.filter((entry) => entry.categoryId !== id)
      : timeline.entries.map((entry) => (entry.categoryId === id ? { ...entry, categoryId: moveTo } : entry));
  return checkedTimeline({ ...timeline, categories, entries });
}
