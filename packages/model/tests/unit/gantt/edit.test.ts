import {
  addDependency,
  addGanttGroup,
  addGanttTask,
  blankGanttTask,
  canDependOn,
  deleteGanttGroup,
  deleteGanttTask,
  type Gantt,
  type GanttResult,
  ganttDocument,
  MAX_DEPENDENCIES,
  MAX_GANTT_GROUPS,
  MAX_GANTT_TASKS,
  moveGanttGroup,
  moveGanttTask,
  parseDocument,
  putGanttTask,
  removeDependency,
  renameGanttGroup,
  renameGanttTask,
  resizeTask,
  serialiseDocument,
  setGanttGroupCollapsed,
  setTaskProgress,
  shiftTask,
  tasksInGanttGroup,
  toggleGanttGroup,
} from "../../../src";
import { CHART, layout, task } from "./fixtures";

/** The new chart, after checking that it is stored and read back unchanged. */
function value(result: GanttResult): Gantt {
  if (!result.ok) throw new Error(`refused: ${result.reason}`);
  expect(parseDocument(ganttDocument, serialiseDocument(ganttDocument, result.value))).toEqual(result.value);
  return result.value;
}

const reason = (result: GanttResult) => (result.ok ? "done" : result.reason);
const taskOf = (gantt: Gantt, id: string) => gantt.tasks.find((one) => one.id === id)!;

describe("groups", () => {
  it("are added, at the end or at a place, with a trimmed name", () => {
    const added = value(addGanttGroup(CHART, "test", "  Test  "));
    expect(added.groups.at(-1)).toEqual({ id: "test", name: "Test", collapsed: false });
    expect(value(addGanttGroup(CHART, "first", "First", 0)).groups[0]!.id).toBe("first");
    expect(reason(addGanttGroup(CHART, "x", "   "))).toBe("blank");
    expect(reason(addGanttGroup(CHART, "x", "x".repeat(121)))).toBe("tooLong");
    expect(reason(addGanttGroup(CHART, "design", "Again"))).toBe("duplicate");
    const full: Gantt = {
      groups: Array.from({ length: MAX_GANTT_GROUPS }, (_, n) => ({ id: `g${n}`, name: `G${n}`, collapsed: false })),
      tasks: [],
    };
    expect(reason(addGanttGroup(full, "one", "One more"))).toBe("limit");
  });

  it("are renamed", () => {
    expect(value(renameGanttGroup(CHART, "build", " Make ")).groups[1]!.name).toBe("Make");
    expect(reason(renameGanttGroup(CHART, "build", ""))).toBe("blank");
    expect(reason(renameGanttGroup(CHART, "nowhere", "Name"))).toBe("missing");
  });

  it("move with their tasks", () => {
    const moved = value(moveGanttGroup(CHART, "launch", 0));
    expect(layout(moved)).toEqual([
      ["-", "brief", "release"],
      ["Launch"],
      ["Design", "sketch", "review"],
      ["Build", "frame", "paint"],
    ]);
    expect(value(moveGanttGroup(CHART, "design", 99)).groups.at(-1)!.id).toBe("design");
    expect(reason(moveGanttGroup(CHART, "nowhere", 0))).toBe("missing");
  });

  it("collapse and expand", () => {
    const folded = value(toggleGanttGroup(CHART, "design"));
    expect(folded.groups[0]!.collapsed).toBe(true);
    expect(value(toggleGanttGroup(folded, "design")).groups[0]!.collapsed).toBe(false);
    expect(value(setGanttGroupCollapsed(CHART, "build", true)).groups[1]!.collapsed).toBe(true);
    expect(reason(toggleGanttGroup(CHART, "nowhere"))).toBe("missing");
    expect(reason(setGanttGroupCollapsed(CHART, "nowhere", true))).toBe("missing");
  });

  it("are deleted, their tasks joining a neighbour, going outside or going with them", () => {
    expect(tasksInGanttGroup(CHART, "build")).toBe(2);
    expect(layout(value(deleteGanttGroup(CHART, "build", "before")))).toEqual([
      ["-", "brief", "release"],
      ["Design", "sketch", "review", "frame", "paint"],
      ["Launch"],
    ]);
    expect(layout(value(deleteGanttGroup(CHART, "design", "after")))).toEqual([
      ["-", "brief", "release"],
      ["Build", "sketch", "review", "frame", "paint"],
      ["Launch"],
    ]);
    expect(layout(value(deleteGanttGroup(CHART, "design", "outside")))).toEqual([
      ["-", "brief", "release", "sketch", "review"],
      ["Build", "frame", "paint"],
      ["Launch"],
    ]);
    const gone = value(deleteGanttGroup(CHART, "build", "delete"));
    expect(layout(gone)).toEqual([["-", "brief", "release"], ["Design", "sketch", "review"], ["Launch"]]);
    // The release no longer depends on the tasks deleted with Build.
    expect(taskOf(gone, "release").dependsOn).toEqual([]);
    expect(reason(deleteGanttGroup(CHART, "design", "before"))).toBe("missing");
    expect(reason(deleteGanttGroup(CHART, "launch", "after"))).toBe("missing");
    expect(reason(deleteGanttGroup(CHART, "nowhere", "delete"))).toBe("missing");
  });
});

describe("tasks", () => {
  it("are added to their group, at its end or at a place", () => {
    const fresh = blankGanttTask("new", " New ", "2026-12-01", "2026-12-02", "design");
    const added = value(addGanttTask(CHART, fresh));
    expect(layout(added)[1]).toEqual(["Design", "sketch", "review", "new"]);
    expect(taskOf(added, "new")).toEqual({ ...fresh, name: "New" });
    expect(layout(value(addGanttTask(CHART, fresh, 0)))[1]).toEqual(["Design", "new", "sketch", "review"]);
    expect(layout(value(addGanttTask(CHART, { ...fresh, groupId: null }, 1)))[0]).toEqual([
      "-",
      "brief",
      "new",
      "release",
    ]);
  });

  it("are refused when they could not be stored", () => {
    const fresh = blankGanttTask("new", "New", "2026-12-01", "2026-12-02", null);
    expect(reason(addGanttTask(CHART, { ...fresh, name: " " }))).toBe("blank");
    expect(reason(addGanttTask(CHART, { ...fresh, end: "2026-11-30" }))).toBe("order");
    expect(reason(addGanttTask(CHART, { ...fresh, start: "2026-02-30" }))).toBe("invalid");
    expect(reason(addGanttTask(CHART, { ...fresh, milestone: true }))).toBe("invalid");
    expect(reason(addGanttTask(CHART, { ...fresh, progress: 101 }))).toBe("invalid");
    expect(reason(addGanttTask(CHART, { ...fresh, progress: 0.5 }))).toBe("invalid");
    expect(reason(addGanttTask(CHART, { ...fresh, id: "brief" }))).toBe("duplicate");
    expect(reason(addGanttTask(CHART, { ...fresh, groupId: "nowhere" }))).toBe("missing");
    expect(reason(addGanttTask(CHART, { ...fresh, dependsOn: ["nowhere"] }))).toBe("missing");
    expect(reason(addGanttTask(CHART, { ...fresh, dependsOn: ["brief", "brief"] }))).toBe("duplicate");
    expect(reason(addGanttTask(CHART, { ...fresh, dependsOn: ["new"] }))).toBe("cycle");
    const many = Array.from({ length: MAX_DEPENDENCIES + 1 }, (_, n) => `t${n}`);
    expect(reason(addGanttTask(CHART, { ...fresh, dependsOn: many }))).toBe("limit");
    const full: Gantt = {
      groups: [],
      tasks: Array.from({ length: MAX_GANTT_TASKS }, (_, n) => task(`t${n}`, "2026-03-01", "2026-03-01")),
    };
    expect(reason(addGanttTask(full, fresh))).toBe("limit");
  });

  it("are replaced in place, or at the end of another group", () => {
    const sketch = taskOf(CHART, "sketch");
    const edited = value(putGanttTask(CHART, { ...sketch, name: " Sketches ", progress: 80 }));
    expect(taskOf(edited, "sketch")).toMatchObject({ name: "Sketches", progress: 80 });
    expect(layout(edited)[1]).toEqual(["Design", "sketch", "review"]);
    const moved = value(putGanttTask(CHART, { ...sketch, groupId: "build" }));
    expect(layout(moved)[2]).toEqual(["Build", "frame", "paint", "sketch"]);
    // A milestone is one day: its end becomes its start.
    expect(taskOf(value(putGanttTask(CHART, { ...sketch, milestone: true })), "sketch")).toMatchObject({
      start: "2026-11-04",
      end: "2026-11-04",
    });
    expect(reason(putGanttTask(CHART, { ...sketch, id: "nowhere" }))).toBe("missing");
    expect(reason(putGanttTask(CHART, { ...sketch, groupId: "nowhere" }))).toBe("missing");
    expect(reason(putGanttTask(CHART, { ...sketch, dependsOn: ["nowhere"] }))).toBe("missing");
    expect(reason(putGanttTask(CHART, { ...sketch, dependsOn: ["frame"] }))).toBe("cycle");
    expect(reason(putGanttTask(CHART, { ...sketch, dependsOn: ["release"] }))).toBe("cycle");
    expect(taskOf(value(putGanttTask(CHART, { ...sketch, dependsOn: ["brief"] })), "sketch").dependsOn).toEqual([
      "brief",
    ]);
    expect(reason(putGanttTask(CHART, { ...sketch, end: "2026-11-01" }))).toBe("order");
  });

  it("are renamed", () => {
    expect(taskOf(value(renameGanttTask(CHART, "brief", " Briefing ")), "brief").name).toBe("Briefing");
    expect(reason(renameGanttTask(CHART, "brief", ""))).toBe("blank");
    expect(reason(renameGanttTask(CHART, "nowhere", "Name"))).toBe("missing");
  });

  it("are deleted with the dependencies on them", () => {
    const gone = value(deleteGanttTask(CHART, "frame"));
    expect(gone.tasks.map((one) => one.id)).not.toContain("frame");
    expect(taskOf(gone, "release").dependsOn).toEqual(["paint"]);
    expect(reason(deleteGanttTask(CHART, "nowhere"))).toBe("missing");
  });

  it("move in the order and between groups", () => {
    expect(layout(value(moveGanttTask(CHART, "review", "design", 0)))[1]).toEqual(["Design", "review", "sketch"]);
    const across = value(moveGanttTask(CHART, "brief", "launch", 0));
    expect(layout(across)).toEqual([
      ["-", "release"],
      ["Design", "sketch", "review"],
      ["Build", "frame", "paint"],
      ["Launch", "brief"],
    ]);
    expect(taskOf(across, "brief").groupId).toBe("launch");
    // The tasks that did not change are the same objects, so a view draws again only the one that did.
    expect(taskOf(across, "sketch")).toBe(taskOf(CHART, "sketch"));
    expect(taskOf(value(shiftTask(CHART, "brief", 1)), "frame")).toBe(taskOf(CHART, "frame"));
    expect(reason(moveGanttTask(CHART, "nowhere", null, 0))).toBe("missing");
    expect(reason(moveGanttTask(CHART, "brief", "nowhere", 0))).toBe("missing");
  });
});

describe("a task's days", () => {
  it("shift together, keeping the length", () => {
    expect(taskOf(value(shiftTask(CHART, "sketch", 3)), "sketch")).toMatchObject({
      start: "2026-11-07",
      end: "2026-11-09",
    });
    expect(taskOf(value(shiftTask(CHART, "release", -30)), "release")).toMatchObject({
      start: "2026-10-24",
      end: "2026-10-24",
    });
    expect(reason(shiftTask(CHART, "sketch", 0.5))).toBe("invalid");
    expect(reason(shiftTask(CHART, "sketch", 10_000 * 366))).toBe("invalid");
    expect(reason(shiftTask(CHART, "nowhere", 1))).toBe("missing");
  });

  it("resize from either end, never past the other, and never for a milestone", () => {
    expect(taskOf(value(resizeTask(CHART, "sketch", "end", 2)), "sketch").end).toBe("2026-11-08");
    expect(taskOf(value(resizeTask(CHART, "sketch", "start", -1)), "sketch").start).toBe("2026-11-03");
    expect(taskOf(value(resizeTask(CHART, "sketch", "end", -2)), "sketch").end).toBe("2026-11-04");
    expect(reason(resizeTask(CHART, "sketch", "end", -3))).toBe("order");
    expect(reason(resizeTask(CHART, "sketch", "start", 3))).toBe("order");
    expect(reason(resizeTask(CHART, "release", "end", 1))).toBe("invalid");
    expect(reason(resizeTask(CHART, "sketch", "end", 1.5))).toBe("invalid");
    expect(reason(resizeTask({ groups: [], tasks: [task("a", "9999-12-31", "9999-12-31")] }, "a", "end", 1))).toBe(
      "invalid",
    );
    expect(reason(resizeTask(CHART, "nowhere", "end", 1))).toBe("missing");
  });

  it("take a percentage done", () => {
    expect(taskOf(value(setTaskProgress(CHART, "frame", 100)), "frame").progress).toBe(100);
    expect(reason(setTaskProgress(CHART, "frame", -1))).toBe("invalid");
    expect(reason(setTaskProgress(CHART, "frame", 33.3))).toBe("invalid");
    expect(reason(setTaskProgress(CHART, "nowhere", 10))).toBe("missing");
  });
});

describe("dependencies", () => {
  it("are added and removed", () => {
    const linked = value(addDependency(CHART, "paint", "frame"));
    expect(taskOf(linked, "paint").dependsOn).toEqual(["frame"]);
    expect(taskOf(value(removeDependency(linked, "paint", "frame")), "paint").dependsOn).toEqual([]);
    expect(reason(removeDependency(CHART, "paint", "frame"))).toBe("missing");
  });

  it("refuse a cycle, a task on itself, a second time and missing tasks", () => {
    expect(reason(addDependency(CHART, "sketch", "release"))).toBe("cycle");
    expect(reason(addDependency(CHART, "sketch", "sketch"))).toBe("cycle");
    expect(reason(addDependency(CHART, "frame", "sketch"))).toBe("duplicate");
    expect(reason(addDependency(CHART, "frame", "nowhere"))).toBe("missing");
    expect(reason(addDependency(CHART, "nowhere", "frame"))).toBe("missing");
    expect(canDependOn(CHART, "sketch", "release")).toBe(false);
    expect(canDependOn(CHART, "sketch", "sketch")).toBe(false);
    expect(canDependOn(CHART, "paint", "frame")).toBe(true);
  });

  it("stop at the most a task may have", () => {
    const others = Array.from({ length: MAX_DEPENDENCIES + 1 }, (_, n) => task(`t${n}`, "2026-03-01", "2026-03-01"));
    const busy = task("busy", "2026-04-01", "2026-04-01", {
      dependsOn: others.slice(0, MAX_DEPENDENCIES).map((one) => one.id),
    });
    expect(reason(addDependency({ groups: [], tasks: [...others, busy] }, "busy", `t${MAX_DEPENDENCIES}`))).toBe(
      "limit",
    );
  });
});
