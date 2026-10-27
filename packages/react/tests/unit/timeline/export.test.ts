import type { Timeline } from "@eisenhower/model";
import { describe, expect, it } from "vitest";

import {
  createTranslate,
  formatTimelineDate,
  formatTimelineWhen,
  PALETTE,
  sortablePoint,
  timelineCsv,
  timelineSvg,
} from "../../../src";
import { axisOf } from "../../../src/timeline/axis";
import { monthName, monthNames } from "../../../src/timeline/format";
import { scaleOf } from "../../../src/timeline/scale";
import { acts, d, dated, e, id } from "./fixtures";

const t = createTranslate();
const words = { t, locale: "en-GB" };

const port: Timeline = dated(
  [
    e(21, d(1086), null, id(10), { summary: 'A survey, "great" and small' }),
    e(20, d(1066, 10, 14), null, id(10), { title: "The harbour opens, and a very long title runs on and on" }),
    e(22, d(-42, null, null, true), d(410), id(10), { title: "Old wall" }),
  ],
  [{ id: id(10), name: "Ships & boats", colour: 3, line: "dashed" }],
);

// Copied from jerome's timeline-entries.test.ts and timeline-export.test.tsx, made generic.
describe("dates as shown", () => {
  it("are in the messages' order with c., BCE always and CE only beside BCE dates, month names from Intl", () => {
    expect(formatTimelineDate(d(1066, 10, 14), false, words)).toBe("14 October 1066");
    expect(formatTimelineDate(d(1066, 3), true, words)).toBe("March 1066 CE");
    expect(formatTimelineDate(d(-399, null, null, true), false, words)).toBe("c. 400 BCE");
    expect(formatTimelineDate(d(0), false, words)).toBe("1 BCE");
    expect(formatTimelineDate(d(-11_999), false, words)).toBe("12,000 BCE");
    expect(formatTimelineDate(d(1066, 3), false, { t, locale: "fr-FR" })).toBe("mars 1066");
    expect(formatTimelineDate(d(12_000), false, { t, locale: "de-DE" })).toBe("12.000");
    expect(monthNames("en-GB")).toHaveLength(12);
    expect(monthName(13, "en-GB")).toBe("13");
    const timeline = port;
    expect(formatTimelineWhen(timeline.entries[2]!, timeline, true, words)).toBe("c. 43 BCE – 410 CE");
  });
});

describe("a timeline's table", () => {
  it("lists entries in time order, as shown and in a form that sorts, ready for any spreadsheet", () => {
    const csv = timelineCsv(port, words);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Title,Category,Start,End,Summary,Start (sortable),End (sortable)");
    expect(lines[1]).toBe("Old wall,Ships & boats,c. 43 BCE,410 CE,,-0042,0410");
    expect(lines[2]).toBe(
      `"The harbour opens, and a very long title runs on and on",Ships & boats,14 October 1066 CE,,,1066-10-14,`,
    );
    expect(lines[3]).toBe(`Entry 21,Ships & boats,1086 CE,,"A survey, ""great"" and small",1086,`);
    expect(lines[4]).toBe("");
    const unknown = { ...port, entries: [e(30, d(5), null, id(99))] };
    expect(timelineCsv(unknown, words).split("\r\n")[1]).toBe("Entry 30,,5,,,0005,");
  });

  it("writes years that sort as text, and steps by number", () => {
    expect(sortablePoint(d(-399, 3), port)).toBe("-0399-03");
    expect(sortablePoint(d(12_000), port)).toBe("+12000");
    expect(sortablePoint(d(0), port)).toBe("0000");
    expect(sortablePoint({ step: id(2) }, acts)).toBe("2");
    expect(timelineCsv(acts, words).split("\r\n").slice(1, 3)).toEqual([
      "Pier built,Harbour,Act 1,,,1,",
      "Fleet sails,Ships,Act 1,Act 2,,1,2",
    ]);
  });
});

describe("a timeline's image", () => {
  it("is a stand-alone SVG of the whole drawing with every title in full, in light colours", () => {
    const svg = timelineSvg(port, "Port <draft>", 900, 1, words);
    const document = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(document.querySelector("parsererror")).toBeNull();
    const root = document.documentElement;
    expect(root.querySelector("title")!.textContent).toBe("Port <draft>");
    const texts = [...root.querySelectorAll("text")].map((text) => text.textContent);
    expect(texts).toContain("The harbour opens, and a very long title runs on and on");
    expect(texts).toContain("Ships & boats");
    // The long gap from 410 to 1066 is a break, with the years either side.
    expect(texts).toEqual(expect.arrayContaining(["410 CE", "1066 CE"]));
    expect(root.querySelectorAll("path")).toHaveLength(1);
    expect(svg).toContain(PALETTE[3].light);
    expect(svg).not.toContain(PALETTE[3].dark);
    expect(svg).toContain(`stroke-dasharray="8 5"`);
    expect(svg).toContain(`stroke-dasharray="2 2"`);
    expect(Number(root.getAttribute("width"))).toBeGreaterThan(900);
    expect(timelineSvg({ ...port, entries: [] }, "Empty", 900, 1, words)).toBe("");
  });

  it("draws steps as columns, spans as bars and a whole month as a faint band", () => {
    const svg = timelineSvg(acts, "Acts", 900, 1, words);
    expect(svg).toContain(">Act 2</text>");
    expect(svg).toContain('stroke-width="6"');
    const month = timelineSvg(
      dated([e(20, d(1066, 3), null, id(10), { title: "March" }), e(21, d(1066, 5, 2, true), d(1066, 6, 1, true))]),
      "Months",
      900,
      1,
      words,
    );
    expect(month).toContain('fill-opacity="0.18"');
  });
});

describe("the axis", () => {
  it("names months, with the year at the first and each January, and days with their month", () => {
    const months = dated([e(20, d(1066, 11, 1)), e(21, d(1067, 2, 1))]);
    const axis = axisOf(months, scaleOf(months, 1000, 1)!, false, words);
    expect(axis.ticks.map((tick) => tick.main)).toEqual(expect.arrayContaining(["November", "January"]));
    expect(axis.ticks.find((tick) => tick.main === "January")?.context).toBe("1067");
    const days = dated([e(20, d(1066, 10, 28)), e(21, d(1066, 11, 2))]);
    const dayAxis = axisOf(days, scaleOf(days, 1000, 1)!, false, words);
    expect(dayAxis.ticks.find((tick) => tick.main === "1")?.context).toBe("November 1066");
  });
});
