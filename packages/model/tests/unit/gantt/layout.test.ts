import {
  dependencyConflicts,
  type Gantt,
  ganttRows,
  ganttSections,
  ganttStepTarget,
  ganttTaskPlace,
  groupSpan,
  lateTasks,
} from "../../../src";
import { CHART, task } from "./fixtures";

const rowNames = (gantt: Gantt, collapsed?: ReadonlyMap<string, boolean>) =>
  ganttRows(gantt, collapsed).map((row) => (row.kind === "group" ? `[${row.group.name}]` : row.task.id));

describe("the gantt chart's rows", () => {
  it("puts the tasks outside every group first, then each group with its tasks", () => {
    expect(ganttSections(CHART).map((section) => [section.groupId, section.tasks.map((one) => one.id)])).toEqual([
      [null, ["brief", "release"]],
      ["design", ["sketch", "review"]],
      ["build", ["frame", "paint"]],
      ["launch", []],
    ]);
    expect(rowNames(CHART)).toEqual([
      "brief",
      "release",
      "[Design]",
      "sketch",
      "review",
      "[Build]",
      "frame",
      "paint",
      "[Launch]",
    ]);
  });

  it("hides a collapsed group's tasks, from the chart or from the view's own folding", () => {
    const folded = { ...CHART, groups: CHART.groups.map((group) => ({ ...group, collapsed: group.id === "design" })) };
    expect(rowNames(folded)).toEqual(["brief", "release", "[Design]", "[Build]", "frame", "paint", "[Launch]"]);
    expect(
      rowNames(
        folded,
        new Map([
          ["design", false],
          ["build", true],
        ]),
      ),
    ).toEqual(["brief", "release", "[Design]", "sketch", "review", "[Build]", "[Launch]"]);
    const summary = ganttRows(CHART).find((row) => row.kind === "group" && row.group.id === "build");
    expect(summary).toMatchObject({ span: { start: "2026-11-09", end: "2026-11-20" }, count: 2 });
  });

  it("spans a group's summary from its first day to its last, or not at all when it is empty", () => {
    expect(groupSpan(CHART, "design")).toEqual({ start: "2026-11-04", end: "2026-11-09" });
    expect(groupSpan(CHART, "launch")).toBeNull();
    expect(groupSpan(CHART, "nowhere")).toBeNull();
  });

  it("knows where a task is", () => {
    expect(ganttTaskPlace(CHART, "review")).toEqual({ section: 1, index: 1 });
    expect(ganttTaskPlace(CHART, "missing")).toBeNull();
  });
});

describe("dependency conflicts", () => {
  it("flags a task that starts on or before the last day of a task it depends on", () => {
    expect(dependencyConflicts(CHART)).toEqual([]);
    const early: Gantt = {
      groups: [],
      tasks: [
        task("a", "2026-03-02", "2026-03-04"),
        task("b", "2026-03-04", "2026-03-06", { dependsOn: ["a"] }),
        task("c", "2026-03-05", "2026-03-05", { dependsOn: ["a"] }),
        task("d", "2026-03-01", "2026-03-01", { milestone: true, dependsOn: ["a", "c"] }),
      ],
    };
    expect(dependencyConflicts(early)).toEqual([
      { taskId: "b", predecessorId: "a" },
      { taskId: "d", predecessorId: "a" },
      { taskId: "d", predecessorId: "c" },
    ]);
    expect([...lateTasks(early)]).toEqual(["b", "d"]);
  });
});

describe("a task's steps in the order", () => {
  it("swaps with its neighbour in its section", () => {
    expect(ganttStepTarget(CHART, "review", "up")).toEqual({ groupId: "design", index: 0 });
    expect(ganttStepTarget(CHART, "sketch", "down")).toEqual({ groupId: "design", index: 1 });
  });

  it("crosses into the section above or below at its edges, and stops at the ends", () => {
    expect(ganttStepTarget(CHART, "sketch", "up")).toEqual({ groupId: null, index: 2 });
    expect(ganttStepTarget(CHART, "release", "down")).toEqual({ groupId: "design", index: 0 });
    expect(ganttStepTarget(CHART, "paint", "down")).toEqual({ groupId: "launch", index: 0 });
    expect(ganttStepTarget(CHART, "brief", "up")).toBeNull();
    expect(ganttStepTarget({ groups: [], tasks: [task("a", "2026-03-01", "2026-03-01")] }, "a", "down")).toBeNull();
    expect(ganttStepTarget(CHART, "missing", "up")).toBeNull();
  });
});
