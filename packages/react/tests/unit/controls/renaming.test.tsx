import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InlineRename, NameField } from "../../../src";

describe("InlineRename", () => {
  function rename() {
    const onRename = vi.fn();
    const onCancel = vi.fn();
    render(<InlineRename title="Opening" label="Rename Opening" onRename={onRename} onCancel={onCancel} />);
    return { onRename, onCancel, field: screen.getByRole("textbox", { name: "Rename Opening" }) };
  }

  it("takes the focus with the title in the box", () => {
    const { field } = rename();
    expect(field).toHaveFocus();
    expect(field).toHaveValue("Opening");
    expect(field).toHaveClass("eh-inline-rename");
  });

  it("saves a changed title, trimmed, with Enter", () => {
    const { field, onRename, onCancel } = rename();
    fireEvent.change(field, { target: { value: "  The opening  " } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onRename).toHaveBeenCalledWith("The opening");
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("saves when the box is left, once", () => {
    const { field, onRename } = rename();
    fireEvent.change(field, { target: { value: "Prologue" } });
    fireEvent.keyDown(field, { key: "Enter" });
    fireEvent.blur(field);
    expect(onRename).toHaveBeenCalledOnce();
  });

  it("cancels with Escape", () => {
    const first = rename();
    fireEvent.change(first.field, { target: { value: "Prologue" } });
    fireEvent.keyDown(first.field, { key: "Escape" });
    expect(first.onCancel).toHaveBeenCalledOnce();
    expect(first.onRename).not.toHaveBeenCalled();
  });

  it("treats a blank title as no change", () => {
    const { field, onRename, onCancel } = rename();
    fireEvent.change(field, { target: { value: "   " } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onRename).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("does nothing while an input method is composing", () => {
    const { field, onRename, onCancel } = rename();
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    expect(onRename).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe("NameField", () => {
  it("keeps a change when left or with Enter, and puts back the saved name with Escape", () => {
    const onCommit = vi.fn(async () => true);
    render(<NameField value="Act 1" label="Step name" disabled={false} onCommit={onCommit} />);
    const field = screen.getByRole("textbox", { name: "Step name" });
    fireEvent.change(field, { target: { value: "Act one" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith("Act one");
    fireEvent.change(field, { target: { value: "Act I" } });
    fireEvent.keyDown(field, { key: "Escape" });
    expect(field).toHaveValue("Act 1");
    fireEvent.change(field, { target: { value: "Act 2" } });
    fireEvent.blur(field);
    expect(onCommit).toHaveBeenLastCalledWith("Act 2");
  });

  it("saves nothing when the name did not change", () => {
    const onCommit = vi.fn(async () => true);
    render(<NameField value="Act 1" label="Step name" disabled={false} onCommit={onCommit} />);
    fireEvent.blur(screen.getByRole("textbox", { name: "Step name" }));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("follows a new saved name", () => {
    const { rerender } = render(
      <NameField value="Act 1" label="Step name" disabled={false} onCommit={async () => true} />,
    );
    rerender(<NameField value="Act one" label="Step name" disabled={false} onCommit={async () => true} />);
    expect(screen.getByRole("textbox", { name: "Step name" })).toHaveValue("Act one");
  });
});
