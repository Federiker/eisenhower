import {
  DocumentError,
  emptyGantt,
  type Gantt,
  ganttDocument,
  ganttProblems,
  ganttSchema,
  MAX_GANTT_TASKS,
  parseDocument,
  serialiseDocument,
} from "../../../src";
import { CHART, task } from "./fixtures";

const problemsOf = (change: (gantt: Gantt) => Gantt) => ganttProblems(change(structuredClone(CHART)));

describe("the gantt chart's document", () => {
  it("is sound as invented, and round-trips through its text", () => {
    expect(ganttSchema.safeParse(CHART).success).toBe(true);
    expect(ganttProblems(CHART)).toEqual([]);
    const text = serialiseDocument(ganttDocument, CHART);
    expect(JSON.parse(text)).toMatchObject({ format: "eisenhower", kind: "gantt", version: 1 });
    expect(parseDocument(ganttDocument, text)).toEqual(CHART);
    expect(parseDocument(ganttDocument, serialiseDocument(ganttDocument, emptyGantt()))).toEqual(emptyGantt());
  });

  it("refuses what its schema does not allow", () => {
    const invalid = (data: unknown) => ganttSchema.safeParse(data).success;
    expect(invalid({ groups: [], tasks: [], extra: 1 })).toBe(false);
    expect(invalid({ groups: [{ id: "a", name: " padded ", collapsed: false }], tasks: [] })).toBe(false);
    expect(invalid({ groups: [{ id: "a", name: "", collapsed: false }], tasks: [] })).toBe(false);
    expect(invalid({ groups: [], tasks: [task("a", "2026-02-30", "2026-03-01")] })).toBe(false);
    expect(invalid({ groups: [], tasks: [task("a", "2026-03-01", "2026-03-01", { progress: 101 })] })).toBe(false);
    expect(invalid({ groups: [], tasks: [task("a", "2026-03-01", "2026-03-01", { progress: 2.5 })] })).toBe(false);
    expect(invalid({ groups: [], tasks: [task("a", "2026-03-01", "2026-03-01", { colour: 8 })] })).toBe(false);
    const many = Array.from({ length: MAX_GANTT_TASKS + 1 }, (_, n) => task(`t${n}`, "2026-03-01", "2026-03-01"));
    expect(invalid({ groups: [], tasks: many })).toBe(false);
  });

  it("names every problem its schema cannot see", () => {
    expect(problemsOf((g) => ({ ...g, groups: [...g.groups, g.groups[0]!] }))).toEqual(["two groups have the same id"]);
    expect(problemsOf((g) => ({ ...g, tasks: [...g.tasks, g.tasks[0]!] }))).toEqual(["two tasks have the same id"]);
    expect(problemsOf((g) => ({ ...g, groups: g.groups.slice(1) }))).toEqual([
      "task sketch is in a missing group",
      "task review is in a missing group",
    ]);
    expect(problemsOf((g) => ({ ...g, tasks: [task("a", "2026-03-02", "2026-03-01")] }))).toEqual([
      "task a ends before it starts",
    ]);
    expect(problemsOf((g) => ({ ...g, tasks: [task("a", "2026-03-01", "2026-03-02", { milestone: true })] }))).toEqual([
      "milestone a does not start and end the same day",
    ]);
    expect(problemsOf((g) => ({ ...g, tasks: [task("a", "2026-03-01", "2026-03-01", { dependsOn: ["a"] })] }))).toEqual(
      ["task a depends on itself"],
    );
    expect(
      problemsOf((g) => ({
        ...g,
        tasks: [
          task("a", "2026-03-01", "2026-03-01"),
          task("b", "2026-03-02", "2026-03-02", { dependsOn: ["a", "a"] }),
        ],
      })),
    ).toEqual(["task b names a dependency twice"]);
    expect(problemsOf((g) => ({ ...g, tasks: [task("a", "2026-03-01", "2026-03-01", { dependsOn: ["z"] })] }))).toEqual(
      ["task a depends on a missing task z"],
    );
    expect(
      problemsOf((g) => ({
        ...g,
        tasks: [
          task("a", "2026-03-01", "2026-03-01", { dependsOn: ["c"] }),
          task("b", "2026-03-02", "2026-03-02", { dependsOn: ["a"] }),
          task("c", "2026-03-03", "2026-03-03", { dependsOn: ["b"] }),
        ],
      })),
    ).toEqual(["the dependencies go round in a cycle through task a"]);
  });

  it("is refused whole when its checks fail", () => {
    const text = serialiseDocument(ganttDocument, { groups: [], tasks: [task("a", "2026-03-02", "2026-03-01")] });
    expect(() => parseDocument(ganttDocument, text)).toThrow(DocumentError);
  });

  it("finds a cycle in a long chain without running out of stack", () => {
    const chain = Array.from({ length: MAX_GANTT_TASKS }, (_, n) =>
      task(`t${n}`, "2026-03-01", "2026-03-01", { dependsOn: n === 0 ? [`t${MAX_GANTT_TASKS - 1}`] : [`t${n - 1}`] }),
    );
    expect(ganttProblems({ groups: [], tasks: chain })).toHaveLength(1);
  });
});
