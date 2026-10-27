import { sortedEntries, type Timeline, type TimelineCategory, type TimelineEntry } from "@eisenhower/model";

import { type Extent, extentOf, type Scale, xOf } from "./scale";

/** The height of one row of a lane, and the room above the first. */
export const ROW_HEIGHT = 36;
/** Within a row: the label at the top, the marker or bar below it. */
export const LABEL_HEIGHT = 18;
export const MARK_Y = 26;
export const LANE_PADDING = 8;
/** The most room a label takes beside its marker; longer titles end in an ellipsis. */
export const MAX_LABEL_WIDTH = 180;
/** A rough width per character of the drawing's labels, to reserve room before they are measured. */
const CHARACTER_WIDTH = 7;
const MARKER_ROOM = 6;
const GAP = 8;

/** An entry placed on the drawing: its row in its lane, where its marker or bar is, and its label's room. */
export type PlacedEntry = {
  entry: TimelineEntry;
  extent: Extent;
  row: number;
  /** Where the marker is, or the bar runs. */
  x1: number;
  x2: number;
  /** Where the label starts and how wide it may be. */
  labelX: number;
  labelWidth: number;
};

export type Lane = { category: TimelineCategory; top: number; height: number; rows: number; entries: PlacedEntry[] };

/**
 * The lanes of a drawing, one per category in order, each with its entries in rows so that nothing
 * overlaps: an entry takes the first row where its label (above it) and its marker or bar fit after what
 * is already there. A label has room for its title up to `maxLabel` ({@link MAX_LABEL_WIDTH} on screen, where a
 * longer one ends in an ellipsis; without limit in an exported image).
 */
export function lanesOf(timeline: Timeline, scale: Scale, top: number, maxLabel = MAX_LABEL_WIDTH): Lane[] {
  const placed = new Map<string, PlacedEntry[]>(timeline.categories.map((category) => [category.id, []]));
  const rowEnds = new Map<string, number[]>();
  for (const entry of sortedEntries(timeline)) {
    const extent = extentOf(entry, timeline);
    const list = placed.get(entry.categoryId);
    if (!extent || !list) continue;
    const x1 = xOf(scale, extent.from);
    const x2 = xOf(scale, extent.to);
    const labelX = extent.marker === null ? x1 : x1 - MARKER_ROOM;
    const wanted = Math.min(maxLabel, [...entry.title].length * CHARACTER_WIDTH + 12);
    const end = Math.max(x2, labelX + wanted);
    const ends = rowEnds.get(entry.categoryId) ?? [];
    let row = ends.findIndex((last) => last + GAP <= labelX);
    if (row < 0) row = ends.length;
    ends[row] = end;
    rowEnds.set(entry.categoryId, ends);
    list.push({ entry, extent, row, x1, x2, labelX, labelWidth: wanted });
  }
  let y = top;
  return timeline.categories.map((category) => {
    const entries = placed.get(category.id) ?? [];
    const rows = Math.max(1, ...entries.map((each) => each.row + 1));
    const height = rows * ROW_HEIGHT + LANE_PADDING * 2;
    const lane = { category, top: y, height, rows, entries };
    y += height;
    return lane;
  });
}
