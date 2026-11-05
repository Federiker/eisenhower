import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { d, dated, e, id } from "./fixtures";
import { Host, held, tableRows } from "./host";

const table = () => within(screen.getByRole("region", { name: "Entries" })).getByRole("table");
const group = (name: string) => within(table()).getByRole("button", { name });

/** Three lanes, the middle one empty, with the entries out of time order. */
const ports = () =>
  dated(
    [
      e(20, d(1700), null, id(12), { title: "Customs house" }),
      e(21, d(1650), null, id(10), { title: "Brig launched", summary: "The first" }),
      e(22, d(1600), null, id(12), { title: "Quay laid" }),
      e(23, d(1680), null, id(12), { title: "Crane raised" }),
    ],
    [
      { id: id(10), name: "Ships", colour: 0, line: "solid" },
      { id: id(11), name: "Weather", colour: 1, line: "dotted" },
      { id: id(12), name: "Harbour", colour: 2, line: "dashed" },
    ],
  );

describe("the timeline's entries table", () => {
  it("groups the entries by category in the categories' order, each in time order, leaving out empty ones", () => {
    render(<Host editor initial={ports()} />);
    expect(
      within(table())
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["When", "Title", "Summary"]);
    expect(tableRows(table())).toEqual([
      "Ships, 1 entry",
      ["1650", "Brig launched", "The first"],
      "Harbour, 3 entries",
      ["1600", "Quay laid", ""],
      ["1680", "Crane raised", ""],
      ["1700", "Customs house", ""],
    ]);
    expect(within(table()).queryByRole("button", { name: /^Weather/ })).not.toBeInTheDocument();
    // Each heading is a single cell across the columns, with the category's name and count shown.
    const heading = group("Harbour, 3 entries");
    expect(heading.closest("th")).toHaveAttribute("colspan", "3");
    expect(heading.closest("th")).toHaveAttribute("scope", "rowgroup");
    expect(heading).toHaveTextContent("Harbour3 entries");
    expect(heading).toHaveAttribute("aria-expanded", "true");
  });

  it("folds and unfolds a group for the view only, never changing the timeline", () => {
    const onChange = vi.fn();
    render(<Host editor initial={ports()} onChange={onChange} />);
    const before = held.value;
    fireEvent.click(group("Harbour, 3 entries"));
    expect(group("Harbour, 3 entries")).toHaveAttribute("aria-expanded", "false");
    expect(tableRows(table())).toEqual([
      "Ships, 1 entry",
      ["1650", "Brig launched", "The first"],
      "Harbour, 3 entries",
    ]);
    // The drawing still shows the folded group's entries.
    expect(screen.getByRole("button", { name: "Harbour: Quay laid, 1600" })).toBeInTheDocument();
    fireEvent.click(group("Ships, 1 entry"));
    expect(tableRows(table())).toEqual(["Ships, 1 entry", "Harbour, 3 entries"]);
    fireEvent.click(group("Harbour, 3 entries"));
    expect(group("Harbour, 3 entries")).toHaveAttribute("aria-expanded", "true");
    expect(within(table()).getByRole("button", { name: "Crane raised" })).toBeInTheDocument();
    expect(within(table()).queryByRole("button", { name: "Brig launched" })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(held.value).toBe(before);
  });

  it("still opens an entry from its title, offers its menu and asks before deleting it", () => {
    render(<Host editor initial={ports()} />);
    fireEvent.click(within(table()).getByRole("button", { name: "Crane raised" }));
    expect(screen.getByRole("dialog", { name: "Crane raised" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    const quay = within(table()).getByRole("button", { name: "Quay laid" });
    fireEvent.contextMenu(quay.closest("tr")!);
    expect(screen.getByRole("menu", { name: "Entry actions: Quay laid" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Edit" }), { key: "Escape" });
    fireEvent.keyDown(quay, { key: "Delete" });
    fireEvent.click(screen.getByRole("button", { name: "Delete the entry" }));
    expect(held.value!.entries.map((entry) => entry.title)).not.toContain("Quay laid");
    expect(group("Harbour, 2 entries")).toBeInTheDocument();
  });

  it("leaves out a category's heading once its last entry goes", () => {
    render(<Host editor initial={ports()} />);
    const brig = within(table()).getByRole("button", { name: "Brig launched" });
    fireEvent.keyDown(brig, { key: "Delete" });
    fireEvent.click(screen.getByRole("button", { name: "Delete the entry" }));
    expect(within(table()).queryByRole("button", { name: /^Ships/ })).not.toBeInTheDocument();
    expect(tableRows(table())[0]).toBe("Harbour, 3 entries");
  });
});
