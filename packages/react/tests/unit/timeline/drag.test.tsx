import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Timeline } from "../../../src";
import { dragCount, laneAt } from "../../../src/timeline/drag";
import { lanesOf } from "../../../src/timeline/layout";
import { scaleOf } from "../../../src/timeline/scale";
import { acts, d, dated, e, harbour, id } from "./fixtures";
import { Host, held, nextTick } from "./host";

/** Where the plane is on the page, as the mocked layout puts it. */
const LEFT = 100;
const TOP = 50;
/** The axis starts this far into the plane. */
const MARGIN = 24;
/** A step's width in the three acts, fitted to the drawing's fallback width (960 less the names and margins). */
const STEP = 772 / 3;
/** The lanes' heights within the plane: Ships under the axis, Harbour under it. */
const SHIPS = TOP + 44 + 20;
const HARBOUR = TOP + 96 + 20;

const entry = (name: string) => screen.getByRole("button", { name });
const announced = () => screen.getByRole("status").textContent?.trim();
const grip = (n: number, part: "whole" | "start" | "end") =>
  document.querySelector(`[data-grip="${id(n)}"][data-part="${part}"]`)!;
const atStep = (value: number) => LEFT + MARGIN + value * STEP;

function drag(element: Element, from: [number, number], to: [number, number], end = true) {
  fireEvent.pointerDown(element, { clientX: from[0], clientY: from[1], button: 0, pointerId: 1 });
  fireEvent.pointerMove(element, { clientX: (from[0] + to[0]) / 2, clientY: (from[1] + to[1]) / 2, pointerId: 1 });
  fireEvent.pointerMove(element, { clientX: to[0], clientY: to[1], pointerId: 1 });
  if (end) fireEvent.pointerUp(element, { clientX: to[0], clientY: to[1], pointerId: 1 });
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: LEFT,
    top: TOP,
    right: LEFT + 960,
    bottom: TOP + 400,
    width: 960,
    height: 400,
    x: LEFT,
    y: TOP,
    toJSON: () => ({}),
  } as DOMRect);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dragging an entry on the drawing", () => {
  it("moves a point along the steps and to another lane, saying where, and keeps the focus on it", async () => {
    render(<Host initial={acts} />);
    const storm = entry("Ships: Storm, Act 3");
    drag(storm, [atStep(2.5), SHIPS], [atStep(1.6), HARBOUR]);
    expect(held.value!.entries[1]).toMatchObject({ start: { step: id(2) }, end: null, categoryId: id(11) });
    expect(announced()).toBe("Storm: moved to Harbour, Act 2");
    await act(nextTick);
    expect(document.activeElement).toHaveAccessibleName("Harbour: Storm, Act 2");
    // The click that ends a drag opens nothing; the next one opens the entry.
    fireEvent.click(document.activeElement!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(document.activeElement!);
    expect(screen.getByRole("dialog", { name: "Storm" })).toBeInTheDocument();
  });

  it("moves a span whole by its mark, keeping its length, and stops at the last step", () => {
    render(<Host initial={acts} />);
    drag(grip(20, "whole"), [atStep(1), SHIPS + 6], [atStep(2.9), SHIPS + 6]);
    expect(held.value!.entries[0]).toMatchObject({ start: { step: id(2) }, end: { step: id(3) }, categoryId: id(10) });
    expect(announced()).toBe("Fleet sails: moved to Act 2 – Act 3");
    // Only along the axis and in the same lane: the lane only.
    drag(grip(20, "whole"), [atStep(2), SHIPS + 6], [atStep(2), HARBOUR + 200]);
    expect(held.value!.entries[0]).toMatchObject({ start: { step: id(2) }, categoryId: id(11) });
    expect(announced()).toBe("Fleet sails: moved to Harbour");
  });

  it("resizes a span by either end, never past the other, and not to another lane", () => {
    render(<Host initial={acts} />);
    drag(grip(20, "end"), [atStep(1.5), SHIPS + 6], [atStep(2.5), HARBOUR]);
    expect(held.value!.entries[0]).toMatchObject({ start: { step: id(1) }, end: { step: id(3) }, categoryId: id(10) });
    expect(announced()).toBe("Fleet sails: now Act 1 – Act 3");
    drag(grip(20, "start"), [atStep(0.5), SHIPS + 6], [atStep(3), SHIPS + 6]);
    expect(held.value!.entries[0]).toMatchObject({ start: { step: id(2) }, end: { step: id(3) } });
    expect(announced()).toBe("Fleet sails: now Act 2 – Act 3");
  });

  it("draws a preview while dragging, and Escape or a cancelled pointer drops nothing", () => {
    const onChange = vi.fn();
    render(<Host initial={acts} onChange={onChange} />);
    const pier = entry("Harbour: Pier built, Act 1");
    drag(pier, [atStep(0.5), HARBOUR], [atStep(1.5), SHIPS], false);
    expect(pier).toHaveAttribute("data-dragging", "whole");
    expect(pier).toHaveAttribute("title", "Act 2");
    expect(document.querySelector(".eh-timeline-preview")).toHaveTextContent("Act 2");
    fireEvent.keyDown(pier, { key: "Escape" });
    expect(pier).not.toHaveAttribute("data-dragging");
    expect(document.querySelector(".eh-timeline-preview")).toBeNull();
    fireEvent.pointerMove(pier, { clientX: atStep(2.5), clientY: SHIPS, pointerId: 1 });
    fireEvent.pointerUp(pier, { clientX: atStep(2.5), clientY: SHIPS, pointerId: 1 });
    drag(pier, [atStep(0.5), HARBOUR], [atStep(1.5), SHIPS], false);
    fireEvent.pointerCancel(pier, { pointerId: 1 });
    fireEvent.pointerUp(pier, { clientX: atStep(1.5), clientY: SHIPS, pointerId: 1 });
    // A drag back to where it began changes nothing either.
    drag(pier, [atStep(0.5), HARBOUR], [atStep(0.7), HARBOUR + 10]);
    expect(onChange).not.toHaveBeenCalled();
    expect(held.value).toBe(acts);
  });

  it("opens an entry on a click that hardly moves, and drags nothing with another button", () => {
    const onChange = vi.fn();
    render(<Host initial={acts} onChange={onChange} />);
    const pier = entry("Harbour: Pier built, Act 1");
    fireEvent.pointerDown(pier, { clientX: atStep(0.5), clientY: HARBOUR, button: 2, pointerId: 1 });
    fireEvent.pointerMove(pier, { clientX: atStep(2.5), clientY: HARBOUR, pointerId: 1 });
    fireEvent.pointerUp(pier, { clientX: atStep(2.5), clientY: HARBOUR, pointerId: 1 });
    drag(pier, [atStep(0.5), HARBOUR], [atStep(0.5) + 2, HARBOUR + 2]);
    expect(pier).not.toHaveAttribute("data-dragging");
    fireEvent.click(pier);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Pier built" })).toBeInTheDocument();
  });

  it("snaps dates to the entry's precision: days, or months", () => {
    // Two days ten days apart: the axis runs from a day before the first to a day after the last, 13 days.
    const days = harbour([e(20, d(1066, 10, 14), null, id(10), { title: "Opening" }), e(21, d(1066, 10, 24))]);
    const { unmount } = render(<Host initial={days} />);
    const day = 592 / 13;
    const opening = entry("Ships: Opening, 14 October 1066");
    drag(opening, [LEFT + MARGIN + day * 1.5, SHIPS], [LEFT + MARGIN + day * 4.4, SHIPS]);
    expect(held.value!.entries[0]!.start).toEqual(d(1066, 10, 17));
    expect(announced()).toBe("Opening: moved to 17 October 1066");
    unmount();

    const months = harbour([e(20, d(1066, 3), null, id(10), { title: "Spring" }), e(21, d(1067, 3))]);
    render(<Host initial={months} />);
    const spring = entry("Ships: Spring, March 1066");
    const at = (value: number) => LEFT + MARGIN + value * (592 / scaleDays(months));
    drag(spring, [at(10), SHIPS], [at(10 + 61), HARBOUR]);
    expect(held.value!.entries[0]).toMatchObject({ start: d(1066, 5), categoryId: id(11) });
    expect(announced()).toBe("Spring: moved to Harbour, May 1066");
  });

  it("offers no dragging in a read-only timeline", () => {
    const onChange = vi.fn();
    render(<Timeline value={acts} onChange={onChange} readOnly />);
    expect(document.querySelector("[data-grip]")).toBeNull();
    const storm = entry("Ships: Storm, Act 3");
    drag(storm, [atStep(2.5), SHIPS], [atStep(0.5), HARBOUR]);
    expect(storm).not.toHaveAttribute("data-dragging");
    expect(onChange).not.toHaveBeenCalled();
  });
});

/** The days a Dates timeline's axis spans, drawn to scale (no breaks in these). */
function scaleDays(timeline: Parameters<typeof scaleOf>[0]): number {
  const scale = scaleOf(timeline, 592, 1)!;
  return scale.width / scale.unit;
}

describe("how far a drag goes", () => {
  it("counts steps to the nearest in a Sequence", () => {
    const [fleet] = acts.entries;
    expect(dragCount(acts, fleet!, "whole", 0.6)).toBe(1);
    expect(dragCount(acts, fleet!, "end", -1.4)).toBe(-1);
    expect(dragCount(acts, fleet!, "start", 0.4)).toBe(0);
  });

  it("counts years, months or days in Dates, once the middle of the part's period has moved into the next", () => {
    const span = e(20, d(1066, 10, 14), d(1070));
    const timeline = dated([span, e(21, d(1066, 3))]);
    // The whole span moves by years (its coarsest date); the middle of 1066 is early July.
    expect(dragCount(timeline, span, "whole", 100)).toBe(0);
    expect(dragCount(timeline, span, "whole", 190)).toBe(1);
    expect(dragCount(timeline, span, "whole", -200)).toBe(-1);
    // Its start moves by days, its end by years.
    expect(dragCount(timeline, span, "start", 2.4)).toBe(2);
    expect(dragCount(timeline, span, "start", 2.6)).toBe(3);
    expect(dragCount(timeline, span, "end", 365 * 3)).toBe(3);
    // March 1066 moves by months.
    expect(dragCount(timeline, timeline.entries[1]!, "whole", 61)).toBe(2);
    expect(dragCount(timeline, timeline.entries[1]!, "whole", -20)).toBe(-1);
    // An end an entry does not have, or a point of the wrong kind, does not move.
    expect(dragCount(timeline, timeline.entries[1]!, "end", 400)).toBe(0);
    expect(dragCount(timeline, e(22, { step: id(1) }), "whole", 400)).toBe(0);
  });

  it("finds the lane under the pointer, the first above the lanes and the last below them", () => {
    const lanes = lanesOf(acts, scaleOf(acts, 772, 1)!, 44);
    expect(laneAt(lanes, 0)?.category.id).toBe(id(10));
    expect(laneAt(lanes, 44 + 60)?.category.id).toBe(id(11));
    expect(laneAt(lanes, 5000)?.category.id).toBe(id(11));
    expect(laneAt([], 10)).toBeUndefined();
  });
});
