import { describe, expect, it } from "vitest";

import { upperLabels } from "../../../src/gantt/format";
import { fittingLabel, labelWidth } from "../../../src/gantt/scale";
import { setup, task } from "./fixtures";

const MONTHS = ["September 2026", "Sep 2026", "Sep"];

describe("a header label's width", () => {
  it("is reckoned from its characters, a whole em for a wide one, with the cell's border and padding", () => {
    expect(labelWidth("")).toBe(6);
    expect(labelWidth("Sep")).toBe(6 + 3 * 7);
    expect(labelWidth("9月")).toBe(6 + 7 + 11);
  });

  it("chooses the longest label that fits, then shorter ones, then none", () => {
    expect(fittingLabel(MONTHS, 400)).toBe("September 2026");
    expect(fittingLabel(MONTHS, labelWidth("September 2026"))).toBe("September 2026");
    expect(fittingLabel(MONTHS, labelWidth("September 2026") - 1)).toBe("Sep 2026");
    expect(fittingLabel(MONTHS, labelWidth("Sep 2026") - 1)).toBe("Sep");
    expect(fittingLabel(MONTHS, labelWidth("Sep") - 1)).toBeNull();
    expect(fittingLabel(MONTHS, 0)).toBeNull();
    expect(fittingLabel([], 400)).toBeNull();
  });

  it("names a month in full, in short with its year, then in short; a year only by itself", () => {
    expect(upperLabels("2026-09-01", false, "en-US")).toEqual(MONTHS);
    // In the locale, each shorter than the one before (the short forms are the locale's own).
    const french = upperLabels("2026-09-01", false, "fr-FR");
    expect(french[0]).toBe("septembre 2026");
    expect(french[1]!.length).toBeLessThan(french[0]!.length);
    expect(french[2]!.length).toBeLessThan(french[1]!.length);
    expect(upperLabels("2026-01-01", true, "en-US")).toEqual(["2026"]);
  });
});

describe("the header's months", () => {
  // On weeks, from Monday 28 September (two weeks before the task) to Monday 2 November: three days of
  // September (36 pixels), all of October and one day of November (12 pixels).
  const chart = { groups: [], tasks: [task("pour", "Pour", "2026-10-14", "2026-10-15")] };
  const months = () => [...document.querySelectorAll<HTMLElement>(".eh-gantt-header-upper")];

  it("shortens a month that does not fit and leaves out one that does not even then, titled in full", () => {
    setup({ today: "2026-10-14", locale: "en-US" }, chart);
    expect(months().map((cell) => cell.textContent)).toEqual(["Sep", "October 2026", ""]);
    expect(months().map((cell) => cell.title)).toEqual(["September 2026", "", "November 2026"]);
  });

  it("shows every month in full on the day scale, where each has room", () => {
    setup({ today: "2026-10-14", locale: "en-US", scale: "day" }, chart);
    // From 7 October to 23 October.
    expect(months().map((cell) => cell.textContent)).toEqual(["October 2026"]);
    expect(months()[0]).not.toHaveAttribute("title");
  });
});
