import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { announced, check, current, dataTransfer, find, item, itemOf, LIST, menuTexts, show, t } from "./fixtures";

const quadrant = (name: string) => screen.getByRole("region", { name });
const titlesIn = (name: string) =>
  within(quadrant(name))
    .queryAllByRole("checkbox")
    .map((one) => one.getAttribute("aria-label"));
const [DO, SCHEDULE, DELEGATE, DROP] = (["do", "schedule", "delegate", "drop"] as const).map((one) =>
  t(`todo.quadrant.${one}`),
) as [string, string, string, string];

describe("the Eisenhower matrix", () => {
  it("shows four named and described quadrants in reading order, done items hidden", () => {
    show({ layout: "matrix" });
    const regions = screen.getAllByRole("region");
    expect(regions.map((one) => one.getAttribute("data-quadrant"))).toEqual(["do", "schedule", "delegate", "drop"]);
    expect(quadrant(DO)).toHaveAccessibleDescription(t("todo.quadrantAbout.do"));
    expect(quadrant(DROP)).toHaveAccessibleDescription(t("todo.quadrantAbout.drop"));
    expect(titlesIn(DO)).toEqual(["Book flights"]);
    expect(titlesIn(SCHEDULE)).toEqual(["Paint the shed"]);
    expect(titlesIn(DELEGATE)).toEqual(["Sand the walls"]);
    expect(titlesIn(DROP)).toEqual([]);
    expect(within(quadrant(DROP)).getByText(t("todo.quadrantEmpty"))).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: t("todo.hideDone") })).toBeChecked();
  });

  it("shows done items when asked, and a subtask's parent", () => {
    show({ layout: "matrix" });
    fireEvent.click(screen.getByRole("switch", { name: t("todo.hideDone") }));
    expect(titlesIn(SCHEDULE)).toEqual(["Paint the shed", "Buy paint"]);
    expect(titlesIn(DROP)).toEqual(["Read a novel"]);
    expect(within(itemOf("Sand the walls")).getByText(t("todo.subtaskOf", { title: "Paint the shed" }))).toBeVisible();
  });

  it("switches between the list and the matrix, each with its own Hide done", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: t("todo.layoutMatrix") }));
    expect(screen.getByRole("button", { name: t("todo.layoutMatrix") })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("region")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: t("todo.layoutList") }));
    expect(screen.queryAllByRole("region")).toHaveLength(0);
    expect(screen.getByRole("switch", { name: t("todo.hideDone") })).not.toBeChecked();
  });

  it("moves an item to the quadrant beside with Alt and an arrow, changing its flags", () => {
    show({ layout: "matrix" });
    check("Book flights").focus();
    fireEvent.keyDown(check("Book flights"), { key: "ArrowRight", altKey: true });
    expect(find("b")).toMatchObject({ urgent: false, important: true });
    expect(titlesIn(SCHEDULE)).toEqual(["Paint the shed", "Book flights"]);
    expect(check("Book flights")).toHaveFocus();
    expect(announced()).toBe(t("todo.announce.quadrant", { title: "Book flights", quadrant: SCHEDULE }));
    fireEvent.keyDown(check("Book flights"), { key: "ArrowDown", altKey: true });
    expect(titlesIn(DROP)).toEqual(["Book flights"]);
    fireEvent.keyDown(check("Book flights"), { key: "ArrowLeft", altKey: true });
    expect(titlesIn(DELEGATE)).toEqual(["Sand the walls", "Book flights"]);
    fireEvent.keyDown(check("Book flights"), { key: "ArrowUp", altKey: true });
    expect(find("b")).toMatchObject({ urgent: true, important: true });
    // Not past the grid's edge.
    fireEvent.keyDown(check("Book flights"), { key: "ArrowUp", altKey: true });
    fireEvent.keyDown(check("Book flights"), { key: "ArrowLeft", altKey: true });
    expect(find("b")).toMatchObject({ urgent: true, important: true });
  });

  it("moves the focus within a quadrant and across the grid", () => {
    show({ layout: "matrix", hideDone: false });
    check("Paint the shed").focus();
    fireEvent.keyDown(check("Paint the shed"), { key: "ArrowDown" });
    expect(check("Buy paint")).toHaveFocus();
    fireEvent.keyDown(check("Buy paint"), { key: "ArrowDown" });
    expect(check("Read a novel")).toHaveFocus();
    fireEvent.keyDown(check("Read a novel"), { key: "ArrowLeft" });
    expect(check("Sand the walls")).toHaveFocus();
    fireEvent.keyDown(check("Sand the walls"), { key: "ArrowUp" });
    expect(check("Book flights")).toHaveFocus();
    fireEvent.keyDown(check("Book flights"), { key: "ArrowRight" });
    expect(check("Paint the shed")).toHaveFocus();
    fireEvent.keyDown(check("Paint the shed"), { key: "End" });
    expect(check("Buy paint")).toHaveFocus();
  });

  it("moves an item dragged to a quadrant there", () => {
    show({ layout: "matrix" });
    const data = dataTransfer();
    fireEvent.dragStart(itemOf("Book flights"), { dataTransfer: data });
    fireEvent.dragOver(quadrant(DROP), { dataTransfer: data });
    expect(quadrant(DROP)).toHaveAttribute("data-drop", "inside");
    fireEvent.dragLeave(quadrant(DROP), { dataTransfer: data });
    expect(quadrant(DROP)).not.toHaveAttribute("data-drop");
    fireEvent.dragOver(itemOf("Sand the walls"), { dataTransfer: data });
    fireEvent.drop(itemOf("Sand the walls"), { dataTransfer: data });
    expect(find("b")).toMatchObject({ urgent: true, important: false });
    expect(titlesIn(DELEGATE)).toEqual(["Sand the walls", "Book flights"]);
    // Dropped back in its own quadrant, it stays as it was, unannounced.
    const before = current;
    const said = announced();
    fireEvent.dragStart(itemOf("Book flights"), { dataTransfer: data });
    fireEvent.drop(quadrant(DELEGATE), { dataTransfer: data });
    expect(current).toBe(before);
    expect(announced()).toBe(said);
  });

  it("adds an item to a quadrant with its flags", () => {
    show({ layout: "matrix" });
    const field = within(quadrant(DELEGATE)).getByRole("textbox", {
      name: t("todo.newItemIn", { quadrant: DELEGATE }),
    });
    fireEvent.change(field, { target: { value: "Ask a neighbour to water the plants" } });
    fireEvent.submit(field);
    expect(current.items.at(-1)).toMatchObject({ urgent: true, important: false });
    expect(titlesIn(DELEGATE)).toEqual(["Sand the walls", "Ask a neighbour to water the plants"]);
  });

  it("offers the quadrants, not the list's moves, in an item's menu", () => {
    show({ layout: "matrix" });
    fireEvent.keyDown(check("Sand the walls"), { key: "F10", shiftKey: true });
    expect(menuTexts(screen.getByRole("menu"))).toEqual([
      t("todo.details"),
      t("todo.rename"),
      t("todo.moveToQuadrant", { quadrant: DO }),
      t("todo.moveToQuadrant", { quadrant: SCHEDULE }),
      t("todo.moveToQuadrant", { quadrant: DROP }),
      t("todo.delete"),
    ]);
  });

  it("sends the focus on when an item is ticked and hidden, or to the quadrant's field", () => {
    show({ layout: "matrix", initial: { items: [item("x", "Only one", { urgent: true })] } });
    fireEvent.click(check("Only one"));
    expect(within(quadrant(DELEGATE)).getByRole("textbox")).toHaveFocus();
    expect(announced()).toBe(t("todo.announce.hidden", { title: "Only one" }));
  });

  it("names its quadrants as the host says", () => {
    show({ layout: "matrix", strings: { "todo.quadrant.drop": "Let go", "todo.quadrantAbout.drop": "Never mind" } });
    expect(quadrant("Let go")).toHaveAccessibleDescription("Never mind");
    expect(current).toBe(LIST);
  });
});
