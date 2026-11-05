import { describe, expect, it } from "vitest";

import {
  blankGanttTask,
  ganttDocument,
  ganttRows,
  groupProgress,
  ganttProblems,
  ganttSchema,
  parseDocument,
  serialiseDocument,
  setGanttGroupColour,
} from "../../../src";
import { CHART, task } from "./fixtures";

const value = <T>(result: { ok: true; value: T } | { ok: false; reason: string }): T => {
  if (!result.ok) throw new Error(result.reason);
  return result.value;
};

describe("a gantt group's colour", () => {
  it("is optional: a version 1 document written without it reads as it is", () => {
    const read = parseDocument(ganttDocument, serialiseDocument(ganttDocument, CHART));
    expect(read).toEqual(CHART);
    expect("colour" in read.groups[0]!).toBe(false);
  });

  it("is set, changed and taken away, the field left out without one", () => {
    const coloured = value(setGanttGroupColour(CHART, "build", 4));
    expect(coloured.groups[1]).toEqual({ id: "build", name: "Build", collapsed: false, colour: 4 });
    expect(coloured.groups[0]).toBe(CHART.groups[0]);
    expect(coloured.tasks).toBe(CHART.tasks);
    expect(value(setGanttGroupColour(coloured, "build", 2)).groups[1]!.colour).toBe(2);
    const plain = value(setGanttGroupColour(coloured, "build", null));
    expect(plain.groups[1]).toEqual({ id: "build", name: "Build", collapsed: false });
    expect(parseDocument(ganttDocument, serialiseDocument(ganttDocument, coloured))).toEqual(coloured);
  });

  it("refuses a group that is not there and a colour outside the palette", () => {
    expect(setGanttGroupColour(CHART, "gone", 1)).toEqual({ ok: false, reason: "missing" });
    expect(setGanttGroupColour(CHART, "build", 8)).toEqual({ ok: false, reason: "invalid" });
    expect(setGanttGroupColour(CHART, "build", 1.5)).toEqual({ ok: false, reason: "invalid" });
    const bad = { ...CHART, groups: [{ ...CHART.groups[0]!, colour: 99 }] };
    expect(ganttSchema.safeParse(bad).success).toBe(false);
  });

  it("is a new task's colour when it is given one, none otherwise", () => {
    expect(blankGanttTask("t", "Dig", "2026-11-02", "2026-11-03", "build", 4).colour).toBe(4);
    expect(blankGanttTask("t", "Dig", "2026-11-02", "2026-11-03", null).colour).toBeNull();
    expect(ganttProblems(value(setGanttGroupColour(CHART, "design", 0)))).toEqual([]);
  });
});

describe("a gantt group's progress", () => {
  it("is weighted by the tasks' lengths, a milestone counting as a day, and rounded", () => {
    const chart = {
      groups: [{ id: "g", name: "G", collapsed: false }],
      tasks: [
        task("long", "2026-11-02", "2026-11-11", { groupId: "g", progress: 50 }),
        task("short", "2026-11-12", "2026-11-12", { groupId: "g", progress: 100 }),
        task("gate", "2026-11-13", "2026-11-13", { groupId: "g", milestone: true, progress: 0 }),
        task("loose", "2026-11-02", "2026-11-30", { progress: 100 }),
      ],
    };
    // (10 × 50 + 1 × 100 + 1 × 0) / 12 = 50.
    expect(groupProgress(chart, "g")).toBe(50);
    expect(groupProgress(CHART, "launch")).toBeNull();
    expect(groupProgress(CHART, "missing")).toBeNull();
  });

  it("is on each group's row", () => {
    const rows = ganttRows(CHART);
    const design = rows.find((row) => row.kind === "group" && row.group.id === "design");
    expect(design).toMatchObject({ progress: groupProgress(CHART, "design") });
  });
});
