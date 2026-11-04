import {
  addDependency,
  dependencyConflicts,
  earliestStart,
  type Gantt,
  type GanttResult,
  ganttDocument,
  ganttProblems,
  ganttSchema,
  parseDocument,
  putGanttTask,
  resizeTask,
  serialiseDocument,
  shiftTask,
} from "../../../src";
import { task } from "./fixtures";

/** The new chart, after checking that it passes its checks and is stored and read back unchanged. */
function value(result: GanttResult): Gantt {
  if (!result.ok) throw new Error(`refused: ${result.reason}`);
  expect(ganttSchema.safeParse(result.value).success).toBe(true);
  expect(ganttProblems(result.value)).toEqual([]);
  expect(parseDocument(ganttDocument, serialiseDocument(ganttDocument, result.value))).toEqual(result.value);
  return result.value;
}

const reason = (result: GanttResult) => (result.ok ? "done" : result.reason);
const taskOf = (gantt: Gantt, id: string) => gantt.tasks.find((one) => one.id === id)!;
const days = (gantt: Gantt, id: string) => [taskOf(gantt, id).start, taskOf(gantt, id).end];
const AUTO = { autoSchedule: true };

/**
 * A chain: Dig, then Pour straight after it, then Frame after a breather of three days, then the Inspection (a
 * milestone) a day after Frame. Apart from it, Order (ending on the 5th) and Deliver, which already starts too
 * early for it.
 */
const SITE: Gantt = {
  groups: [{ id: "later", name: "Later", collapsed: false }],
  tasks: [
    task("dig", "2027-03-01", "2027-03-03"),
    task("pour", "2027-03-04", "2027-03-06", { dependsOn: ["dig"] }),
    task("frame", "2027-03-10", "2027-03-11", { dependsOn: ["pour"] }),
    task("inspect", "2027-03-13", "2027-03-13", { milestone: true, dependsOn: ["frame"] }),
    task("order", "2027-03-01", "2027-03-05"),
    task("deliver", "2027-03-03", "2027-03-04", { dependsOn: ["order"] }),
  ],
};

/** Plan, ending on the calendar's last day but three, and Act, on its last day, depending on it. */
const EDGE: Gantt = {
  groups: [],
  tasks: [
    task("plan", "9999-12-27", "9999-12-28"),
    task("act", "9999-12-31", "9999-12-31", { dependsOn: ["plan"] }),
    task("end", "9999-12-31", "9999-12-31"),
  ],
};

describe("the earliest start", () => {
  it("is the day after the last day of the tasks a task depends on", () => {
    expect(earliestStart(SITE, "dig")).toBeNull();
    expect(earliestStart(SITE, "pour")).toBe("2027-03-04");
    const both = {
      ...SITE,
      tasks: [...SITE.tasks, task("roof", "2027-03-20", "2027-03-21", { dependsOn: ["dig", "order"] })],
    };
    expect(earliestStart(both, "roof")).toBe("2027-03-06");
    expect(earliestStart(SITE, "nowhere")).toBeNull();
    const last = { ...EDGE, tasks: [...EDGE.tasks, task("after", "9999-12-31", "9999-12-31", { dependsOn: ["end"] })] };
    expect(earliestStart(last, "after")).toBeNull();
  });
});

describe("moving a task with Move dependent tasks", () => {
  it("pushes the tasks after it only as far as needed, a breather absorbing the move", () => {
    const moved = value(shiftTask(SITE, "dig", 2, AUTO));
    expect(days(moved, "dig")).toEqual(["2027-03-03", "2027-03-05"]);
    expect(days(moved, "pour")).toEqual(["2027-03-06", "2027-03-08"]);
    expect(taskOf(moved, "frame")).toBe(taskOf(SITE, "frame"));
    expect(taskOf(moved, "inspect")).toBe(taskOf(SITE, "inspect"));
  });

  it("pushes through the chain, milestones included, and leaves other tasks and their conflicts alone", () => {
    const moved = value(shiftTask(SITE, "dig", 5, AUTO));
    expect(days(moved, "pour")).toEqual(["2027-03-09", "2027-03-11"]);
    expect(days(moved, "frame")).toEqual(["2027-03-12", "2027-03-13"]);
    expect(days(moved, "inspect")).toEqual(["2027-03-14", "2027-03-14"]);
    expect(taskOf(moved, "order")).toBe(taskOf(SITE, "order"));
    expect(taskOf(moved, "deliver")).toBe(taskOf(SITE, "deliver"));
    expect(dependencyConflicts(moved)).toEqual([{ taskId: "deliver", predecessorId: "order" }]);
  });

  it("pulls nothing when a task moves earlier", () => {
    const moved = value(shiftTask(SITE, "dig", -2, AUTO));
    expect(days(moved, "dig")).toEqual(["2027-02-27", "2027-03-01"]);
    for (const id of ["pour", "frame", "inspect"]) expect(taskOf(moved, id)).toBe(taskOf(SITE, id));
  });

  it("stops at the day after the tasks it depends on", () => {
    const moved = value(shiftTask(SITE, "frame", -10, AUTO));
    expect(days(moved, "frame")).toEqual(["2027-03-07", "2027-03-08"]);
    expect(taskOf(moved, "inspect")).toBe(taskOf(SITE, "inspect"));
    expect(days(value(shiftTask(SITE, "pour", -1, AUTO)), "pour")).toEqual(["2027-03-04", "2027-03-06"]);
  });

  it("lands a task that starts too early on its earliest day when it moves at all", () => {
    expect(days(value(shiftTask(SITE, "deliver", 1, AUTO)), "deliver")).toEqual(["2027-03-06", "2027-03-07"]);
    expect(days(value(shiftTask(SITE, "deliver", 0, AUTO)), "deliver")).toEqual(["2027-03-03", "2027-03-04"]);
  });

  it("moves only the task without the option, as before", () => {
    for (const options of [undefined, {}, { autoSchedule: false }]) {
      const moved = value(shiftTask(SITE, "dig", 5, options));
      expect(taskOf(moved, "pour")).toBe(taskOf(SITE, "pour"));
      expect(days(value(shiftTask(SITE, "frame", -10, options)), "frame")).toEqual(["2027-02-28", "2027-03-01"]);
    }
  });

  it("is refused when a push or a stop would pass the calendar's last day", () => {
    expect(reason(shiftTask(EDGE, "plan", 3, AUTO))).toBe("invalid");
    expect(days(value(shiftTask(EDGE, "plan", 3)), "act")).toEqual(["9999-12-31", "9999-12-31"]);
    const after = {
      ...EDGE,
      tasks: [...EDGE.tasks, task("after", "9999-12-30", "9999-12-30", { dependsOn: ["end"] })],
    };
    expect(reason(shiftTask(after, "after", -1, AUTO))).toBe("invalid");
    const longer = {
      ...EDGE,
      tasks: [...EDGE.tasks, task("review", "9999-12-29", "9999-12-30", { dependsOn: ["plan"] })],
    };
    expect(reason(shiftTask(longer, "plan", 2, AUTO))).toBe("invalid");
  });

  it("places a task reached by two paths after both of them", () => {
    const seal = task("seal", "2027-03-07", "2027-03-07", { dependsOn: ["dig", "pour"] });
    const moved = value(shiftTask({ ...SITE, tasks: [...SITE.tasks, seal] }, "dig", 2, AUTO));
    expect(days(moved, "pour")).toEqual(["2027-03-06", "2027-03-08"]);
    expect(days(moved, "seal")).toEqual(["2027-03-09", "2027-03-09"]);
  });
});

describe("resizing a task with Move dependent tasks", () => {
  it("stops its start at the day after the tasks it depends on", () => {
    expect(days(value(resizeTask(SITE, "frame", "start", -10, AUTO)), "frame")).toEqual(["2027-03-07", "2027-03-11"]);
    expect(days(value(resizeTask(SITE, "pour", "start", -1, AUTO)), "pour")).toEqual(["2027-03-04", "2027-03-06"]);
    expect(days(value(resizeTask(SITE, "deliver", "start", 0, AUTO)), "deliver")).toEqual(["2027-03-03", "2027-03-04"]);
  });

  it("refuses a start stopped past the end", () => {
    expect(reason(resizeTask(SITE, "deliver", "start", -1, AUTO))).toBe("order");
    expect(reason(resizeTask(SITE, "inspect", "start", -1, AUTO))).toBe("invalid");
  });

  it("pushes the tasks after it when its end moves later, and pulls nothing when it moves earlier", () => {
    const longer = value(resizeTask(SITE, "pour", "end", 4, AUTO));
    expect(days(longer, "frame")).toEqual(["2027-03-11", "2027-03-12"]);
    expect(taskOf(longer, "inspect")).toBe(taskOf(SITE, "inspect"));
    const shorter = value(resizeTask(SITE, "pour", "end", -1, AUTO));
    expect(taskOf(shorter, "frame")).toBe(taskOf(SITE, "frame"));
    expect(taskOf(value(resizeTask(SITE, "pour", "end", 4)), "frame")).toBe(taskOf(SITE, "frame"));
  });

  it("is refused when a stop would pass the calendar's last day", () => {
    const after = {
      ...EDGE,
      tasks: [...EDGE.tasks, task("after", "9999-12-29", "9999-12-30", { dependsOn: ["end"] })],
    };
    expect(reason(resizeTask(after, "after", "start", -1, AUTO))).toBe("invalid");
  });
});

describe("a new dependency with Move dependent tasks", () => {
  it("moves the task after its new predecessor and pushes the tasks after it", () => {
    const linked = value(addDependency(SITE, "dig", "order", AUTO));
    expect(taskOf(linked, "dig")).toMatchObject({ start: "2027-03-06", end: "2027-03-08", dependsOn: ["order"] });
    expect(days(linked, "pour")).toEqual(["2027-03-09", "2027-03-11"]);
    expect(days(linked, "frame")).toEqual(["2027-03-12", "2027-03-13"]);
    expect(days(linked, "inspect")).toEqual(["2027-03-14", "2027-03-14"]);
  });

  it("leaves a task that already starts after it, and moves nothing without the option", () => {
    const linked = value(addDependency(SITE, "frame", "deliver", AUTO));
    expect(days(linked, "frame")).toEqual(["2027-03-10", "2027-03-11"]);
    expect(taskOf(linked, "inspect")).toBe(taskOf(SITE, "inspect"));
    expect(days(value(addDependency(SITE, "dig", "order")), "dig")).toEqual(["2027-03-01", "2027-03-03"]);
  });

  it("keeps the refusals, and refuses a move past the calendar's last day", () => {
    expect(reason(addDependency(SITE, "dig", "inspect", AUTO))).toBe("cycle");
    expect(reason(addDependency(SITE, "dig", "nowhere", AUTO))).toBe("missing");
    expect(reason(addDependency(EDGE, "act", "end", AUTO))).toBe("invalid");
  });
});

describe("saving a task with Move dependent tasks", () => {
  it("starts it after the tasks it now depends on, keeping its length", () => {
    const frame = taskOf(SITE, "frame");
    const saved = value(
      putGanttTask(SITE, { ...frame, start: "2027-03-02", end: "2027-03-03", dependsOn: ["pour", "order"] }, AUTO),
    );
    expect(taskOf(saved, "frame")).toMatchObject({ start: "2027-03-07", end: "2027-03-08" });
    expect(taskOf(saved, "inspect")).toBe(taskOf(SITE, "inspect"));
    const deliver = taskOf(SITE, "deliver");
    // A save that changes neither its days nor its dependencies leaves a task already starting too early as it is.
    expect(days(value(putGanttTask(SITE, { ...deliver, name: "Deliveries" }, AUTO)), "deliver")).toEqual([
      "2027-03-03",
      "2027-03-04",
    ]);
    expect(
      days(value(putGanttTask(SITE, { ...deliver, start: "2027-03-02", end: "2027-03-03" }, AUTO)), "deliver"),
    ).toEqual(["2027-03-06", "2027-03-07"]);
  });

  it("pushes the tasks after it, in its group or another", () => {
    const pour = taskOf(SITE, "pour");
    const longer = value(putGanttTask(SITE, { ...pour, end: "2027-03-12" }, AUTO));
    expect(days(longer, "frame")).toEqual(["2027-03-13", "2027-03-14"]);
    expect(days(longer, "inspect")).toEqual(["2027-03-15", "2027-03-15"]);
    const regrouped = value(putGanttTask(SITE, { ...pour, groupId: "later", end: "2027-03-10" }, AUTO));
    expect(taskOf(regrouped, "pour").groupId).toBe("later");
    expect(days(regrouped, "frame")).toEqual(["2027-03-11", "2027-03-12"]);
  });

  it("leaves the tasks after it when its days stay, and moves nothing without the option", () => {
    const order = taskOf(SITE, "order");
    expect(taskOf(value(putGanttTask(SITE, { ...order, name: "Orders" }, AUTO)), "deliver")).toBe(
      taskOf(SITE, "deliver"),
    );
    const pour = taskOf(SITE, "pour");
    expect(taskOf(value(putGanttTask(SITE, { ...pour, end: "2027-03-12" })), "frame")).toBe(taskOf(SITE, "frame"));
  });

  it("keeps the refusals, and refuses a move past the calendar's last day", () => {
    const pour = taskOf(SITE, "pour");
    expect(reason(putGanttTask(SITE, { ...pour, groupId: "nowhere" }, AUTO))).toBe("missing");
    expect(reason(putGanttTask(SITE, { ...pour, end: "2027-03-01" }, AUTO))).toBe("order");
    const act = taskOf(EDGE, "act");
    expect(reason(putGanttTask(EDGE, { ...act, dependsOn: ["plan", "end"] }, AUTO))).toBe("invalid");
  });
});
