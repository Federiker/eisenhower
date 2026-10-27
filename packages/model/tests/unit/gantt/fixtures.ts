import type { Gantt, GanttTask } from "../../../src";

export function task(id: string, start: string, end: string, extra: Partial<GanttTask> = {}): GanttTask {
  return {
    id,
    name: id,
    groupId: null,
    start,
    end,
    milestone: false,
    progress: 0,
    colour: null,
    dependsOn: [],
    ...extra,
  };
}

/**
 * A loose task, two tasks in each of Design and Build, an empty Launch group; Build's first task depends on
 * Sketch, and the release (a milestone) on both of Build's tasks.
 */
export const CHART: Gantt = {
  groups: [
    { id: "design", name: "Design", collapsed: false },
    { id: "build", name: "Build", collapsed: false },
    { id: "launch", name: "Launch", collapsed: false },
  ],
  tasks: [
    task("brief", "2026-11-02", "2026-11-03"),
    task("sketch", "2026-11-04", "2026-11-06", { groupId: "design", progress: 50, colour: 1 }),
    task("review", "2026-11-09", "2026-11-09", { groupId: "design" }),
    task("frame", "2026-11-09", "2026-11-13", { groupId: "build", dependsOn: ["sketch"] }),
    task("paint", "2026-11-16", "2026-11-20", { groupId: "build" }),
    task("release", "2026-11-23", "2026-11-23", { milestone: true, dependsOn: ["frame", "paint"] }),
  ],
};

/** The rows as names: the loose tasks, then each group's name and its tasks. */
export function layout(gantt: Gantt): string[][] {
  return [null, ...gantt.groups.map((group) => group.id)].map((id) => [
    id === null ? "-" : gantt.groups.find((group) => group.id === id)!.name,
    ...gantt.tasks.filter((one) => one.groupId === id).map((one) => one.id),
  ]);
}
