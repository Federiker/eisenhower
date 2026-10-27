import { sortedEntries, type Timeline, type TimelinePoint } from "@eisenhower/model";

import { PALETTE } from "../theme/palette";
import { axisOf } from "./axis";
import { type DateWords, formatPoint, hasBce } from "./format";
import { LANE_PADDING, lanesOf, MARK_Y, ROW_HEIGHT } from "./layout";
import { scaleOf, xOf } from "./scale";

/** A point in ISO 8601 form, which sorts as text: 1066-10-14, -0399 (400 BCE), +12000; a step's number in a Sequence. */
export function sortablePoint(point: TimelinePoint, timeline: Timeline): string {
  if ("step" in point) return String(timeline.steps.findIndex((step) => step.id === point.step) + 1);
  const { year } = point;
  const figures = String(Math.abs(year)).padStart(4, "0");
  const written = year < 0 ? `-${figures}` : year > 9999 ? `+${figures}` : figures;
  const two = (value: number) => String(value).padStart(2, "0");
  return [written, point.month === null ? null : two(point.month), point.day === null ? null : two(point.day)]
    .filter((part) => part !== null)
    .join("-");
}

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * The entries as a table (RFC 4180, UTF-8 with a byte-order mark so spreadsheets read every script), one
 * row per entry in time order: title, category, start and end as shown, summary, then start and end in a
 * form that sorts (ISO 8601, or the step's number). The host saves it where it likes.
 */
export function timelineCsv(timeline: Timeline, words: DateWords): string {
  const { t } = words;
  const showCe = hasBce(timeline);
  const categories = new Map(timeline.categories.map((category) => [category.id, category.name]));
  const head = [
    t("timeline.entry.title"),
    t("timeline.entry.category"),
    t("timeline.csv.start"),
    t("timeline.csv.end"),
    t("timeline.entry.summary"),
    t("timeline.csv.startSortable"),
    t("timeline.csv.endSortable"),
  ];
  const rows = sortedEntries(timeline).map((entry) => [
    entry.title,
    categories.get(entry.categoryId) ?? "",
    formatPoint(entry.start, timeline, showCe, words),
    entry.end === null ? "" : formatPoint(entry.end, timeline, showCe, words),
    entry.summary,
    sortablePoint(entry.start, timeline),
    entry.end === null ? "" : sortablePoint(entry.end, timeline),
  ]);
  return `﻿${[head, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n")}\r\n`;
}

const xml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const DASHES = { solid: "", dashed: ` stroke-dasharray="8 5"`, dotted: ` stroke-dasharray="2 5"` } as const;
const NAMES = 160;
const MARGIN = 24;
const TITLE = 40;
const AXIS = 44;
// The light theme's colours (theme.css), as an image is read on white.
const INK = "#28342d";
const MUTED = "#59675d";
const LINE = "#dce2d9";
const BREAK = "#edf0ea";

/**
 * The whole drawing as a stand-alone SVG image at a zoom (fitted to `width`): `name` (the host's name for
 * the timeline) as its title, the axis, lane names, lines, marks and every title in full, in the light
 * colours on white, with the system's sans-serif font. Empty when there is nothing to draw.
 */
export function timelineSvg(timeline: Timeline, name: string, width: number, zoom: number, words: DateWords): string {
  const scale = scaleOf(timeline, width, zoom);
  if (!scale) return "";
  const showCe = hasBce(timeline);
  const top = TITLE + AXIS;
  const lanes = lanesOf(timeline, scale, top, Number.POSITIVE_INFINITY);
  const plane =
    Math.max(scale.width, ...lanes.flatMap((lane) => lane.entries.map((placed) => placed.labelX + placed.labelWidth))) +
    MARGIN * 2;
  const total = NAMES + plane;
  const last = lanes.at(-1);
  const height = (last ? last.top + last.height : top) + 16;
  const at = (x: number) => NAMES + MARGIN + x;
  const { ticks, breaks } = axisOf(timeline, scale, showCe, words);
  const parts: string[] = [];
  parts.push(`<rect width="${total}" height="${height}" fill="#ffffff"/>`);
  parts.push(`<text x="16" y="26" font-size="16" font-weight="600" fill="${INK}">${xml(name)}</text>`);
  for (const gap of breaks) {
    parts.push(`<rect x="${at(gap.x)}" y="${TITLE}" width="${gap.width}" height="${height - TITLE}" fill="${BREAK}"/>`);
    parts.push(
      `<path d="M ${at(gap.x) + 8} ${top - 4} l 6 -6 l 6 12 l 6 -6" fill="none" stroke="${MUTED}" stroke-width="1.5"/>`,
    );
    parts.push(
      `<text x="${at(gap.x) - 2}" y="${top - 12}" font-size="11" fill="${MUTED}" text-anchor="end">${xml(gap.before)}</text>`,
    );
    parts.push(
      `<text x="${at(gap.x + gap.width) + 2}" y="${top - 12}" font-size="11" fill="${MUTED}">${xml(gap.after)}</text>`,
    );
  }
  for (const tick of ticks) {
    const line = timeline.kind === "sequence" ? tick.x - scale.unit / 2 : tick.x;
    parts.push(`<line x1="${at(line)}" x2="${at(line)}" y1="${top - 8}" y2="${top}" stroke="${MUTED}"/>`);
    parts.push(
      tick.centred
        ? `<text x="${at(tick.x)}" y="${top - 16}" font-size="11" fill="${INK}" text-anchor="middle">${xml(tick.main)}</text>`
        : `<text x="${at(tick.x) + 3}" y="${top - 26}" font-size="11" fill="${INK}">${xml(tick.main)}</text>`,
    );
    if (tick.context)
      parts.push(
        `<text x="${at(tick.x) + 3}" y="${top - 12}" font-size="11" fill="${MUTED}">${xml(tick.context)}</text>`,
      );
  }
  for (const lane of lanes) {
    const colour = PALETTE[lane.category.colour]!.light;
    const dash = DASHES[lane.category.line];
    const lineY = lane.top + LANE_PADDING + MARK_Y;
    parts.push(`<line x1="0" x2="${total}" y1="${lane.top}" y2="${lane.top}" stroke="${LINE}"/>`);
    parts.push(
      `<line x1="12" x2="40" y1="${lane.top + lane.height / 2}" y2="${lane.top + lane.height / 2}" stroke="${colour}" stroke-width="4"${dash}/>`,
    );
    parts.push(
      `<text x="48" y="${lane.top + lane.height / 2 + 4}" font-size="13" fill="${INK}">${xml(lane.category.name)}</text>`,
    );
    parts.push(
      `<line x1="${at(0)}" x2="${NAMES + plane - MARGIN}" y1="${lineY}" y2="${lineY}" stroke="${colour}" stroke-width="1.5" stroke-opacity="0.45"${dash}/>`,
    );
    for (const placed of lane.entries) {
      const rowTop = lane.top + LANE_PADDING + placed.row * ROW_HEIGHT;
      const y = rowTop + MARK_Y;
      const { entry, extent } = placed;
      const approximate = (point: TimelinePoint | null) =>
        point !== null && "approximate" in point && point.approximate;
      const hollow = (x: number) =>
        `<circle cx="${at(x)}" cy="${y}" r="5" fill="#ffffff" stroke="${colour}" stroke-width="2" stroke-dasharray="2 2"/>`;
      if (extent.band && xOf(scale, extent.band[1]) - xOf(scale, extent.band[0]) >= 4) {
        parts.push(
          `<rect x="${at(xOf(scale, extent.band[0]))}" y="${y - 7}" width="${xOf(scale, extent.band[1]) - xOf(scale, extent.band[0])}" height="14" fill="${colour}" fill-opacity="0.18"/>`,
        );
      }
      if (extent.marker !== null) {
        parts.push(
          approximate(entry.start)
            ? hollow(placed.x1)
            : `<circle cx="${at(placed.x1)}" cy="${y}" r="5" fill="${colour}"/>`,
        );
      } else {
        parts.push(
          `<line x1="${at(placed.x1)}" x2="${at(Math.max(placed.x2, placed.x1 + 2))}" y1="${y}" y2="${y}" stroke="${colour}" stroke-width="6" stroke-linecap="round"${dash}/>`,
        );
        if (approximate(entry.start)) parts.push(hollow(placed.x1));
        if (approximate(entry.end)) parts.push(hollow(placed.x2));
      }
      parts.push(
        `<text x="${at(placed.labelX) + 4}" y="${rowTop + 13}" font-size="12" fill="${INK}">${xml(entry.title)}</text>`,
      );
    }
  }
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${height}" viewBox="0 0 ${total} ${height}" ` +
    `font-family="system-ui, sans-serif">\n` +
    `<title>${xml(name)}</title>\n${parts.join("\n")}\n</svg>\n`
  );
}
