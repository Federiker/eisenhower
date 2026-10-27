import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TreeDialog } from "../../../src";

/** A dialog whose caller moves the focus elsewhere as it closes it. */
function Elsewhere() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button">Elsewhere</button>
      {open && (
        <TreeDialog
          label="Card"
          onCancel={() => {
            screen.getByRole("button", { name: "Elsewhere" }).focus();
            setOpen(false);
          }}
        >
          <input aria-label="Name" />
        </TreeDialog>
      )}
    </>
  );
}

function Opener({ onCancel = () => {}, onEscape }: { onCancel?: () => void; onEscape?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open && (
        <TreeDialog
          label="Move to: Opening"
          onCancel={() => {
            onCancel();
            setOpen(false);
          }}
          onEscape={onEscape}
        >
          <h3>Move to: Opening</h3>
          <input aria-label="Place" />
          <button type="submit">Move</button>
          <button type="button" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </TreeDialog>
      )}
    </>
  );
}

describe("TreeDialog", () => {
  it("is a modal dialog named by its label", () => {
    render(<Opener />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog", { name: "Move to: Opening" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveClass("eh-dialog");
  });

  it("puts the focus on the first item when the content does not take it", () => {
    render(<Opener />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("textbox", { name: "Place" })).toHaveFocus();
  });

  it("leaves the focus where the content puts it", () => {
    render(
      <TreeDialog label="Card" onCancel={() => {}}>
        <input aria-label="Name" />
        <input
          aria-label="Summary"
          // biome-ignore lint/a11y/noAutofocus: the test checks that the focus the dialog's content asks for is kept.
          autoFocus
        />
      </TreeDialog>,
    );
    expect(screen.getByRole("textbox", { name: "Summary" })).toHaveFocus();
  });

  it("keeps the focus inside: Tab from the last item goes to the first, Shift+Tab from the first to the last", () => {
    render(<Opener />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const first = screen.getByRole("textbox", { name: "Place" });
    const last = screen.getByRole("button", { name: "Cancel" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });

  it("cancels with Escape and gives the focus back to what opened it", () => {
    const onCancel = vi.fn();
    render(<Opener onCancel={onCancel} />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Place" }), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("gives the focus back when closed by its own buttons too", () => {
    render(<Opener />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);
    const cancel = screen.getByRole("button", { name: "Cancel" });
    cancel.focus();
    fireEvent.click(cancel);
    expect(opener).toHaveFocus();
  });

  it("does not take back the focus the caller moved on closing", () => {
    render(<Elsewhere />);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Name" }), { key: "Escape" });
    expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
  });

  it("lets Escape do something else first, such as closing a question", () => {
    const onCancel = vi.fn();
    const onEscape = vi.fn();
    render(<Opener onCancel={onCancel} onEscape={onEscape} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Place" }), { key: "Escape" });
    expect(onEscape).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("ignores Escape while an input method is composing", () => {
    const onCancel = vi.fn();
    render(<Opener onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Place" }), { key: "Escape", isComposing: true });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("cancels on a click on the backdrop, not on the dialog", () => {
    const onCancel = vi.fn();
    render(<Opener onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement!);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("submits through onSubmit and is busy while saving", () => {
    const onSubmit = vi.fn();
    render(
      <TreeDialog label="New plan" busy onCancel={() => {}} onSubmit={onSubmit}>
        <button type="submit">Create</button>
      </TreeDialog>,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
