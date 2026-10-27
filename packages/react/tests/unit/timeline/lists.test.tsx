import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { acts, d, e, harbour, id } from "./fixtures";
import { Host, held, nextTick } from "./host";

const steps = () => screen.getByRole("list", { name: "Steps" });
const categories = () => screen.getByRole("list", { name: "Categories" });
const row = (list: HTMLElement, text: string) =>
  within(list)
    .getAllByRole("listitem")
    .find((item) => item.textContent?.includes(text))!;

// Jerome's steps and categories lists, as its timeline page has them, kept by the host.
describe("a Sequence's steps", () => {
  it("are added open for their name, renamed, and reordered with the keys, which is announced", async () => {
    render(<Host editor initial={acts} />);
    fireEvent.click(screen.getByRole("button", { name: "New step" }));
    expect(held.value!.steps.at(-1)!.name).toBe("New step");
    await act(nextTick);
    const name = screen.getByRole("textbox", { name: "Step 4" });
    expect(name).toHaveFocus();
    fireEvent.change(name, { target: { value: "Act 2" } });
    fireEvent.keyDown(name, { key: "Enter" });
    expect(await screen.findByText("Another one already has this name.")).toBeInTheDocument();
    fireEvent.change(name, { target: { value: "Epilogue" } });
    fireEvent.keyDown(name, { key: "Enter" });
    await act(nextTick);
    expect(held.value!.steps.map((step) => step.name)).toEqual(["Act 1", "Act 2", "Act 3", "Epilogue"]);
    fireEvent.click(screen.getByRole("button", { name: "New step" }));
    expect(held.value!.steps.at(-1)!.name).toBe("New step");
    await act(nextTick);

    fireEvent.keyDown(row(steps(), "Epilogue"), { key: "ArrowUp", altKey: true });
    expect(held.value!.steps.map((step) => step.name)).toEqual(["Act 1", "Act 2", "Epilogue", "Act 3", "New step"]);
    expect(screen.getByRole("status")).toHaveTextContent("Epilogue: moved to 3 of 5");
    // A move that would turn a span round is refused, saying why.
    fireEvent.keyDown(row(steps(), "Act 1"), { key: "ArrowDown", altKey: true });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This would put the end of a span before its start; change the span first.",
    );
    expect(row(steps(), "Act 1").textContent).toContain("2 entries");
  });

  it("ask where their entries go when deleted", async () => {
    render(<Host editor initial={acts} />);
    // Act 1 has two entries: they may move to Act 2, or go with it.
    fireEvent.keyDown(row(steps(), "Act 1"), { key: "Delete" });
    let question = screen.getByRole("alertdialog", { name: "Delete step: Act 1" });
    expect(within(question).queryByRole("button", { name: /Move entries to Act 3/ })).not.toBeInTheDocument();
    fireEvent.click(within(question).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    fireEvent.keyDown(row(steps(), "Act 2"), { key: "Delete" });
    question = screen.getByRole("alertdialog", { name: "Delete step: Act 2" });
    fireEvent.keyDown(question, { key: "Escape" });
    fireEvent.contextMenu(row(steps(), "Act 2"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    question = screen.getByRole("alertdialog", { name: "Delete step: Act 2" });
    fireEvent.click(within(question).getByRole("button", { name: "Move entries to Act 3" }));
    expect(held.value!.steps.map((step) => step.name)).toEqual(["Act 1", "Act 3"]);
    expect(held.value!.entries[0]).toMatchObject({ start: { step: id(1) }, end: { step: id(3) } });
    fireEvent.keyDown(row(steps(), "Act 3"), { key: "Delete" });
    fireEvent.click(screen.getByRole("button", { name: "Move entries to Act 1" }));
    expect(held.value!.entries.map((entry) => [entry.start, entry.end])).toEqual([
      [{ step: id(1) }, null],
      [{ step: id(1) }, null],
      [{ step: id(1) }, null],
    ]);
    fireEvent.keyDown(row(steps(), "Act 1"), { key: "Delete" });
    fireEvent.click(screen.getByRole("button", { name: "Delete with its entries" }));
    expect(held.value!).toMatchObject({ steps: [], entries: [] });
    expect(screen.getByText("No steps yet. Choose New step to add the first one.")).toBeInTheDocument();
    // A step without entries goes at once.
    fireEvent.click(screen.getByRole("button", { name: "New step" }));
    await act(nextTick);
    fireEvent.keyDown(within(steps()).getAllByRole("listitem").at(-1)!, { key: "Delete" });
    expect(held.value!.steps).toEqual([]);
  });
});

describe("a timeline's categories", () => {
  it("are added in the next look, renamed, recoloured, given a line and reordered", async () => {
    render(<Host editor initial={harbour([e(20, d(1066))])} />);
    expect(screen.queryByRole("list", { name: "Steps" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New category" }));
    expect(held.value!.categories.at(-1)).toMatchObject({ name: "New category", colour: 1, line: "solid" });
    await act(nextTick);
    const name = screen.getByRole("textbox", { name: "Category 3" });
    fireEvent.change(name, { target: { value: "Crew" } });
    fireEvent.keyDown(name, { key: "Enter" });
    await act(nextTick);
    expect(held.value!.categories.at(-1)!.name).toBe("Crew");

    fireEvent.click(screen.getByRole("button", { name: "Edit colour: Crew" }));
    const colour = screen.getByRole("combobox", { name: "Colour: Crew" });
    fireEvent.change(colour, { target: { value: "5" } });
    fireEvent.keyDown(colour, { key: "Enter" });
    await act(nextTick);
    expect(held.value!.categories.at(-1)!.colour).toBe(5);
    expect(row(categories(), "Crew").textContent).toContain("Vermilion");
    fireEvent.click(screen.getByRole("button", { name: "Edit line: Crew" }));
    const line = screen.getByRole("combobox", { name: "Line: Crew" });
    fireEvent.change(line, { target: { value: "dotted" } });
    fireEvent.keyDown(line, { key: "Enter" });
    await act(nextTick);
    expect(held.value!.categories.at(-1)!.line).toBe("dotted");
    fireEvent.click(screen.getByRole("button", { name: "Edit category: Crew" }));
    const rename = screen.getByRole("textbox", { name: "Category 3" });
    fireEvent.change(rename, { target: { value: " " } });
    fireEvent.keyDown(rename, { key: "Enter" });
    expect(await screen.findByText("A name is needed.")).toBeInTheDocument();
    fireEvent.keyDown(rename, { key: "Escape" });

    fireEvent.keyDown(row(categories(), "Crew"), { key: "ArrowUp", altKey: true });
    expect(held.value!.categories.map((category) => category.name)).toEqual(["Ships", "Crew", "Harbour"]);
    expect(screen.getByRole("status")).toHaveTextContent("Crew: moved to 2 of 3");
    // The lanes follow the list.
    const lanes = document.querySelector(".eh-timeline-lane-names")!;
    expect([...lanes.children].map((lane) => lane.textContent?.trim())).toEqual(["Ships", "Crew", "Harbour"]);
  });

  it("move their entries to another category, or take them along, when deleted", () => {
    render(<Host editor initial={harbour([e(20, d(1066)), e(21, d(1070), null, id(11))])} />);
    fireEvent.keyDown(row(categories(), "Ships"), { key: "Delete" });
    let question = screen.getByRole("alertdialog", { name: "Delete category: Ships" });
    expect(within(question).getByLabelText("Move entries to")).toHaveValue(id(11));
    fireEvent.click(within(question).getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(row(categories(), "Ships"), { key: "Delete" });
    question = screen.getByRole("alertdialog", { name: "Delete category: Ships" });
    fireEvent.keyDown(question, { key: "Escape" });
    fireEvent.contextMenu(row(categories(), "Ships"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    question = screen.getByRole("alertdialog", { name: "Delete category: Ships" });
    fireEvent.change(within(question).getByLabelText("Move entries to"), { target: { value: id(11) } });
    fireEvent.click(within(question).getByRole("button", { name: "Move entries and delete" }));
    expect(held.value!.categories.map((category) => category.name)).toEqual(["Harbour"]);
    expect(held.value!.entries.map((entry) => entry.categoryId)).toEqual([id(11), id(11)]);
    fireEvent.keyDown(row(categories(), "Harbour"), { key: "Delete" });
    fireEvent.click(screen.getByRole("button", { name: "Delete with its entries" }));
    expect(held.value!).toMatchObject({ categories: [], entries: [] });
    expect(screen.getByText(/No categories yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New category" }));
    fireEvent.keyDown(within(categories()).getAllByRole("listitem").at(-1)!, { key: "Delete" });
    expect(held.value!.categories).toEqual([]);
  });
});
