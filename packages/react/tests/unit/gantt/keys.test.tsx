import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createTranslate } from "../../../src";
import { latest, PLAN, rowNames, setup, taskOf } from "./fixtures";

const t = createTranslate();
const bar = (name: RegExp | string) => screen.getByRole("button", { name });
const group = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name},`) });
const announced = () => screen.getByRole("status").textContent?.trim();
const press = (element: HTMLElement, key: string, extra: Partial<KeyboardEventInit> = {}) =>
  fireEvent.keyDown(element, { key, ...extra });

describe("moving the focus", () => {
  it("goes up and down the rows with the arrows, Home and End, one row a Tab stop", () => {
    setup();
    act(() => bar(/^Brief/).focus());
    press(bar(/^Brief/), "ArrowDown");
    expect(bar(/^Release/)).toHaveFocus();
    press(bar(/^Release/), "ArrowDown");
    expect(group("Design")).toHaveFocus();
    expect(group("Design")).toHaveAttribute("tabindex", "0");
    expect(bar(/^Brief/)).toHaveAttribute("tabindex", "-1");
    press(group("Design"), "End");
    expect(group("Launch")).toHaveFocus();
    press(group("Launch"), "ArrowDown");
    expect(group("Launch")).toHaveFocus();
    press(group("Launch"), "Home");
    expect(bar(/^Brief/)).toHaveFocus();
    press(bar(/^Brief/), "ArrowUp");
    expect(bar(/^Brief/)).toHaveFocus();
  });

  it("folds a group with the left arrow, unfolds it with the right, and goes into it and back", () => {
    setup();
    act(() => group("Design").focus());
    press(group("Design"), "ArrowLeft");
    expect(rowNames()).not.toContain("Sketch");
    press(group("Design"), "ArrowRight");
    expect(rowNames()).toContain("Sketch");
    press(group("Design"), "ArrowRight");
    expect(bar(/^Sketch/)).toHaveFocus();
    press(bar(/^Sketch/), "ArrowLeft");
    expect(group("Design")).toHaveFocus();
    // Enter on a group folds it too.
    press(group("Design"), "Enter");
    expect(latest.chart.groups[0]!.collapsed).toBe(true);
  });
});

describe("moving a task with the keys", () => {
  it("moves it a week earlier or later on the week scale, and a day on the day scale", () => {
    setup();
    act(() => bar(/^Sketch/).focus());
    press(bar(/^Sketch/), "ArrowRight", { altKey: true });
    expect(taskOf("sketch")).toMatchObject({ start: "2026-11-11", end: "2026-11-13" });
    expect(announced()).toBe("Sketch: moved to 11 Nov 2026 to 13 Nov 2026");
    expect(bar(/^Sketch/)).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: t("gantt.scaleDay") }));
    press(bar(/^Sketch/), "ArrowLeft", { altKey: true });
    expect(taskOf("sketch")).toMatchObject({ start: "2026-11-10", end: "2026-11-12" });
  });

  it("changes its end with Alt+Shift and the arrows, never before its start", () => {
    setup({ scale: "day" });
    act(() => bar(/^Sketch/).focus());
    press(bar(/^Sketch/), "ArrowRight", { altKey: true, shiftKey: true });
    expect(taskOf("sketch")).toMatchObject({ start: "2026-11-04", end: "2026-11-07" });
    expect(announced()).toBe("Sketch: now 4 Nov 2026 to 7 Nov 2026, 4 days");
    press(bar(/^Sketch/), "ArrowLeft", { altKey: true, shiftKey: true });
    press(bar(/^Sketch/), "ArrowLeft", { altKey: true, shiftKey: true });
    press(bar(/^Sketch/), "ArrowLeft", { altKey: true, shiftKey: true });
    expect(taskOf("sketch")).toMatchObject({ start: "2026-11-04", end: "2026-11-04" });
    press(bar(/^Sketch/), "ArrowLeft", { altKey: true, shiftKey: true });
    expect(screen.getByRole("alert")).toHaveTextContent(t("gantt.problem.order"));
    press(bar(/^Sketch/), "Escape");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shortens a long task to one day at most on the week scale, and never resizes a milestone", () => {
    setup();
    act(() => bar(/^Frame/).focus());
    press(bar(/^Frame/), "ArrowLeft", { altKey: true, shiftKey: true });
    expect(taskOf("frame")).toMatchObject({ start: "2026-11-09", end: "2026-11-09" });
    act(() => bar(/^Release/).focus());
    press(bar(/^Release/), "ArrowRight", { altKey: true, shiftKey: true });
    expect(screen.getByRole("alert")).toHaveTextContent(t("gantt.problem.milestone"));
    press(bar(/^Release/), "ArrowRight", { altKey: true });
    expect(taskOf("release")).toMatchObject({ start: "2026-11-30", end: "2026-11-30" });
  });

  it("moves it up and down the rows, across groups, unfolding the group it goes into", () => {
    setup({}, { ...PLAN, groups: PLAN.groups.map((one) => ({ ...one, collapsed: one.id === "design" })) });
    act(() => bar(/^Release/).focus());
    press(bar(/^Release/), "ArrowDown", { altKey: true });
    expect(rowNames()).toEqual([
      "Brief",
      "[Design]",
      "Release",
      "Sketch",
      "Review",
      "[Build]",
      "Frame",
      "Paint",
      "[Launch]",
    ]);
    expect(announced()).toBe("Release: moved to Design, 1 of 3");
    expect(bar(/^Release/)).toHaveFocus();
    press(bar(/^Release/), "ArrowUp", { altKey: true });
    expect(announced()).toBe(`Release: moved to ${t("gantt.noGroup")}, 2 of 2`);
    press(bar(/^Brief/), "ArrowUp", { altKey: true });
    expect(rowNames()[0]).toBe("Brief");
  });

  it("moves a group up and down among the groups", () => {
    setup();
    act(() => group("Build").focus());
    press(group("Build"), "ArrowUp", { altKey: true });
    expect(latest.chart.groups.map((one) => one.id)).toEqual(["build", "design", "launch"]);
    expect(announced()).toBe("Build: moved to 1 of 3");
    expect(group("Build")).toHaveFocus();
    press(group("Build"), "ArrowUp", { altKey: true });
    expect(latest.chart.groups[0]!.id).toBe("build");
  });

  it("changes nothing in a read-only chart, which still folds its groups for itself", () => {
    const onChange = vi.fn();
    setup({ readOnly: true, onChange });
    expect(screen.queryByRole("button", { name: t("gantt.newTask") })).not.toBeInTheDocument();
    act(() => bar(/^Sketch/).focus());
    press(bar(/^Sketch/), "ArrowRight", { altKey: true });
    press(bar(/^Sketch/), "ArrowDown", { altKey: true });
    press(bar(/^Sketch/), "F2");
    press(bar(/^Sketch/), "Delete");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    fireEvent.click(group("Design"));
    expect(rowNames()).not.toContain("Sketch");
    expect(onChange).not.toHaveBeenCalled();
    expect(bar(/^Frame/).querySelector(".eh-gantt-handle")).toBeNull();
  });
});

describe("the scale", () => {
  it("zooms in and out with Ctrl+= and Ctrl+-, as jerome's timeline, and with Ctrl+wheel", () => {
    const onScaleChange = vi.fn();
    setup({ onScaleChange });
    const scales = () => screen.getByRole("group", { name: t("gantt.scale") });
    act(() => bar(/^Brief/).focus());
    press(bar(/^Brief/), "=", { ctrlKey: true });
    expect(onScaleChange).toHaveBeenLastCalledWith("day");
    expect(announced()).toBe("Scale: Days");
    press(bar(/^Brief/), "=", { ctrlKey: true });
    expect(onScaleChange).toHaveBeenCalledTimes(1);
    press(bar(/^Brief/), "-", { ctrlKey: true });
    press(bar(/^Brief/), "-", { ctrlKey: true });
    expect(onScaleChange).toHaveBeenLastCalledWith("month");
    expect(scales().querySelector('[aria-pressed="true"]')).toHaveTextContent(t("gantt.scaleMonth"));
    // The test DOM's wheel events have no modifier keys: they are given one.
    const wheel = (ctrlKey: boolean) => {
      const event = new WheelEvent("wheel", { deltaY: -1, bubbles: true, cancelable: true });
      Object.defineProperty(event, "ctrlKey", { value: ctrlKey });
      fireEvent(document.querySelector(".eh-gantt-scroll")!, event);
    };
    wheel(true);
    expect(onScaleChange).toHaveBeenLastCalledWith("week");
    wheel(false);
    expect(onScaleChange).toHaveBeenCalledTimes(4);
  });

  it("follows the host's scale when it is given", () => {
    const onScaleChange = vi.fn();
    setup({ scale: "month", onScaleChange });
    fireEvent.click(screen.getByRole("button", { name: t("gantt.scaleWeek") }));
    expect(onScaleChange).toHaveBeenCalledWith("week");
    expect(screen.getByRole("button", { name: t("gantt.scaleMonth") })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: t("gantt.goToToday") }));
  });
});

describe("the pointer", () => {
  const drag = (element: Element, from: number, to: number) => {
    fireEvent.pointerDown(element, { clientX: from, button: 0, pointerId: 1 });
    fireEvent.pointerMove(element, { clientX: (from + to) / 2, pointerId: 1 });
    fireEvent.pointerMove(element, { clientX: to, pointerId: 1 });
    fireEvent.pointerUp(element, { clientX: to, pointerId: 1 });
  };

  it("moves a bar by whole days, snapping to the nearest", () => {
    setup({ scale: "day" });
    drag(bar(/^Sketch/), 100, 100 + 2 * 32 + 10);
    expect(taskOf("sketch")).toMatchObject({ start: "2026-11-06", end: "2026-11-08" });
    expect(announced()).toBe("Sketch: moved to 6 Nov 2026 to 8 Nov 2026");
  });

  it("resizes a bar by its ends, never past the other end", () => {
    setup({ scale: "day" });
    const [start, end] = bar(/^Sketch/).querySelectorAll(".eh-gantt-handle");
    drag(end!, 200, 200 + 32);
    expect(taskOf("sketch")).toMatchObject({ start: "2026-11-04", end: "2026-11-07" });
    drag(bar(/^Sketch/).querySelector('[data-edge="start"]')!, 200, 200 + 10 * 32);
    expect(taskOf("sketch")).toMatchObject({ start: "2026-11-07", end: "2026-11-07" });
    expect(start).toBeDefined();
  });

  it("shows the days while dragging, and Escape or a cancelled pointer drops nothing", () => {
    setup({ scale: "day" });
    const sketch = bar(/^Sketch/);
    fireEvent.pointerDown(sketch, { clientX: 0, button: 0, pointerId: 1 });
    fireEvent.pointerMove(sketch, { clientX: 64, pointerId: 1 });
    expect(sketch).toHaveAttribute("data-dragging", "move");
    expect(sketch).toHaveAttribute("title", "6 Nov 2026 to 8 Nov 2026");
    press(sketch, "Escape");
    expect(sketch).not.toHaveAttribute("data-dragging");
    fireEvent.pointerDown(sketch, { clientX: 0, button: 0, pointerId: 1 });
    fireEvent.pointerCancel(sketch, { pointerId: 1 });
    fireEvent.pointerUp(sketch, { clientX: 64, pointerId: 1 });
    expect(taskOf("sketch").start).toBe("2026-11-04");
    // A press without a move, or with another button, is no drag.
    drag(sketch, 10, 11);
    fireEvent.pointerDown(sketch, { clientX: 0, button: 2, pointerId: 1 });
    fireEvent.pointerUp(sketch, { clientX: 64, pointerId: 1 });
    expect(taskOf("sketch").start).toBe("2026-11-04");
  });

  it("moves a milestone by its handle-less diamond", () => {
    setup({ scale: "day" });
    drag(bar(/^Release/), 0, -32);
    expect(taskOf("release")).toMatchObject({ start: "2026-11-22", end: "2026-11-22" });
  });

  it("does not drag in a read-only chart", () => {
    setup({ scale: "day", readOnly: true });
    drag(bar(/^Sketch/), 0, 64);
    expect(taskOf("sketch").start).toBe("2026-11-04");
  });
});
