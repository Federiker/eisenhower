import type { Gantt as GanttData, GanttTask } from "@eisenhower/model";
import { type RenderResult, render } from "@testing-library/react";
import { useState } from "react";

import { Gantt, type GanttProps } from "../../../src";

export function task(id: string, name: string, start: string, end: string, extra: Partial<GanttTask> = {}): GanttTask {
  return { id, name, groupId: null, start, end, milestone: false, progress: 0, colour: null, dependsOn: [], ...extra };
}

/**
 * An invented plan: a loose brief, Design (sketch, review) and Build (frame, paint), an empty Launch group and a
 * release milestone; frame depends on sketch, the release on frame and paint. Today is Thursday 5 November 2026.
 */
export const PLAN: GanttData = {
  groups: [
    { id: "design", name: "Design", collapsed: false },
    { id: "build", name: "Build", collapsed: false },
    { id: "launch", name: "Launch", collapsed: false },
  ],
  tasks: [
    task("brief", "Brief", "2026-11-02", "2026-11-03"),
    task("release", "Release", "2026-11-23", "2026-11-23", { milestone: true, dependsOn: ["frame", "paint"] }),
    task("sketch", "Sketch", "2026-11-04", "2026-11-06", { groupId: "design", progress: 50, colour: 1 }),
    task("review", "Review", "2026-11-09", "2026-11-09", { groupId: "design" }),
    task("frame", "Frame", "2026-11-09", "2026-11-13", { groupId: "build", dependsOn: ["sketch"] }),
    task("paint", "Paint", "2026-11-16", "2026-11-20", { groupId: "build" }),
  ],
};

export const TODAY = "2026-11-05";

/** The chart as the view last reported it. */
export const latest: { chart: GanttData } = { chart: PLAN };

/** A host keeping the chart in its own state, reporting each change in `latest`. */
function Host({ initial, ...props }: Partial<GanttProps> & { initial: GanttData }) {
  const [value, setValue] = useState(initial);
  return (
    <Gantt
      today={TODAY}
      {...props}
      value={value}
      onChange={(next) => {
        latest.chart = next;
        setValue(next);
        props.onChange?.(next);
      }}
    />
  );
}

/** Draws a chart kept by its host's state. */
export function setup(props: Partial<GanttProps> = {}, initial: GanttData = PLAN): RenderResult {
  latest.chart = initial;
  return render(<Host initial={initial} {...props} />);
}

/** The rows' names in order, a group's in brackets. */
export function rowNames(): string[] {
  return [...document.querySelectorAll<HTMLElement>(".eh-gantt-body .eh-gantt-row")].map((row) =>
    row.dataset.kind === "group"
      ? `[${row.querySelector(".eh-gantt-group-name")?.textContent ?? ""}]`
      : (row.querySelector(".eh-gantt-task-name")?.textContent ?? ""),
  );
}

export const taskOf = (id: string) => latest.chart.tasks.find((one) => one.id === id)!;
