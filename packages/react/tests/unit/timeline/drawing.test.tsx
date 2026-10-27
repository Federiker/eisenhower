import { emptyTimeline } from "@eisenhower/model";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Timeline } from "../../../src";
import { TimelineNarrowList } from "../../../src/timeline/TimelineNarrowList";
import { acts, d, dated, e, harbour, id } from "./fixtures";
import { Host, held, nextTick } from "./host";

afterEach(() => {
  vi.restoreAllMocks();
});

/** Two entries a century apart, which zoom in a long way. */
const far = dated([e(20, d(1900)), e(21, d(2000))]);
const entry = (name: string) => screen.getByRole("button", { name });
const planeWidth = () =>
  Number(
    document
      .querySelector(".eh-timeline-plane")!
      .getAttribute("style")!
      .match(/width: ([\d.]+)/)![1],
  );

// Copied from jerome's timeline-drawing.test.tsx, made generic and controlled.
describe("the timeline drawing", () => {
  it("shows each entry as a button named by its lane, title and place, in time order", () => {
    render(<Timeline value={acts} />);
    const names = [...document.querySelectorAll(".eh-timeline-label")].map((button) =>
      button.getAttribute("aria-label"),
    );
    expect(names).toEqual(["Ships: Fleet sails, Act 1 to Act 2", "Harbour: Pier built, Act 1", "Ships: Storm, Act 3"]);
    expect(screen.getByText("Act 2", { selector: "text" })).toBeInTheDocument();
    const lanes = document.querySelector(".eh-timeline-lane-names")!;
    expect(lanes.textContent).toContain("Ships");
    expect(lanes.textContent).toContain("Harbour");
    expect(screen.getByRole("button", { name: "New entry" })).toBeInTheDocument();
  });

  it("opens an entry, moves between entries with the arrows, Home and End, and starts one by double-clicking a lane", async () => {
    render(<Host initial={acts} />);
    const fleet = entry("Ships: Fleet sails, Act 1 to Act 2");
    fireEvent.click(fleet);
    expect(screen.getByRole("dialog", { name: "Fleet sails" })).toBeInTheDocument();
    expect(fleet).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fleet.focus();
    fireEvent.keyDown(fleet, { key: "ArrowRight" });
    expect(document.activeElement).toHaveAccessibleName("Harbour: Pier built, Act 1");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toHaveAccessibleName("Ships: Storm, Act 3");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(document.activeElement).toHaveAccessibleName("Ships: Storm, Act 3");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
    expect(document.activeElement).toHaveAccessibleName("Harbour: Pier built, Act 1");
    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(document.activeElement).toBe(fleet);
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(document.activeElement).toHaveAccessibleName("Ships: Storm, Act 3");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(document.activeElement).toHaveAccessibleName("Harbour: Pier built, Act 1");
    fireEvent.keyDown(document.activeElement!, { key: "F2" });
    expect(screen.getByRole("dialog", { name: "Pier built" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    // A double-click on the harbour's lane, in the third column, starts an entry there.
    const lane = document.querySelector(`.eh-timeline-lane-hit[data-category="${id(11)}"]`)!;
    fireEvent.doubleClick(lane, { clientX: 24 + planeWidth() * 0.8 });
    const form = screen.getByRole("dialog", { name: "New entry" });
    expect(within(form).getByLabelText("Category")).toHaveValue(id(11));
    expect(within(form).getByLabelText("At")).toHaveValue(id(3));
    expect(within(form).getByLabelText("Title")).toHaveFocus();
    fireEvent.change(within(form).getByLabelText("Title"), { target: { value: "Lighthouse" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(held.value!.entries.at(-1)).toMatchObject({
      title: "Lighthouse",
      categoryId: id(11),
      start: { step: id(3) },
      end: null,
    });
    await act(nextTick);
    expect(document.activeElement).toHaveAccessibleName("Harbour: Lighthouse, Act 3");
  });

  it("offers Edit and Delete for a drawn entry, by right-click or the Menu key, and asks before deleting", async () => {
    render(<Host initial={acts} />);
    fireEvent.contextMenu(entry("Ships: Storm, Act 3"));
    const menu = screen.getByRole("menu", { name: "Entry actions: Storm" });
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Edit" }));
    expect(screen.getByRole("dialog", { name: "Storm" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const pier = entry("Harbour: Pier built, Act 1");
    pier.focus();
    fireEvent.keyDown(pier, { key: "F10", shiftKey: true });
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Edit" }), { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(pier).toHaveFocus();
    fireEvent.keyDown(pier, { key: "ContextMenu" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    const question = screen.getByRole("alertdialog", { name: "Delete entry" });
    expect(question).toHaveTextContent("Delete Pier built? The entry is deleted from the timeline.");
    fireEvent.click(within(question).getByRole("button", { name: "Cancel" }));
    expect(pier).toHaveFocus();
    fireEvent.keyDown(pier, { key: "Delete" });
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(pier).toHaveFocus();
    fireEvent.keyDown(pier, { key: "Delete" });
    fireEvent.click(screen.getByRole("button", { name: "Delete the entry" }));
    expect(held.value!.entries.map((each) => each.title)).toEqual(["Fleet sails", "Storm"]);
    // The entry in its place takes the focus.
    await act(nextTick);
    expect(document.activeElement).toHaveAccessibleName("Ships: Storm, Act 3");
  });

  it("moves an entry with Alt and an arrow, a lane or a step at a time, keeping the focus and saying where", async () => {
    render(<Host initial={acts} />);
    const fleet = entry("Ships: Fleet sails, Act 1 to Act 2");
    fleet.focus();
    fireEvent.keyDown(fleet, { key: "ArrowDown", altKey: true });
    expect(held.value!.entries[0]!.categoryId).toBe(id(11));
    expect(screen.getByRole("status")).toHaveTextContent("Fleet sails: moved to Harbour");
    await act(nextTick);
    expect(document.activeElement).toHaveAccessibleName("Harbour: Fleet sails, Act 1 to Act 2");
    // Nowhere to go below the last lane, or after the last step: nothing happens.
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown", altKey: true });
    expect(held.value!.entries[0]!.categoryId).toBe(id(11));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight", altKey: true });
    expect(held.value!.entries[0]).toMatchObject({ start: { step: id(2) }, end: { step: id(3) } });
    expect(screen.getByRole("status")).toHaveTextContent("Fleet sails: moved to Act 2 – Act 3");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight", altKey: true });
    expect(held.value!.entries[0]).toMatchObject({ start: { step: id(2) } });
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft", altKey: true });
    fireEvent.keyDown(document.activeElement!, { key: "ArrowUp", altKey: true });
    expect(held.value!.entries[0]).toMatchObject({ categoryId: id(10), start: { step: id(1) } });
  });

  it("moves a dated entry by its precision", () => {
    render(<Host initial={harbour([e(20, d(1066, 10, 14), null, id(10), { title: "Opening" }), e(21, d(1100))])} />);
    const opening = entry("Ships: Opening, 14 October 1066");
    opening.focus();
    fireEvent.keyDown(opening, { key: "ArrowRight", altKey: true });
    expect(held.value!.entries[0]!.start).toEqual(d(1066, 10, 15));
    expect(screen.getByRole("status")).toHaveTextContent("Opening: moved to 15 October 1066");
  });

  it("zooms with its buttons and the keys, and tells the host the zoom", () => {
    const onZoomChange = vi.fn();
    render(<Host initial={far} onZoomChange={onZoomChange} />);
    const zoom = screen.getByRole("group", { name: "Zoom" });
    expect(within(zoom).getByRole("button", { name: "Zoom out" })).toBeDisabled();
    const fitted = planeWidth();
    fireEvent.click(within(zoom).getByRole("button", { name: "Zoom in" }));
    expect(planeWidth()).toBeGreaterThan(fitted);
    expect(onZoomChange).toHaveBeenLastCalledWith(1.5);
    const scroll = document.querySelector(".eh-timeline-scroll")!;
    fireEvent.keyDown(scroll, { key: "=", ctrlKey: true });
    expect(onZoomChange).toHaveBeenLastCalledWith(expect.any(Number));
    fireEvent.keyDown(scroll, { key: "-", ctrlKey: true });
    fireEvent.keyDown(scroll, { key: "x", ctrlKey: true });
    fireEvent.wheel(scroll, { deltaY: -1, ctrlKey: true });
    fireEvent.wheel(scroll, { deltaY: 1 });
    expect(within(zoom).getByRole("button", { name: "Zoom out" })).toBeEnabled();
    fireEvent.keyDown(scroll, { key: "0", ctrlKey: true });
    expect(planeWidth()).toBe(fitted);
    fireEvent.click(within(zoom).getByRole("button", { name: "Zoom in" }));
    fireEvent.click(within(zoom).getByRole("button", { name: "Zoom out" }));
    fireEvent.wheel(scroll, { deltaY: 1, ctrlKey: true });
    fireEvent.click(within(zoom).getByRole("button", { name: "Fit" }));
    expect(onZoomChange).toHaveBeenLastCalledWith(1);
  });

  it("takes its zoom from the host when the host keeps it", () => {
    const onZoomChange = vi.fn();
    const { rerender } = render(<Timeline value={far} zoom={1} onZoomChange={onZoomChange} />);
    const fitted = planeWidth();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(onZoomChange).toHaveBeenCalledWith(1.5);
    expect(planeWidth()).toBe(fitted);
    rerender(<Timeline value={far} zoom={1.5} onZoomChange={onZoomChange} />);
    expect(planeWidth()).toBeGreaterThan(fitted);
    render(<Timeline value={far} defaultZoom={1.5} />);
    expect(screen.getAllByRole("button", { name: "Zoom out" })[1]).toBeEnabled();
  });

  it("says what is missing before anything can be drawn or added", () => {
    const { rerender } = render(<Host initial={{ ...acts, entries: [], steps: [] }} />);
    expect(screen.getByText("Nothing to draw yet: add steps, then entries.")).toBeInTheDocument();
    expect(screen.getByText("Add a step first: every entry is at one.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New entry" })).toBeDisabled();
    rerender(<Timeline value={emptyTimeline("dates")} onChange={vi.fn()} />);
    expect(screen.getByText("Nothing to draw yet: add an entry.")).toBeInTheDocument();
    expect(screen.getByText("Add a category first: every entry belongs to one.")).toBeInTheDocument();
    rerender(<Timeline value={dated([])} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "New entry" }));
    expect(screen.getByRole("dialog", { name: "New entry" })).toBeInTheDocument();
  });

  it("draws dates with their periods, approximate ends and breaks", () => {
    render(
      <Timeline
        value={dated([
          e(20, d(-9699, null, null, true)),
          e(21, d(1066, 3), null),
          e(22, d(1066, 5, 1, true), d(1087, 1, 1, true)),
          e(23, d(1086)),
        ])}
        selectedId={id(21)}
      />,
    );
    expect(document.querySelectorAll(".eh-timeline-approximate")).toHaveLength(3);
    expect(document.querySelectorAll(".eh-timeline-break")).toHaveLength(1);
    expect(document.querySelector('g[data-selected="true"]')).not.toBeNull();
    expect(entry("Main: Entry 21, March 1066 CE")).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("9700 BCE")).toBeInTheDocument();
  });
});

describe("a read-only timeline", () => {
  it("opens entries to read, without New entry, menus, moves or deleting", () => {
    render(<Timeline value={acts} readOnly />);
    expect(screen.queryByRole("button", { name: "New entry" })).not.toBeInTheDocument();
    const storm = entry("Ships: Storm, Act 3");
    fireEvent.contextMenu(storm);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    storm.focus();
    fireEvent.keyDown(storm, { key: "Delete" });
    fireEvent.keyDown(storm, { key: "ArrowLeft", altKey: true });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("");
    fireEvent.doubleClick(document.querySelector(".eh-timeline-lane-hit")!, { clientX: 100 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(storm);
    const dialog = screen.getByRole("dialog", { name: "Storm" });
    expect(within(dialog).getByLabelText("Title")).toBeDisabled();
    expect(within(dialog).queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("a host's own entry editor", () => {
  it("is asked to open entries, new ones with where they were begun", () => {
    const onOpenEntry = vi.fn();
    render(<Host initial={acts} onOpenEntry={onOpenEntry} selectedId={id(21)} />);
    fireEvent.click(entry("Ships: Fleet sails, Act 1 to Act 2"));
    expect(onOpenEntry).toHaveBeenLastCalledWith(id(20), null);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(entry("Ships: Storm, Act 3")).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByRole("button", { name: "New entry" }));
    expect(onOpenEntry).toHaveBeenLastCalledWith(expect.any(String), null);
    expect(acts.entries.map((each) => each.id)).not.toContain(onOpenEntry.mock.lastCall![0]);
    fireEvent.doubleClick(document.querySelector(`.eh-timeline-lane-hit[data-category="${id(10)}"]`)!, {
      clientX: 24 + planeWidth() * 0.5,
    });
    expect(onOpenEntry).toHaveBeenLastCalledWith(expect.any(String), { categoryId: id(10), start: { step: id(2) } });
  });
});

describe("in a narrow space", () => {
  it("becomes a list grouped by where entries start, with the same menu and keys", async () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(480);
    render(<Host initial={acts} />);
    const groups = screen.getAllByRole("region");
    expect(groups.map((group) => group.getAttribute("aria-label"))).toEqual(["Act 1", "Act 3"]);
    const fleet = within(groups[0]!).getByRole("button", { name: "Fleet sails" });
    expect(groups[0]!.textContent).toContain("to Act 2");
    expect(groups[0]!.textContent).toContain("Harbour");
    fireEvent.contextMenu(within(groups[1]!).getByRole("button", { name: "Storm" }));
    expect(screen.getByRole("menu", { name: "Entry actions: Storm" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Edit" }), { key: "Escape" });
    fireEvent.keyDown(fleet, { key: "ContextMenu" });
    expect(screen.getByRole("menu", { name: "Entry actions: Fleet sails" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Edit" }), { key: "Escape" });
    fireEvent.keyDown(fleet, { key: "x" });
    fireEvent.click(fleet);
    expect(screen.getByRole("dialog", { name: "Fleet sails" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const storm = within(groups[1]!).getByRole("button", { name: "Storm" });
    storm.focus();
    fireEvent.keyDown(storm, { key: "Delete" });
    fireEvent.click(screen.getByRole("button", { name: "Delete the entry" }));
    expect(held.value!.entries.map((each) => each.title)).toEqual(["Fleet sails", "Pier built"]);
    await act(nextTick);
    expect(document.activeElement).toHaveAccessibleName("Fleet sails");
  });
});

describe("a timeline's part", () => {
  it("is drawn inside a timeline view only", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<TimelineNarrowList />)).toThrow("inside <Timeline> or <TimelineEditor>");
  });
});
