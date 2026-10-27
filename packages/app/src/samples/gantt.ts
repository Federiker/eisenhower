import { addDays, type CalendarDay, type Gantt, type GanttTask } from "@eisenhower/model";

/**
 * An invented gantt chart: launching a small product (a weather station for gardens), around `today` so that
 * the chart opens on it. Three groups, two milestones, dependencies, and one conflict: the press release is
 * planned to start before the copy it depends on is finished.
 */
export function ganttSample(today: CalendarDay): Gantt {
  const day = (offset: number) => addDays(today, offset);
  const task = (
    id: string,
    name: string,
    groupId: string | null,
    start: number,
    end: number,
    extra: Partial<Pick<GanttTask, "milestone" | "progress" | "colour" | "dependsOn">> = {},
  ): GanttTask => ({
    id,
    name,
    groupId,
    start: day(start),
    end: day(end),
    milestone: extra.milestone ?? false,
    progress: extra.progress ?? 0,
    colour: extra.colour ?? null,
    dependsOn: extra.dependsOn ?? [],
  });
  return {
    groups: [
      { id: "g-design", name: "Design", collapsed: false },
      { id: "g-build", name: "Build", collapsed: false },
      { id: "g-launch", name: "Launch", collapsed: false },
    ],
    tasks: [
      task("t-brief", "Write the brief", null, -14, -10, { progress: 100, colour: 7 }),
      task("t-sketch", "Sketch the case", "g-design", -9, -5, { progress: 100, colour: 1, dependsOn: ["t-brief"] }),
      task("t-prototype", "Print a prototype", "g-design", -4, 2, {
        progress: 60,
        colour: 1,
        dependsOn: ["t-sketch"],
      }),
      task("t-signoff", "Design signed off", "g-design", 3, 3, { milestone: true, dependsOn: ["t-prototype"] }),
      task("t-firmware", "Firmware", "g-build", -2, 12, { progress: 25, colour: 4 }),
      task("t-tooling", "Order the moulds", "g-build", 4, 15, { colour: 2, dependsOn: ["t-signoff"] }),
      task("t-test", "Test in the rain", "g-build", 16, 22, { colour: 2, dependsOn: ["t-tooling", "t-firmware"] }),
      task("t-copy", "Write the shop copy", "g-launch", 10, 17, { colour: 6 }),
      task("t-press", "Press release", "g-launch", 15, 19, { colour: 5, dependsOn: ["t-copy"] }),
      task("t-launch", "Launch day", "g-launch", 24, 24, { milestone: true, dependsOn: ["t-test", "t-press"] }),
    ],
  };
}
