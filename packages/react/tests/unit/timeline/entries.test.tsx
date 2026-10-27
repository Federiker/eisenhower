import type { TimelineEntry } from "@eisenhower/model";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { d, e, harbour, id } from "./fixtures";
import { Host, held, nextTick } from "./host";

const dialog = () => screen.getByRole("dialog");
const list = () => screen.getByRole("region", { name: "Entries" });
const type = (label: string, value: string, within_ = dialog()) =>
  fireEvent.change(within(within_).getByLabelText(label), { target: { value } });
const choose = (label: string, value: string, within_ = dialog()) =>
  fireEvent.change(within(within_).getByLabelText(label), { target: { value } });
const opening = (month: number | null = 10): TimelineEntry =>
  e(20, d(1066, month, month === null ? null : 14), null, id(11), { title: "Opening" });

// Copied from jerome's timeline-entries-ui.test.tsx, made generic: the host keeps the timeline.
describe("timeline entries", () => {
  it("are typed in a dialog, saved with Save, and listed in time order", async () => {
    render(<Host editor initial={harbour([e(21, d(1086), null, id(10), { title: "Survey" })])} />);
    fireEvent.click(screen.getByRole("button", { name: "New entry" }));
    expect(screen.getByRole("dialog", { name: "New entry" })).toBeInTheDocument();
    expect(within(dialog()).getByLabelText("Title")).toHaveFocus();
    expect(within(dialog()).queryByRole("alert")).not.toBeInTheDocument();
    // Save lists every reason it cannot save yet.
    fireEvent.click(within(dialog()).getByRole("button", { name: "Save" }));
    expect(within(dialog()).getByText("Give the entry a title.")).toBeInTheDocument();
    expect(within(dialog()).getByText("Type a year from 1 to 999 999 and choose BCE or CE.")).toBeInTheDocument();
    expect(held.value!.entries).toHaveLength(1);

    type("Title", "Opening");
    type("Year", "1066");
    choose("Month", "10");
    type("Day", "14");
    choose("Category", id(11));
    type("Summary", "The first ship comes in");
    // Nothing is reported before Save.
    expect(held.value!.entries).toHaveLength(1);
    fireEvent.click(within(dialog()).getByRole("button", { name: "Save" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(held.value!.entries[1]).toMatchObject({
      title: "Opening",
      categoryId: id(11),
      start: { year: 1066, month: 10, day: 14, approximate: false },
      end: null,
      summary: "The first ship comes in",
    });
    const rows = within(list())
      .getAllByRole("row")
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole("cell")
          .map((cell) => cell.textContent),
      );
    expect(rows).toEqual([
      ["14 October 1066", "Opening", "Harbour", "The first ship comes in"],
      ["1086", "Survey", "Ships", ""],
    ]);
    // The new entry's title on the drawing takes the focus.
    await act(nextTick);
    expect(document.activeElement).toHaveAccessibleName("Harbour: Opening, 14 October 1066");
  });

  it("make a span from a BCE date, refuse an end before the start, and ask before Cancel discards", async () => {
    render(<Host editor initial={harbour()} />);
    fireEvent.click(screen.getByRole("button", { name: "New entry" }));
    type("Title", "Old wall");
    const from = within(dialog()).getByRole("group", { name: "At" });
    type("Year", "43", from);
    fireEvent.click(within(from).getByLabelText("c. (approximate)"));
    fireEvent.click(within(dialog()).getByLabelText("Span (from one point to a later one)"));
    expect(within(dialog()).getByRole("group", { name: "From" })).toBe(from);
    const to = within(dialog()).getByRole("group", { name: "To" });
    type("Year", "55", to);
    choose("Era", "bce", to);
    fireEvent.click(within(dialog()).getByRole("button", { name: "Save" }));
    expect(within(dialog()).getByText("A span must end after it starts.")).toBeInTheDocument();
    expect(held.value!.entries).toHaveLength(0);
    // Cancel asks first when something changed; Keep editing goes back to the title.
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Keep editing" }));
    expect(within(dialog()).getByLabelText("Title")).toHaveFocus();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    // A change to a field closes the question.
    type("Title", "Old walls");
    expect(within(dialog()).queryByRole("alertdialog")).not.toBeInTheDocument();

    choose("Era", "bce", from);
    choose("Era", "ce", to);
    fireEvent.click(within(dialog()).getByRole("button", { name: "Save" }));
    expect(held.value!.entries).toHaveLength(1);
    expect(held.value!.entries[0]).toMatchObject({
      start: { year: -42, month: null, day: null, approximate: true },
      end: { year: 55, month: null, day: null, approximate: false },
    });
    expect(within(list()).getAllByRole("cell")[0]).toHaveTextContent("c. 43 BCE – 55 CE");

    // Escape with a change asks too, Escape again goes back, and Discard leaves the entry as it was.
    fireEvent.click(within(list()).getByRole("button", { name: "Old walls" }));
    type("Title", "Old walls (first)");
    fireEvent.keyDown(dialog(), { key: "Escape" });
    fireEvent.keyDown(dialog(), { key: "Escape" });
    expect(within(dialog()).queryByRole("alertdialog")).not.toBeInTheDocument();
    fireEvent.keyDown(dialog(), { key: "Escape" });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(held.value!.entries[0]!.title).toBe("Old walls");
    // Unchanged, Save simply closes; a span unticked is a point again.
    fireEvent.click(within(list()).getByRole("button", { name: "Old walls" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Save" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(within(list()).getByRole("button", { name: "Old walls" }));
    fireEvent.click(within(dialog()).getByLabelText("Span (from one point to a later one)"));
    choose("Month", "3");
    choose("Month", "");
    expect(within(dialog()).queryByLabelText("Day")).not.toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Save" }));
    expect(held.value!.entries[0]!.end).toBeNull();
    await act(nextTick);
  });

  it("are deleted from their dialog after asking", () => {
    render(<Host editor initial={harbour([opening(null)])} />);
    fireEvent.click(within(list()).getByRole("button", { name: "Opening" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Delete entry" }));
    fireEvent.click(within(within(dialog()).getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(within(dialog()).queryByRole("alertdialog")).not.toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Delete entry" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Delete the entry" }));
    expect(held.value!.entries).toEqual([]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(list()).getByText("No entries yet. Choose New entry to add one.")).toBeInTheDocument();
  });

  it("offer Edit and Delete in a menu, by right-click on a row or the Menu key on a title", async () => {
    render(<Host editor initial={harbour([opening()])} />);
    const title = within(list()).getByRole("button", { name: "Opening" });
    fireEvent.contextMenu(title.closest("tr")!);
    const menu = screen.getByRole("menu", { name: "Entry actions: Opening" });
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Edit", "Delete"]);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Edit" }));
    expect(screen.getByRole("dialog", { name: "Opening" })).toBeInTheDocument();
    expect(title.closest("tr")).toHaveAttribute("data-selected", "true");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    await act(nextTick);
    expect(title).toHaveFocus();

    // The Menu key on the title, then Delete, which asks first; Cancel keeps the entry.
    fireEvent.keyDown(title, { key: "ContextMenu" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    const question = screen.getByRole("alertdialog", { name: "Delete entry" });
    expect(question).toHaveTextContent("Delete Opening? The entry is deleted from the timeline.");
    fireEvent.click(within(question).getByRole("button", { name: "Cancel" }));
    expect(held.value!.entries).toHaveLength(1);
    expect(title).toHaveFocus();
    // The Delete key on the title asks the same; Escape keeps the entry and gives the focus back.
    fireEvent.keyDown(title, { key: "Delete" });
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(title).toHaveFocus();
    fireEvent.keyDown(title, { key: "x" });
    fireEvent.keyDown(title, { key: "Delete" });
    fireEvent.click(screen.getByRole("button", { name: "Delete the entry" }));
    expect(held.value!.entries).toEqual([]);
    // With no entry left, New entry takes the focus.
    await act(nextTick);
    expect(document.activeElement).toHaveAccessibleName("New entry");
  });

  it("are read only in a read-only editor", () => {
    render(<Host editor readOnly initial={harbour([opening()])} />);
    const title = within(list()).getByRole("button", { name: "Opening" });
    fireEvent.contextMenu(title.closest("tr")!);
    fireEvent.keyDown(title, { key: "Delete" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/Choose a title to open the entry/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New step" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New category" })).not.toBeInTheDocument();
  });

  it("start at a step in a Sequence, chosen from the steps", () => {
    render(
      <Host
        editor
        initial={{
          kind: "sequence",
          steps: [
            { id: id(1), name: "Act 1" },
            { id: id(2), name: "Act 2" },
          ],
          categories: [{ id: id(10), name: "Ships", colour: 0, line: "solid" }],
          entries: [],
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "New entry" }));
    type("Title", "Departure");
    fireEvent.click(within(dialog()).getByLabelText("Span (from one point to a later one)"));
    choose("To", id(2));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Save" }));
    expect(held.value!.entries[0]).toMatchObject({ start: { step: id(1) }, end: { step: id(2) } });
    expect(within(list()).getAllByRole("cell")[0]).toHaveTextContent("Act 1 – Act 2");
  });
});
