import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createTranslate, EisenhowerProvider, Gantt } from "../../../src";
import { latest, PLAN, rowNames, setup, TODAY, task } from "./fixtures";

const t = createTranslate();
const grid = () => screen.getByRole("treegrid", { name: t("gantt.label") });
const bar = (name: RegExp | string) => screen.getByRole("button", { name });

describe("the gantt chart's grid", () => {
  it("is a tree grid: the loose tasks first, then each group's summary row and its tasks", () => {
    setup();
    expect(grid()).toHaveAttribute("aria-rowcount", "10");
    expect(rowNames()).toEqual([
      "Brief",
      "Release",
      "[Design]",
      "Sketch",
      "Review",
      "[Build]",
      "Frame",
      "Paint",
      "[Launch]",
    ]);
    const header = within(grid()).getAllByRole("columnheader");
    expect(header.map((cell) => cell.textContent)).toContain(t("gantt.columnName"));
    // The drawn range holds every task and today, with room either side, in whole weeks (the default scale).
    expect(header[1]).toHaveAccessibleName("Dates, 19 Oct 2026 to 13 Dec 2026");
    const rows = within(grid()).getAllByRole("row");
    expect(rows[1]).toHaveAttribute("aria-level", "1");
    expect(rows[3]).toHaveAttribute("aria-expanded", "true");
    expect(rows[4]).toHaveAttribute("aria-level", "2");
  });

  it("names each bar with its days, length and progress, and a milestone with its day", () => {
    setup();
    expect(bar("Sketch, 4 Nov 2026 to 6 Nov 2026, 3 days, 50% done")).toHaveClass("eh-gantt-bar");
    expect(bar("Review, 9 Nov 2026, 1 day, 0% done")).toHaveClass("eh-gantt-bar");
    expect(bar("Release, milestone on 23 Nov 2026")).toHaveClass("eh-gantt-milestone");
    expect(bar(/^Sketch/).querySelector(".eh-gantt-progress")).toHaveStyle({ width: "50%" });
    expect(bar(/^Sketch/)).toHaveStyle({ "--eh-gantt-bar": "var(--eh-colour-1)" });
    expect(bar(/^Frame/)).toHaveStyle({ "--eh-gantt-bar": "var(--eh-accent)" });
  });

  it("draws bars to scale: a week's columns are 12 pixels a day, a day's 32", () => {
    setup();
    // 19 October to 4 November is 16 days.
    expect(bar(/^Sketch/)).toHaveStyle({ left: `${16 * 12}px`, width: `${3 * 12}px` });
    fireEvent.click(screen.getByRole("button", { name: t("gantt.scaleDay") }));
    // On days the range starts a week before the brief: 26 October; 4 November is 9 days later.
    expect(bar(/^Sketch/)).toHaveStyle({ left: `${9 * 32}px`, width: `${3 * 32}px` });
  });

  it("names the group rows' buttons with the group, its tasks and its days, and spans their summary", () => {
    setup();
    const design = screen.getByRole("button", { name: "Design, 2 tasks, 4 Nov 2026 to 9 Nov 2026" });
    expect(design).toHaveAttribute("aria-expanded", "true");
    expect(design.closest(".eh-gantt-row")?.querySelector(".eh-gantt-summary")).toHaveStyle({ width: `${6 * 12}px` });
    expect(screen.getByRole("button", { name: "Launch, 0 tasks" })).toBeInTheDocument();
  });

  it("folds and unfolds a group with its button, storing it in the chart", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /^Design,/ }));
    expect(latest.chart.groups[0]!.collapsed).toBe(true);
    expect(rowNames()).toEqual(["Brief", "Release", "[Design]", "[Build]", "Frame", "Paint", "[Launch]"]);
    expect(screen.getByRole("button", { name: /^Design,/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("status")).toHaveTextContent("Design collapsed");
    fireEvent.click(screen.getByRole("button", { name: /^Design,/ }));
    expect(latest.chart.groups[0]!.collapsed).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent("Design expanded");
  });

  it("marks today and, on the day scale, shades the weekends; the header follows the locale", () => {
    setup({ scale: "day", locale: "fr-FR" });
    expect(document.querySelector(".eh-gantt-today")).toHaveStyle({ left: `${(10 + 0.5) * 32}px` });
    // 26 October to 29 November: the weekends of 31 October, 7, 14, 21 and 28 November.
    expect(document.querySelectorAll(".eh-gantt-weekend")).toHaveLength(5);
    expect(document.querySelector(".eh-gantt-header-upper")).toHaveTextContent("octobre 2026");
    expect(bar(/^Sketch/)).toHaveAccessibleName("Sketch, 4 nov. 2026 to 6 nov. 2026, 3 days, 50% done");
  });

  it("shades no weekends on the week and month scales, and heads months with years", () => {
    setup({ scale: "month" });
    expect(document.querySelectorAll(".eh-gantt-weekend")).toHaveLength(0);
    expect([...document.querySelectorAll(".eh-gantt-header-upper")].map((cell) => cell.textContent)).toEqual(["2026"]);
    expect([...document.querySelectorAll(".eh-gantt-header-lower")].map((cell) => cell.textContent)).toEqual([
      "Oct",
      "Nov",
      "Dec",
    ]);
  });

  it("shows the chosen task, and says when the chart is empty", () => {
    setup({ selectedId: "frame" });
    expect(bar(/^Frame/).closest('[role="row"]')).toHaveAttribute("aria-selected", "true");
    expect(bar(/^Frame/)).toHaveAttribute("tabindex", "0");
    expect(bar(/^Brief/)).toHaveAttribute("tabindex", "-1");
  });

  it("says when there is nothing to show", () => {
    setup({}, { groups: [], tasks: [] });
    expect(screen.getByText(t("gantt.empty"))).toBeInTheDocument();
  });

  it("takes its settings from a provider, and its class name", () => {
    render(
      <EisenhowerProvider strings={{ "gantt.label": "Plan" }}>
        <Gantt value={PLAN} onChange={vi.fn()} today={TODAY} className="mine" />
      </EisenhowerProvider>,
    );
    expect(screen.getByRole("treegrid", { name: "Plan" }).closest(".eh-gantt")).toHaveClass("mine");
  });
});

describe("dependency arrows and conflicts", () => {
  it("draws an arrow a dependency, and none is broken in the plan", () => {
    setup();
    expect(document.querySelectorAll(".eh-gantt-arrow")).toHaveLength(3);
    expect(document.querySelectorAll('.eh-gantt-arrow[data-late="true"]')).toHaveLength(0);
    expect(screen.queryByText(t("gantt.conflictBadge"))).not.toBeInTheDocument();
  });

  it("flags a task that starts before a predecessor ends, in words and on the drawing", () => {
    const early = {
      ...PLAN,
      tasks: PLAN.tasks.map((one) => (one.id === "frame" ? { ...one, start: "2026-11-06" } : one)),
    };
    setup({}, early);
    expect(bar(/^Frame/)).toHaveAccessibleName(
      "Frame, 6 Nov 2026 to 13 Nov 2026, 8 days, 0% done; starts before Sketch ends",
    );
    expect(bar(/^Frame/)).toHaveAttribute("data-late", "true");
    const row = bar(/^Frame/).closest('[role="row"]') as HTMLElement;
    expect(within(row).getByText(t("gantt.conflictBadge"))).toBeVisible();
    expect(screen.getByText("1 task starts before a task it depends on ends.")).toBeInTheDocument();
    expect(document.querySelectorAll('.eh-gantt-arrow[data-late="true"]')).toHaveLength(1);
  });

  it("draws the arrows of a folded group's tasks from its summary row", () => {
    setup({}, { ...PLAN, groups: PLAN.groups.map((group) => ({ ...group, collapsed: group.id === "build" })) });
    // Sketch to the folded Build, and Build to the release (Frame and Paint, once each).
    expect(document.querySelectorAll(".eh-gantt-arrow")).toHaveLength(3);
  });

  it("leaves out an arrow between two tasks of the same folded group", () => {
    setup(
      {},
      {
        groups: [{ id: "g", name: "G", collapsed: true }],
        tasks: [
          task("a", "A", "2026-11-02", "2026-11-03", { groupId: "g" }),
          task("b", "B", "2026-11-04", "2026-11-05", { groupId: "g", dependsOn: ["a"] }),
        ],
      },
    );
    expect(document.querySelectorAll(".eh-gantt-arrow")).toHaveLength(0);
  });
});
