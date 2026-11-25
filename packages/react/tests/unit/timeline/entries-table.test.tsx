import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createTranslate } from "../../../src";
import { formatWhenLines } from "../../../src/timeline/format";
import { acts, d, dated, e, id } from "./fixtures";
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

describe("the table's When column", () => {
  const words = { t: createTranslate(), locale: "en-GB" };

  it("may break a span after its separator, never inside a date", () => {
    const span = e(20, d(-429, null, null, true), d(-329, null, null, true));
    const timeline = dated([span, e(21, d(1066, 10, 14))]);
    expect(formatWhenLines(span, timeline, true, words)).toEqual(["c. 430 BCE –", "c. 330 BCE"]);
    expect(formatWhenLines(timeline.entries[1]!, timeline, true, words)).toEqual(["14 October 1066 CE"]);
    render(<Host editor initial={timeline} />);
    const cell = within(table()).getAllByRole("cell")[0]!;
    expect(cell).toHaveTextContent("c. 430 BCE – c. 330 BCE");
    const pieces = [...cell.querySelectorAll("[data-whole]")].map((piece) => piece.textContent);
    expect(pieces).toEqual(["c. 430 BCE –", "c. 330 BCE"]);
  });

  it("follows the host's own words for a span, and keeps one without a space whole", () => {
    const span = e(20, d(1600), d(1650));
    const timeline = dated([span]);
    const until = createTranslate({ strings: { "timeline.date.range": "from {start} until {end}" } });
    expect(formatWhenLines(span, timeline, false, { t: until, locale: "en-GB" })).toEqual(["from 1600 until", "1650"]);
    const reversed = createTranslate({ strings: { "timeline.date.range": "{end} back to {start}" } });
    expect(formatWhenLines(span, timeline, false, { t: reversed, locale: "en-GB" })).toEqual(["1650 back to", "1600"]);
    const dash = createTranslate({ strings: { "timeline.date.range": "{start}–{end}" } });
    expect(formatWhenLines(span, timeline, false, { t: dash, locale: "en-GB" })).toEqual(["1600–1650"]);
  });

  it("lets a step's name wrap as any text", () => {
    render(<Host editor initial={acts} />);
    const cell = within(table()).getAllByRole("cell")[0]!;
    expect(cell.querySelector("[data-whole]")).toBeNull();
    expect(cell).toHaveTextContent("Act 1 – Act 2");
  });
});
