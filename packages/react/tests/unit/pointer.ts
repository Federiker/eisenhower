/**
 * Pointer drags for the views' tests (the board's and the todo list's, as the gantt chart's): happy-dom draws
 * nothing, so the element under the pointer is stubbed with `document.elementFromPoint`.
 */
import { fireEvent } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => vi.restoreAllMocks());

/** Puts the pointer over an element (null: over nothing). */
export function over(element: Element | null) {
  vi.spyOn(document, "elementFromPoint").mockReturnValue(element);
}

/** A press with the main button (or another, given as `button`) on an element. */
export function press(on: Element, init: { button?: number } = {}) {
  fireEvent.pointerDown(on, { clientX: 10, clientY: 10, button: 0, pointerId: 1, ...init });
}

/** The pointer moved over an element, far enough from the press to make it a drag. */
export function moveOver(from: Element, to: Element | null) {
  over(to);
  fireEvent.pointerMove(from, { clientX: 40, clientY: 60, pointerId: 1 });
}

/** The pointer let go. */
export function release(from: Element) {
  fireEvent.pointerUp(from, { pointerId: 1 });
}

/**
 * A whole drag: pressed on `from`, moved over each element in turn, then let go, and the click a browser sends
 * after it (on the page, the pointer having been captured).
 */
export function drag(from: Element, ...path: (Element | null)[]) {
  press(from);
  for (const to of path) moveOver(from, to);
  release(from);
  fireEvent.click(document.body);
}

/** A press moved less than the 4 pixels that make a drag, then let go: a click, as far as the view goes. */
export function nudge(on: Element) {
  press(on);
  over(on);
  fireEvent.pointerMove(on, { clientX: 13, clientY: 12, pointerId: 1 });
  release(on);
}
