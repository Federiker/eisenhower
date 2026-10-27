import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ContextMenu, createTranslate, type MenuItem, MoveToDialog, opensMenu, placeBelow } from "../../../src";

const t = createTranslate();

type Action = "open" | "rename" | "bin";
const items: MenuItem<Action>[] = [
  { id: "open", label: "Open" },
  { id: "rename", label: "Rename", disabled: true },
  { id: "bin", label: "Delete card", separated: true },
];

describe("ContextMenu", () => {
  it("is a named menu whose first usable item has the focus", () => {
    render(
      <ContextMenu
        label="Opening"
        items={items}
        place={{ left: 10, top: 20 }}
        onChoose={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("menu", { name: "Opening" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Open" })).toHaveFocus();
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeDisabled();
    expect(screen.getAllByRole("separator")).toHaveLength(1);
  });

  it("moves between usable items with the arrow keys, Home and End, and chooses with a click", () => {
    const onChoose = vi.fn();
    render(
      <ContextMenu label="Opening" items={items} place={{ left: 0, top: 0 }} onChoose={onChoose} onClose={() => {}} />,
    );
    const open = screen.getByRole("menuitem", { name: "Open" });
    const bin = screen.getByRole("menuitem", { name: "Delete card" });
    fireEvent.keyDown(open, { key: "ArrowDown" });
    expect(bin).toHaveFocus();
    fireEvent.keyDown(bin, { key: "ArrowDown" });
    expect(open).toHaveFocus();
    fireEvent.keyDown(open, { key: "End" });
    expect(bin).toHaveFocus();
    fireEvent.keyDown(bin, { key: "Home" });
    expect(open).toHaveFocus();
    fireEvent.click(bin);
    expect(onChoose).toHaveBeenCalledWith("bin");
  });

  it("closes with Escape or Tab, and on a click outside", () => {
    const onClose = vi.fn();
    const { container } = render(
      <ContextMenu label="Opening" items={items} place={{ left: 0, top: 0 }} onChoose={() => {}} onClose={onClose} />,
    );
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Open" }), { key: "Escape" });
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Open" }), { key: "Tab" });
    fireEvent.mouseDown(container.querySelector(".eh-menu-backdrop")!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("chooses an item by its access letter, and shows items that are on or off", () => {
    const onChoose = vi.fn();
    render(
      <ContextMenu<"bold" | "gap" | "other">
        label="Marks"
        items={[
          { id: "bold", label: "Bold", accessKey: "B", checked: true },
          { id: "gap", label: "Gap", accessKey: "X", checked: false },
          { id: "other", label: "Other", accessKey: "O", disabled: true },
        ]}
        place={{ left: 0, top: 0 }}
        onChoose={onChoose}
        onClose={() => {}}
      />,
    );
    const bold = screen.getByRole("menuitemcheckbox", { name: "Bold" });
    expect(bold).toHaveAttribute("aria-checked", "true");
    expect(bold).toHaveAttribute("aria-keyshortcuts", "B");
    expect(bold.querySelector(".eh-menu-access")?.textContent).toBe("B");
    // A letter the label does not hold is shown after it.
    expect(screen.getByRole("menuitemcheckbox", { name: "Gap" }).querySelector("kbd")?.textContent).toBe("X");
    fireEvent.keyDown(bold, { key: "o" });
    fireEvent.keyDown(bold, { key: "x", ctrlKey: true });
    expect(onChoose).not.toHaveBeenCalled();
    fireEvent.keyDown(bold, { key: "x" });
    expect(onChoose).toHaveBeenCalledWith("gap");
  });

  it("opens above the line it was opened from when there is no room below, and is only moved up where there is none", () => {
    const height = window.innerHeight;
    // The menu draws 120 px tall wherever it is put.
    const box = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      const top = Number.parseFloat(this.style.top) || 0;
      const left = Number.parseFloat(this.style.left) || 0;
      return new DOMRect(left, top, 160, 120);
    });
    const menu = (place: { left: number; top: number; above?: number }) => {
      const view = render(
        <ContextMenu label="At the caret" items={items} place={place} onChoose={() => {}} onClose={() => {}} />,
      );
      const top = screen.getByRole("menu").style.top;
      view.unmount();
      return top;
    };
    // Room below: where it was asked.
    expect(menu({ left: 10, top: 100, above: 80 })).toBe("100px");
    // None below: it ends 4 px above the caret line's top.
    expect(menu({ left: 10, top: height - 30, above: height - 50 })).toBe(`${height - 50 - 120 - 4}px`);
    // None below and no line given (a pointer): it ends at the pointer.
    expect(menu({ left: 10, top: height - 30 })).toBe(`${height - 30 - 120}px`);
    // No room above the line either: kept inside the window.
    expect(menu({ left: 10, top: 60, above: 40 })).toBe(window.innerHeight >= 184 ? "60px" : "4px");
    box.mockRestore();
  });

  it("says when there is nothing to choose", () => {
    render(<ContextMenu label="Empty" items={[]} place={{ left: 0, top: 0 }} onChoose={() => {}} onClose={() => {}} />);
    expect(screen.getByText(t("common.menuNothing"))).toBeInTheDocument();
  });

  it("opens from the Menu key or Shift+F10, below its item (or above it, where there is no room)", () => {
    expect(opensMenu({ key: "ContextMenu", shiftKey: false })).toBe(true);
    expect(opensMenu({ key: "F10", shiftKey: true })).toBe(true);
    expect(opensMenu({ key: "F10", shiftKey: false })).toBe(false);
    const element = document.createElement("div");
    element.getBoundingClientRect = () => new DOMRect(12, 30, 100, 20);
    expect(placeBelow(element)).toEqual({ left: 12, top: 50, above: 30 });
  });
});

describe("MoveToDialog", () => {
  const targets = [
    { id: null, title: "No column", depth: 0 },
    { id: "doing", title: "Doing", depth: 1 },
  ];

  it("lists the places with the current one chosen and focused, and moves to the one chosen", () => {
    const onMove = vi.fn();
    render(<MoveToDialog itemTitle="Opening" targets={targets} current={null} onMove={onMove} onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: t("common.moveTitleNamed", { name: "Opening" }) })).toBeInTheDocument();
    const root = screen.getByRole("radio", { name: "No column" });
    expect(root).toBeChecked();
    expect(root).toHaveFocus();
    expect(screen.getByRole("button", { name: t("common.moveConfirm") })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "Doing" }));
    fireEvent.click(screen.getByRole("button", { name: t("common.moveConfirm") }));
    expect(onMove).toHaveBeenCalledWith("doing");
  });

  it("closes without moving with Cancel or Escape", () => {
    const onMove = vi.fn();
    const onClose = vi.fn();
    render(<MoveToDialog itemTitle="Opening" targets={targets} current={null} onMove={onMove} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: t("common.cancel") }));
    fireEvent.keyDown(screen.getByRole("radio", { name: "No column" }), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onMove).not.toHaveBeenCalled();
  });
});
