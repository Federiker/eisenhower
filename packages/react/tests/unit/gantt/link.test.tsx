import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslate } from "../../../src";
import { latest, setup, task, taskOf } from "./fixtures";

const t = createTranslate();
const bar = (name: RegExp) => screen.getByRole("button", { name });
const announced = () => screen.getByRole("status").textContent?.trim();
const rowOf = (element: HTMLElement) => element.closest<HTMLElement>("[data-row-key]")!;
const label = () => document.querySelector(".eh-gantt-link-label")?.textContent;

/** Puts the pointer over an element: happy-dom draws nothing, so the element under the pointer is stubbed. */
function over(element: Element | null) {
  vi.spyOn(document, "elementFromPoint").mockReturnValue(element);
}

/** A link drag from one bar: Ctrl held as it starts, the pointer over each element in turn, then the drop. */
function link(from: HTMLElement, ...path: (Element | null)[]) {
  fireEvent.pointerDown(from, { clientX: 10, clientY: 10, button: 0, pointerId: 1, ctrlKey: true });
  for (const element of path) {
    over(element);
    fireEvent.pointerMove(from, { clientX: 40, clientY: 60, pointerId: 1 });
  }
  fireEvent.pointerUp(from, { pointerId: 1 });
}

afterEach(() => vi.restoreAllMocks());

describe("linking tasks with Ctrl+drag", () => {
  it("makes the task dropped on, anywhere in its row, depend on the task dragged from", () => {
    setup({ scale: "day" });
    const sketch = bar(/^Sketch/);
    fireEvent.pointerDown(sketch, { clientX: 10, clientY: 10, button: 0, pointerId: 1, ctrlKey: true });
    expect(rowOf(sketch)).toHaveAttribute("data-link", "source");
    over(null);
    fireEvent.pointerMove(sketch, { clientX: 20, clientY: 20, pointerId: 1 });
    expect(label()).toBe("Drop on a task that depends on Sketch");
    // The name cell of Paint's row takes the drop as well as its bar.
    over(rowOf(bar(/^Paint/)).querySelector(".eh-gantt-task-name"));
    fireEvent.pointerMove(sketch, { clientX: 30, clientY: 60, pointerId: 1 });
    expect(rowOf(bar(/^Paint/))).toHaveAttribute("data-link", "target");
    expect(label()).toBe("Paint depends on Sketch");
    expect(document.querySelector(".eh-gantt-link")).not.toHaveAttribute("data-refused");
    fireEvent.pointerUp(sketch, { pointerId: 1 });
    expect(taskOf("paint").dependsOn).toEqual(["sketch"]);
    expect(taskOf("sketch").dependsOn).toEqual([]);
    expect(announced()).toBe("Paint now depends on Sketch");
    expect(document.querySelector(".eh-gantt-link")).toBeNull();
    expect(rowOf(bar(/^Paint/))).not.toHaveAttribute("data-link");
  });

  it("previews a link that cannot be made in the problem colour, and refuses it with the reason", () => {
    setup({ scale: "day" });
    // Frame depends on Sketch, so Sketch cannot depend on Frame: Frame dragged onto Sketch is refused.
    const frame = bar(/^Frame/);
    fireEvent.pointerDown(frame, { clientX: 10, clientY: 10, button: 0, pointerId: 1, ctrlKey: true });
    over(bar(/^Sketch/));
    fireEvent.pointerMove(frame, { clientX: 30, clientY: 60, pointerId: 1 });
    expect(rowOf(bar(/^Sketch/))).toHaveAttribute("data-link", "refused");
    expect(document.querySelector(".eh-gantt-link")).toHaveAttribute("data-refused", "true");
    expect(label()).toBe(t("gantt.problem.linkCycle"));
    fireEvent.pointerUp(frame, { pointerId: 1 });
    expect(taskOf("sketch").dependsOn).toEqual([]);
    expect(announced()).toBe(t("gantt.problem.linkCycle"));
    expect(document.querySelector(".eh-gantt-problem")).toHaveTextContent(t("gantt.problem.linkCycle"));

    link(bar(/^Sketch/), bar(/^Frame/));
    expect(taskOf("frame").dependsOn).toEqual(["sketch"]);
    expect(announced()).toBe(t("gantt.problem.linkDuplicate"));

    link(bar(/^Brief/), screen.getByRole("button", { name: /^Design,/ }));
    expect(taskOf("brief").dependsOn).toEqual([]);
    expect(announced()).toBe(t("gantt.problem.linkGroup"));
  });

  it("links nothing dropped on the task itself or outside the rows", () => {
    setup({ scale: "day" });
    const before = latest.chart;
    link(bar(/^Paint/), bar(/^Paint/));
    link(bar(/^Paint/), document.body);
    expect(latest.chart).toBe(before);
  });

  it("cancels with Escape or a cancelled pointer", () => {
    setup({ scale: "day" });
    const paint = bar(/^Paint/);
    fireEvent.pointerDown(paint, { clientX: 10, clientY: 10, button: 0, pointerId: 1, ctrlKey: true });
    over(bar(/^Sketch/));
    fireEvent.pointerMove(paint, { clientX: 30, clientY: 60, pointerId: 1 });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(document.querySelector(".eh-gantt-link")).toBeNull();
    fireEvent.pointerUp(paint, { pointerId: 1 });
    expect(taskOf("paint").dependsOn).toEqual([]);

    fireEvent.pointerDown(paint, { clientX: 10, clientY: 10, button: 0, pointerId: 1, ctrlKey: true });
    fireEvent.pointerMove(paint, { clientX: 30, clientY: 60, pointerId: 1 });
    fireEvent.keyDown(paint, { key: "Escape" });
    expect(document.querySelector(".eh-gantt-link")).toBeNull();

    fireEvent.pointerDown(paint, { clientX: 10, clientY: 10, button: 0, pointerId: 1, ctrlKey: true });
    fireEvent.pointerCancel(paint, { pointerId: 1 });
    expect(document.querySelector(".eh-gantt-link")).toBeNull();
    expect(taskOf("paint").dependsOn).toEqual([]);
  });

  it("uses ⌘ on macOS, where Ctrl+click is the context menu", () => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    setup({ scale: "day" });
    expect(screen.getByText(/⌘\+drag from a task onto another/)).toBeInTheDocument();
    link(bar(/^Paint/), bar(/^Sketch/));
    expect(taskOf("paint").dependsOn).toEqual([]);
    const sketch = bar(/^Sketch/);
    fireEvent.pointerDown(sketch, { clientX: 10, clientY: 10, button: 0, pointerId: 1, metaKey: true });
    over(bar(/^Paint/));
    fireEvent.pointerMove(sketch, { clientX: 30, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(sketch, { pointerId: 1 });
    expect(taskOf("paint").dependsOn).toEqual(["sketch"]);
  });

  it("says how in the help, and does not link in a read-only chart", () => {
    const { unmount } = setup({ scale: "day" });
    expect(screen.getByText(/Ctrl\+drag from a task onto another to make that one depend on it\./)).toBeInTheDocument();
    unmount();
    setup({ scale: "day", readOnly: true });
    link(bar(/^Paint/), bar(/^Sketch/));
    expect(taskOf("paint").dependsOn).toEqual([]);
    expect(document.querySelector(".eh-gantt-link")).toBeNull();
  });
});

describe("linking tasks with the menu's Depends on…", () => {
  const choose = (name: RegExp) => {
    act(() => bar(name).focus());
    fireEvent.keyDown(bar(name), { key: "F10", shiftKey: true });
    fireEvent.click(screen.getByRole("menuitem", { name: t("gantt.dependsOn") }));
  };

  it("lists the tasks it may depend on in the rows' order, the first chosen, and adds the one chosen", () => {
    setup();
    choose(/^Paint/);
    const dialog = screen.getByRole("dialog", { name: "Paint depends on…" });
    // Not Paint itself, nor the Release that depends on it.
    expect(
      within(dialog)
        .getAllByRole("radio")
        .map((radio) => radio.parentElement?.textContent),
    ).toEqual(["Brief", "Sketch", "Review", "Frame"]);
    expect(within(dialog).getByRole("radio", { name: "Brief" })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole("radio", { name: "Sketch" }));
    fireEvent.click(within(dialog).getByRole("button", { name: t("gantt.dependsOnConfirm") }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(taskOf("paint").dependsOn).toEqual(["sketch"]);
    expect(announced()).toBe("Paint now depends on Sketch");
    expect(bar(/^Paint/)).toHaveFocus();
  });

  it("leaves out the tasks it already depends on, and Cancel changes nothing", () => {
    setup();
    choose(/^Frame/);
    const dialog = screen.getByRole("dialog", { name: "Frame depends on…" });
    expect(within(dialog).queryByRole("radio", { name: "Sketch" })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: t("common.cancel") }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(taskOf("frame").dependsOn).toEqual(["sketch"]);
    expect(bar(/^Frame/)).toHaveFocus();
  });

  it("says when there is no task it can depend on", () => {
    setup({}, { groups: [], tasks: [task("only", "Only", "2026-11-05", "2026-11-06")] });
    choose(/^Only/);
    const dialog = screen.getByRole("dialog", { name: "Only depends on…" });
    expect(within(dialog).getByText(t("gantt.noPredecessors"))).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: t("gantt.dependsOnConfirm") })).toBeDisabled();
  });
});
