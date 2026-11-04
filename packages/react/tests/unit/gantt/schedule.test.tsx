import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslate } from "../../../src";
import { latest, setup, taskOf } from "./fixtures";

const t = createTranslate();
const bar = (name: RegExp) => screen.getByRole("button", { name });
const toggle = () => screen.getByRole("button", { name: t("gantt.autoSchedule") });
const announced = () => screen.getByRole("status").textContent?.trim();
const press = (element: HTMLElement, key: string, extra: Partial<KeyboardEventInit> = {}) =>
  fireEvent.keyDown(element, { key, ...extra });
const days = (id: string) => [taskOf(id).start, taskOf(id).end];

/** A pointer drag of an element from one x to another (the day scale draws a day 32 pixels wide). */
function drag(element: Element, from: number, to: number) {
  fireEvent.pointerDown(element, { clientX: from, button: 0, pointerId: 1 });
  fireEvent.pointerMove(element, { clientX: to, pointerId: 1 });
  fireEvent.pointerUp(element, { clientX: to, pointerId: 1 });
}

afterEach(() => vi.restoreAllMocks());

// In the plan, Frame (9 to 13 November) depends on Sketch (4 to 6 November), with a weekend between them; the
// Release milestone (23 November) depends on Frame and Paint (16 to 20 November).
describe("Move dependent tasks", () => {
  it("is a pressed button in the toolbar, on by default, that the view keeps or the host controls", () => {
    const onAutoScheduleChange = vi.fn();
    const { unmount } = setup({ onAutoScheduleChange });
    expect(toggle()).toHaveAttribute("aria-pressed", "true");
    expect(toggle()).toHaveAttribute("title", t("gantt.autoScheduleHint"));
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-pressed", "false");
    expect(onAutoScheduleChange).toHaveBeenCalledWith(false);
    expect(announced()).toBe(t("gantt.autoScheduleOff"));
    fireEvent.click(toggle());
    expect(announced()).toBe(t("gantt.autoScheduleOn"));
    unmount();

    // Controlled: the host's value stands until the host changes it.
    setup({ autoSchedule: false, onAutoScheduleChange });
    fireEvent.click(toggle());
    expect(onAutoScheduleChange).toHaveBeenLastCalledWith(true);
    expect(toggle()).toHaveAttribute("aria-pressed", "false");
  });

  it("is not offered in a read-only chart", () => {
    setup({ readOnly: true });
    expect(screen.queryByRole("button", { name: t("gantt.autoSchedule") })).not.toBeInTheDocument();
  });

  it("pushes the tasks after a moved task only as far as needed, the gap first", () => {
    setup();
    act(() => bar(/^Sketch/).focus());
    press(bar(/^Sketch/), "ArrowRight", { altKey: true });
    press(bar(/^Sketch/), "ArrowRight", { altKey: true });
    // The weekend's gap took the first two days.
    expect(days("frame")).toEqual(["2026-11-09", "2026-11-13"]);
    press(bar(/^Sketch/), "ArrowRight", { altKey: true });
    expect(days("sketch")).toEqual(["2026-11-07", "2026-11-09"]);
    expect(days("frame")).toEqual(["2026-11-10", "2026-11-14"]);
    expect(announced()).toBe("Sketch: moved to 7 Nov 2026 to 9 Nov 2026; 1 task after it moved too");
    // Moving back pulls nothing.
    press(bar(/^Sketch/), "ArrowLeft", { altKey: true });
    expect(days("frame")).toEqual(["2026-11-10", "2026-11-14"]);
  });

  it("pushes them when a task's end is made later, with the keys or the pointer", () => {
    setup({ scale: "day" });
    act(() => bar(/^Paint/).focus());
    press(bar(/^Paint/), "ArrowRight", { altKey: true, shiftKey: true });
    press(bar(/^Paint/), "ArrowRight", { altKey: true, shiftKey: true });
    press(bar(/^Paint/), "ArrowRight", { altKey: true, shiftKey: true });
    expect(days("release")).toEqual(["2026-11-24", "2026-11-24"]);
    expect(announced()).toBe("Paint: now 16 Nov 2026 to 23 Nov 2026, 8 days; 1 task after it moved too");
    drag(bar(/^Paint/).querySelector('[data-edge="end"]')!, 200, 200 + 2 * 32);
    expect(days("release")).toEqual(["2026-11-26", "2026-11-26"]);
  });

  it("stops a task at the day after the tasks it depends on end, and says so", () => {
    setup({ scale: "day" });
    act(() => bar(/^Frame/).focus());
    press(bar(/^Frame/), "ArrowLeft", { altKey: true });
    press(bar(/^Frame/), "ArrowLeft", { altKey: true });
    expect(days("frame")).toEqual(["2026-11-07", "2026-11-11"]);
    const before = latest.chart;
    press(bar(/^Frame/), "ArrowLeft", { altKey: true });
    expect(latest.chart).toBe(before);
    expect(announced()).toBe(t("gantt.problem.early"));
    expect(document.querySelector(".eh-gantt-problem")).toHaveTextContent(t("gantt.problem.early"));
  });

  it("stops a dragged bar, or its start, at that day while it is dragged", () => {
    setup({ scale: "day" });
    const frame = bar(/^Frame/);
    fireEvent.pointerDown(frame, { clientX: 400, button: 0, pointerId: 1 });
    fireEvent.pointerMove(frame, { clientX: 400 - 6 * 32, pointerId: 1 });
    expect(frame).toHaveAttribute("title", "7 Nov 2026 to 11 Nov 2026");
    fireEvent.pointerUp(frame, { clientX: 400 - 6 * 32, pointerId: 1 });
    expect(days("frame")).toEqual(["2026-11-07", "2026-11-11"]);
    drag(bar(/^Frame/).querySelector('[data-edge="start"]')!, 400, 400 - 3 * 32);
    expect(days("frame")).toEqual(["2026-11-07", "2026-11-11"]);
    drag(bar(/^Frame/).querySelector('[data-edge="end"]')!, 400, 400 - 3 * 32);
    expect(days("frame")).toEqual(["2026-11-07", "2026-11-08"]);
  });

  it("moves a task after a predecessor linked by Ctrl+drag, and says where", () => {
    setup({ scale: "day" });
    const paint = bar(/^Paint/);
    fireEvent.pointerDown(paint, { clientX: 10, clientY: 10, button: 0, pointerId: 1, ctrlKey: true });
    vi.spyOn(document, "elementFromPoint").mockReturnValue(bar(/^Brief/));
    fireEvent.pointerMove(paint, { clientX: 30, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(paint, { pointerId: 1 });
    expect(days("brief")).toEqual(["2026-11-21", "2026-11-22"]);
    expect(announced()).toBe("Brief now depends on Paint, moved to 21 Nov 2026 to 22 Nov 2026");
  });

  it("moves a task saved in the dialog after the tasks it depends on", () => {
    setup();
    act(() => bar(/^Frame/).focus());
    press(bar(/^Frame/), "Enter");
    const dialog = screen.getByRole("dialog", { name: "Task: Frame" });
    fireEvent.change(within(dialog).getByLabelText(t("gantt.fieldStart")), { target: { value: "2026-11-05" } });
    fireEvent.click(within(dialog).getByRole("button", { name: t("common.save") }));
    // Saved from 5 to 13 November, nine days: it keeps its length from the earliest day.
    expect(days("frame")).toEqual(["2026-11-07", "2026-11-15"]);
  });

  it("off, moves nothing by itself and lets tasks start too early", () => {
    setup({ autoSchedule: false, scale: "day" });
    act(() => bar(/^Sketch/).focus());
    for (let step = 0; step < 4; step += 1) press(bar(/^Sketch/), "ArrowRight", { altKey: true });
    expect(days("frame")).toEqual(["2026-11-09", "2026-11-13"]);
    expect(announced()).toBe("Sketch: moved to 8 Nov 2026 to 10 Nov 2026");
    drag(bar(/^Frame/), 400, 400 - 6 * 32);
    expect(days("frame")).toEqual(["2026-11-03", "2026-11-07"]);
  });
});
