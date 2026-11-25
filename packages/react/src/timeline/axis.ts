import type { Timeline } from "@eisenhower/model";

import { type DateWords, formatDate, monthName } from "./format";
import { civilDate, precisionOfScale, type Scale, ticksOf, xOf } from "./scale";

/** A labelled place on the axis: its main label and, where the larger unit changes, that unit. */
export type AxisTick = { x: number; main: string; context: string | null; centred: boolean };

/** The most an axis label's character takes, at the views' own text size (11px), and the room after it. */
const AXIS_CHARACTER = 7;
const AXIS_GAP = 12;

/** The room a context label ("November 1890") takes on the axis, generously, at a text size. */
const contextWidth = (context: string, text: number) => ([...context].length * AXIS_CHARACTER + AXIS_GAP) * text;

/** A collapsed stretch: where its break is, and the years on either side of it. */
export type AxisBreak = { x: number; width: number; before: string; after: string };

/**
 * The axis as drawn and exported: step names in the middle of their columns (Sequence), or ticks as fine as
 * the scale allows (Dates) with the year at the first month and each January, the month at the first day
 * and each 1st; and the breaks with the years either side.
 */
export function axisOf(
  timeline: Timeline,
  scale: Scale,
  showCe: boolean,
  words: DateWords,
): { ticks: AxisTick[]; breaks: AxisBreak[] } {
  if (timeline.kind === "sequence") {
    return {
      ticks: timeline.steps.map((step, index) => ({
        x: xOf(scale, index + 0.5),
        main: step.name,
        context: null,
        centred: true,
      })),
      breaks: [],
    };
  }
  const precision = precisionOfScale(scale);
  const ticks = ticksOf(scale).map((tick, index): AxisTick => {
    const { date } = tick;
    const main =
      precision.unit === "year"
        ? formatDate(date, showCe, words)
        : precision.unit === "month"
          ? monthName(date.month!, words.locale)
          : String(date.day);
    const context =
      precision.unit === "month" && (date.month === 1 || index === 0)
        ? formatDate({ ...date, month: null }, showCe, words)
        : precision.unit === "day" && (date.day === 1 || index === 0)
          ? formatDate({ ...date, day: null }, showCe, words)
          : null;
    return { x: xOf(scale, tick.value), main, context, centred: false };
  });
  // The first tick's unit (a year or a month) is written even when it is not the unit's first tick, so the next
  // unit's may follow it closely: then only the later one is written, which would otherwise be overlapped.
  const contexts = ticks.filter((tick) => tick.context !== null);
  contexts.forEach((tick, index) => {
    const next = contexts[index + 1];
    if (next && tick.x + contextWidth(tick.context!, scale.text) > next.x) tick.context = null;
  });
  const year = (value: number) =>
    formatDate({ year: civilDate(value).year, month: null, day: null, approximate: false }, showCe, words);
  const breaks = scale.segments
    .filter((segment) => segment.collapsed)
    .map((segment) => {
      const [last, next] = segment.edges ?? [segment.from, segment.to];
      return { x: segment.x, width: segment.width, before: year(last), after: year(next) };
    });
  return { ticks, breaks };
}
