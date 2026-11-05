import type { Colour } from "@eisenhower/model";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { ColourPicker, createTranslate } from "../../../src";

const t = createTranslate();
const picker = () => screen.getByRole("combobox", { name: "Colour" });
const list = () => screen.getByRole("listbox", { name: "Colour" });
const options = () =>
  within(list())
    .getAllByRole("option")
    .map((option) => option.textContent);
const active = () => document.getElementById(picker().getAttribute("aria-activedescendant") ?? "")?.textContent;
const press = (key: string, extra: Partial<KeyboardEventInit> = {}) => fireEvent.keyDown(picker(), { key, ...extra });

/** A labelled picker that keeps its colour, as a form would. */
function Field({
  initial,
  allowNone = true,
  onChange,
}: {
  initial: Colour;
  allowNone?: boolean;
  onChange?: () => void;
}) {
  const [colour, setColour] = useState<Colour>(initial);
  const change = (next: Colour) => {
    onChange?.();
    setColour(next);
  };
  return (
    <form>
      <label htmlFor="colour">Colour</label>
      {allowNone ? (
        <ColourPicker id="colour" value={colour} allowNone onChange={change} />
      ) : (
        <ColourPicker id="colour" value={colour ?? 0} onChange={change} />
      )}
      <output aria-label="Chosen">{String(colour)}</output>
      <button type="button">After</button>
    </form>
  );
}
const chosen = () => screen.getByRole("status", { name: "Chosen" }).textContent;

describe("the colour picker", () => {
  it("shows the colour's swatch and name, and opens a list of every colour (None first) with the chosen one selected", () => {
    render(<Field initial={4} />);
    expect(picker()).toHaveTextContent(t("common.colour.blue"));
    expect(picker()).toHaveAttribute("aria-expanded", "false");
    expect(picker()).not.toHaveAttribute("aria-controls");
    expect(picker().querySelector<HTMLElement>(".eh-swatch")!.style.background).toBe("var(--eh-colour-4)");
    fireEvent.click(picker());
    expect(picker()).toHaveAttribute("aria-expanded", "true");
    expect(picker()).toHaveAttribute("aria-controls", list().id);
    expect(options()).toEqual([
      t("common.colour.none"),
      t("common.colour.orange"),
      t("common.colour.skyBlue"),
      t("common.colour.bluishGreen"),
      t("common.colour.yellow"),
      t("common.colour.blue"),
      t("common.colour.vermilion"),
      t("common.colour.reddishPurple"),
      t("common.colour.black"),
    ]);
    expect(within(list()).getByRole("option", { selected: true })).toHaveTextContent(t("common.colour.blue"));
    expect(active()).toBe(t("common.colour.blue"));
    // A click on an option chooses it, and the focus stays on the picker.
    act(() => picker().focus());
    fireEvent.mouseDown(within(list()).getByRole("option", { name: t("common.colour.none") }));
    fireEvent.click(within(list()).getByRole("option", { name: t("common.colour.none") }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(chosen()).toBe("null");
    expect(picker()).toHaveTextContent(t("common.colour.none"));
    expect(picker().querySelector(".eh-swatch")).toHaveAttribute("data-none", "true");
    expect(picker()).toHaveFocus();
    // A second click on the button closes the list.
    fireEvent.click(picker());
    fireEvent.click(picker());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens with Enter, Space and the arrows, moves with the arrows, Home and End, and chooses with Enter or Space", () => {
    render(<Field initial={1} />);
    act(() => picker().focus());
    press("ArrowDown");
    expect(active()).toBe(t("common.colour.skyBlue"));
    press("ArrowDown");
    press("ArrowDown");
    expect(active()).toBe(t("common.colour.yellow"));
    press("ArrowUp");
    expect(active()).toBe(t("common.colour.bluishGreen"));
    press("Home");
    press("ArrowUp");
    expect(active()).toBe(t("common.colour.none"));
    press("End");
    press("ArrowDown");
    expect(active()).toBe(t("common.colour.black"));
    press("Enter");
    expect(chosen()).toBe("7");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    press(" ");
    press("ArrowUp");
    fireEvent.keyUp(picker(), { key: " " });
    press(" ");
    expect(chosen()).toBe("6");
    press("Enter");
    expect(active()).toBe(t("common.colour.reddishPurple"));
    press("ArrowUp", { altKey: true });
    expect(chosen()).toBe("6");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    press("ArrowDown", { altKey: true });
    expect(list()).toBeInTheDocument();
    press("Escape");
    press("Home");
    expect(active()).toBe(t("common.colour.none"));
    press("Escape");
    press("End");
    expect(active()).toBe(t("common.colour.black"));
    press("Escape");
    press("ArrowUp");
    expect(active()).toBe(t("common.colour.reddishPurple"));
  });

  it("closes without changing the colour on Escape, Tab, leaving it or a click outside", () => {
    const onChange = vi.fn();
    render(<Field initial={null} onChange={onChange} />);
    act(() => picker().focus());
    press("Enter");
    expect(active()).toBe(t("common.colour.none"));
    press("ArrowDown");
    const closing = fireEvent.keyDown(picker(), { key: "Escape" });
    // Escape is the picker's alone while it is open: a dialog around it stays.
    expect(closing).toBe(false);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(picker()).toHaveFocus();
    // Closed, Escape goes on to what holds the picker.
    expect(fireEvent.keyDown(picker(), { key: "Escape" })).toBe(true);

    press("ArrowDown");
    // Tab goes on to the next field as it would, closing the list.
    expect(fireEvent.keyDown(picker(), { key: "Tab" })).toBe(true);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    press("ArrowDown");
    fireEvent.mouseDown(list());
    expect(list()).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("button", { name: "After" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    press("ArrowDown");
    act(() => screen.getByRole("button", { name: "After" }).focus());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(chosen()).toBe("null");

    // Choosing the colour it has changes nothing either.
    act(() => picker().focus());
    press("Enter");
    press("Enter");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("goes to the colour whose name starts with the letters typed, opening the list", () => {
    vi.useFakeTimers();
    try {
      render(<Field initial={0} />);
      act(() => picker().focus());
      press("b");
      expect(list()).toBeInTheDocument();
      expect(active()).toBe(t("common.colour.bluishGreen"));
      // The same letter again goes on to the next name with it, round to the first.
      press("b");
      expect(active()).toBe(t("common.colour.blue"));
      press("b");
      expect(active()).toBe(t("common.colour.black"));
      press("b");
      expect(active()).toBe(t("common.colour.bluishGreen"));
      vi.advanceTimersByTime(600);
      // After a pause, a new search; letters typed together find a name, with a space in it.
      press("s");
      press("k");
      press("y");
      press(" ");
      expect(list()).toBeInTheDocument();
      expect(active()).toBe(t("common.colour.skyBlue"));
      press("q");
      expect(active()).toBe(t("common.colour.skyBlue"));
      vi.advanceTimersByTime(600);
      press(" ");
      expect(chosen()).toBe("1");
      // A letter no name starts with, closed, opens on the colour chosen; a modified key is not typing.
      vi.advanceTimersByTime(600);
      press("z");
      expect(active()).toBe(t("common.colour.skyBlue"));
      press("Escape");
      press("v", { ctrlKey: true });
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("highlights the option under the pointer, without None when it is not allowed", () => {
    render(<Field initial={2} allowNone={false} />);
    fireEvent.click(picker());
    expect(options()).toHaveLength(8);
    expect(options()[0]).toBe(t("common.colour.orange"));
    const yellow = within(list()).getByRole("option", { name: t("common.colour.yellow") });
    fireEvent.mouseMove(yellow);
    expect(yellow).toHaveAttribute("data-active", "true");
    fireEvent.mouseMove(yellow);
    fireEvent.click(yellow);
    expect(chosen()).toBe("3");
  });

  it("is named by aria-label or aria-labelledby, reads a host's none, and does nothing while disabled", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <>
        <span id="named">Lane colour</span>
        <ColourPicker aria-labelledby="named" value={null} allowNone noneLabel="No colour" onChange={onChange} />
      </>,
    );
    const named = screen.getByRole("combobox", { name: "Lane colour" });
    expect(named).toHaveTextContent("No colour");
    fireEvent.click(named);
    expect(screen.getByRole("listbox", { name: "Lane colour" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "No colour" })).toHaveAttribute("aria-selected", "true");

    rerender(<ColourPicker aria-label="Ink" value={5} disabled onChange={onChange} />);
    const ink = screen.getByRole("combobox", { name: "Ink" });
    expect(ink).toBeDisabled();
    expect(ink).toHaveTextContent(t("common.colour.vermilion"));
    fireEvent.keyDown(ink, { key: "ArrowDown" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("names a colour outside the palette by its number, and opens on the first colour", () => {
    render(<ColourPicker aria-label="Ink" value={12} onChange={vi.fn()} />);
    const ink = screen.getByRole("combobox", { name: "Ink" });
    expect(ink).toHaveTextContent("12");
    fireEvent.keyDown(ink, { key: "Enter" });
    expect(screen.getByRole("listbox", { name: "Ink" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { selected: true })).not.toBeInTheDocument();
    expect(document.getElementById(ink.getAttribute("aria-activedescendant")!)).toHaveTextContent(
      t("common.colour.orange"),
    );
  });

  it("opens above the button when there is more room there, and follows scrolling", () => {
    render(<ColourPicker aria-label="Ink" value={0} onChange={vi.fn()} />);
    const ink = screen.getByRole("combobox", { name: "Ink" });
    const bounds = { top: 700, bottom: 730, left: 40, right: 140, width: 100, height: 30, x: 40, y: 700 };
    ink.getBoundingClientRect = () => ({ ...bounds, toJSON: () => bounds });
    // The test DOM lays nothing out: the list is as tall as its eight colours would be.
    Object.defineProperty(HTMLDivElement.prototype, "scrollHeight", { configurable: true, get: () => 230 });
    onTestFinished(() => {
      delete (HTMLDivElement.prototype as { scrollHeight?: number }).scrollHeight;
    });
    fireEvent.click(ink);
    const shown = screen.getByRole("listbox", { name: "Ink" });
    expect(shown.style.bottom).toBe(`${window.innerHeight - 700}px`);
    expect(shown.style.top).toBe("");
    expect(shown.style.minWidth).toBe("100px");
    const lower = { ...bounds, top: 10, bottom: 40 };
    ink.getBoundingClientRect = () => ({ ...lower, toJSON: () => lower });
    fireEvent.scroll(window);
    expect(shown.style.top).toBe("40px");
    expect(shown.style.bottom).toBe("");
  });
});
