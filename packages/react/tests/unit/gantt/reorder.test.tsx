import { ganttRows } from "@eisenhower/model";
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { groupDrop, taskDrop } from "../../../src/gantt/reorder";
import { latest, PLAN, rowNames, setup, taskOf } from "./fixtures";

// The plan's rows, 32 pixels each: Brief 0, Release 1, [Design] 2, Sketch 3, Review 4, [Build] 5, Frame 6,
// Paint 7, [Launch] 8.
const ROW = 32;
const ROWS = ganttRows(PLAN);
const upper = (row: number) => row * ROW + 4;
const lower = (row: number) => row * ROW + 24;

describe("where a task dragged by its name goes", () => {
  it("goes before or after the task under the pointer, by its half, in that task's group", () => {
    expect(taskDrop(PLAN, ROWS, "brief", lower(3), ROW)).toEqual({ groupId: "design", index: 1, line: 4 * ROW });
    expect(taskDrop(PLAN, ROWS, "paint", upper(3), ROW)).toEqual({ groupId: "design", index: 0, line: 3 * ROW });
  });

  it("goes to the start of a group under its summary's lower half, to the end of the section above under its upper half", () => {
    expect(taskDrop(PLAN, ROWS, "brief", lower(5), ROW)).toEqual({ groupId: "build", index: 0, line: 6 * ROW });
    expect(taskDrop(PLAN, ROWS, "sketch", upper(2), ROW)).toEqual({ groupId: null, index: 2, line: 2 * ROW });
    expect(taskDrop(PLAN, ROWS, "frame", upper(5), ROW)).toEqual({ groupId: "design", index: 2, line: 5 * ROW });
  });

  it("goes to the end of a folded group, and of the last section below every row", () => {
    const folded = { ...PLAN, groups: PLAN.groups.map((group) => ({ ...group, collapsed: group.id === "build" })) };
    const rows = ganttRows(folded);
    expect(taskDrop(folded, rows, "brief", upper(5), ROW)).toEqual({ groupId: "build", index: 2, line: 6 * ROW });
    expect(taskDrop(PLAN, ROWS, "brief", 40 * ROW, ROW)).toEqual({ groupId: "launch", index: 0, line: 9 * ROW });
  });

  it("is nothing over its own row, or where it already is", () => {
    expect(taskDrop(PLAN, ROWS, "brief", lower(0), ROW)).toBeNull();
    expect(taskDrop(PLAN, ROWS, "brief", upper(1), ROW)).toBeNull();
    expect(taskDrop(PLAN, ROWS, "sketch", upper(4), ROW)).toBeNull();
  });
});

describe("where a group dragged by its name goes", () => {
  it("goes before a group under its summary's upper half, after it anywhere else in its rows", () => {
    expect(groupDrop(PLAN, ROWS, "launch", upper(2), ROW)).toEqual({ to: 0, line: 2 * ROW });
    expect(groupDrop(PLAN, ROWS, "design", upper(7), ROW)).toEqual({ to: 1, line: 8 * ROW });
    // Build is already right after Design.
    expect(groupDrop(PLAN, ROWS, "build", lower(2), ROW)).toBeNull();
  });

  it("goes first over the tasks outside every group, last below every row", () => {
    expect(groupDrop(PLAN, ROWS, "build", upper(0), ROW)).toEqual({ to: 0, line: 2 * ROW });
    expect(groupDrop(PLAN, ROWS, "design", 40 * ROW, ROW)).toEqual({ to: 2, line: 9 * ROW });
  });

  it("is nothing where it already is, or for a group that is not there", () => {
    expect(groupDrop(PLAN, ROWS, "design", upper(2), ROW)).toBeNull();
    expect(groupDrop(PLAN, ROWS, "design", lower(4), ROW)).toBeNull();
    expect(groupDrop(PLAN, ROWS, "gone", upper(2), ROW)).toBeNull();
  });
});

const nameOf = (rowName: string) =>
  [...document.querySelectorAll<HTMLElement>(".eh-gantt-body .eh-gantt-name")].find((cell) =>
    cell.textContent?.includes(rowName),
  )!;
const announced = () => screen.getByRole("status").textContent?.trim();

/** A drag by a row's name from one row's middle to a point down the rows. */
function dragName(rowName: string, from: number, to: number) {
  const cell =
    nameOf(rowName).querySelector<HTMLElement>(".eh-gantt-task-name, .eh-gantt-group-name") ?? nameOf(rowName);
  fireEvent.pointerDown(cell, { clientY: from, button: 0, pointerId: 1 });
  fireEvent.pointerMove(cell, { clientY: (from + to) / 2, pointerId: 1 });
  fireEvent.pointerMove(cell, { clientY: to, pointerId: 1 });
  return cell;
}

describe("dragging rows by their names", () => {
  it("moves a task into another group, showing where it goes, and announces it", () => {
    setup();
    const cell = dragName("Brief", 16, lower(3));
    expect(cell.closest(".eh-gantt-row")).toHaveAttribute("data-moving", "true");
    expect(document.querySelector<HTMLElement>(".eh-gantt-drop-line")?.style.top).toBe(`${4 * ROW}px`);
    fireEvent.pointerUp(cell, { clientY: lower(3), pointerId: 1 });
    expect(rowNames()).toEqual([
      "Release",
      "[Design]",
      "Sketch",
      "Brief",
      "Review",
      "[Build]",
      "Frame",
      "Paint",
      "[Launch]",
    ]);
    expect(taskOf("brief").groupId).toBe("design");
    expect(announced()).toBe("Brief: moved to Design, 2 of 3");
    expect(document.querySelector(".eh-gantt-drop-line")).toBeNull();
  });

  it("moves a group with its tasks, and its button's click after the drag does not fold it", () => {
    setup();
    const cell = dragName("Launch", upper(8), upper(2));
    fireEvent.pointerUp(cell, { clientY: upper(2), pointerId: 1 });
    fireEvent.click(cell);
    expect(latest.chart.groups.map((group) => group.id)).toEqual(["launch", "design", "build"]);
    expect(latest.chart.groups[0]!.collapsed).toBe(false);
    // A press without a move is still a click: it folds the group.
    const design = nameOf("Design").querySelector(".eh-gantt-group-name")!;
    fireEvent.pointerDown(design, { clientY: upper(3), button: 0, pointerId: 1 });
    fireEvent.pointerMove(design, { clientY: upper(3) + 2, pointerId: 1 });
    fireEvent.pointerUp(design, { clientY: upper(3) + 2, pointerId: 1 });
    fireEvent.click(design);
    expect(latest.chart.groups[1]!.collapsed).toBe(true);
  });

  it("changes nothing dropped where it was, or cancelled with Escape or a lost pointer", () => {
    setup();
    let cell = dragName("Sketch", lower(3), upper(4));
    fireEvent.pointerUp(cell, { clientY: upper(4), pointerId: 1 });
    expect(latest.chart).toBe(PLAN);
    cell = dragName("Sketch", lower(3), lower(7));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(document.querySelector(".eh-gantt-drop-line")).toBeNull();
    fireEvent.pointerUp(cell, { clientY: lower(7), pointerId: 1 });
    cell = dragName("Sketch", lower(3), lower(7));
    fireEvent.pointerCancel(cell, { pointerId: 1 });
    fireEvent.pointerUp(cell, { clientY: lower(7), pointerId: 1 });
    expect(latest.chart).toBe(PLAN);
  });

  it("does not drag rows in a read-only chart", () => {
    setup({ readOnly: true });
    const cell = dragName("Brief", 16, lower(3));
    fireEvent.pointerUp(cell, { clientY: lower(3), pointerId: 1 });
    expect(document.querySelector("[data-moving]")).toBeNull();
    expect(rowNames()[0]).toBe("Brief");
  });
});
