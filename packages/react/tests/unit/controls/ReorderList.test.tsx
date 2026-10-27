import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createTranslate, ReorderList } from "../../../src";

const t = createTranslate();

const steps = [
  { id: "a", name: "Act 1" },
  { id: "b", name: "Act 2" },
  { id: "c", name: "Act 3" },
];

function list(props: { disabled?: boolean } = {}) {
  const onMove = vi.fn();
  const onAction = vi.fn();
  render(
    <ReorderList
      label="Steps"
      items={steps}
      idOf={(step) => step.id}
      menuLabel={(step) => `Step actions: ${step.name}`}
      actions={() => [{ id: "delete", label: "Delete" }]}
      dragType="application/x-test"
      onMove={onMove}
      onAction={onAction}
      {...props}
    >
      {(step) => (
        <>
          <span>{step.name}</span>
          <input aria-label={`Name of ${step.name}`} defaultValue={step.name} />
        </>
      )}
    </ReorderList>,
  );
  return { onMove, onAction };
}

const row = (name: string) => screen.getByText(name).closest("li")!;

describe("ReorderList", () => {
  it("lists its rows, each one focusable, without move or delete buttons", () => {
    list();
    const rows = within(screen.getByRole("list", { name: "Steps" })).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAttribute("tabindex", "0");
    expect(rows[0]).toHaveAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("moves the focused row with Alt+Up and Alt+Down, not past either end", () => {
    const { onMove } = list();
    fireEvent.keyDown(row("Act 2"), { key: "ArrowDown", altKey: true });
    expect(onMove).toHaveBeenLastCalledWith("b", 2);
    fireEvent.keyDown(row("Act 2"), { key: "ArrowUp", altKey: true });
    expect(onMove).toHaveBeenLastCalledWith("b", 0);
    fireEvent.keyDown(row("Act 1"), { key: "ArrowUp", altKey: true });
    fireEvent.keyDown(row("Act 3"), { key: "ArrowDown", altKey: true });
    fireEvent.keyDown(row("Act 2"), { key: "ArrowDown" });
    expect(onMove).toHaveBeenCalledTimes(2);
  });

  it("opens a menu with Move up, Move down and the caller's actions, giving the focus back to the row", () => {
    const { onMove, onAction } = list();
    fireEvent.keyDown(row("Act 1"), { key: "ContextMenu" });
    const menu = screen.getByRole("menu", { name: "Step actions: Act 1" });
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([t("common.moveUp"), t("common.moveDown"), "Delete"]);
    expect(within(menu).getByRole("menuitem", { name: t("common.moveUp") })).toBeDisabled();
    fireEvent.click(within(menu).getByRole("menuitem", { name: t("common.moveDown") }));
    expect(onMove).toHaveBeenCalledWith("a", 1);
    expect(row("Act 1")).toHaveFocus();

    fireEvent.contextMenu(row("Act 3"), { clientX: 10, clientY: 20 });
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onAction).toHaveBeenCalledWith("delete", steps[2]);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.keyDown(row("Act 2"), { key: "F10", shiftKey: true });
    fireEvent.keyDown(screen.getByRole("menuitem", { name: t("common.moveUp") }), { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(row("Act 2")).toHaveFocus();
  });

  it("leaves a field's own keys and text menu alone", () => {
    const { onMove } = list();
    const field = screen.getByRole("textbox", { name: "Name of Act 2" });
    const event = fireEvent.contextMenu(field);
    expect(event).toBe(true);
    fireEvent.keyDown(field, { key: "ContextMenu" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    // Alt+arrows from inside the row still move it (fields that edit text stop them themselves).
    fireEvent.keyDown(field, { key: "ArrowUp", altKey: true });
    expect(onMove).toHaveBeenCalledWith("b", 0);
  });

  it("moves a row dropped on another to that row's place, and marks where it would go", () => {
    const { onMove } = list();
    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "",
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? "",
    };
    fireEvent.dragStart(row("Act 3"), { dataTransfer });
    expect(data.get("application/x-test")).toBe("c");
    fireEvent.dragOver(row("Act 1"), { dataTransfer });
    expect(row("Act 1")).toHaveAttribute("data-drop", "before");
    fireEvent.dragLeave(row("Act 1"), { dataTransfer });
    expect(row("Act 1")).not.toHaveAttribute("data-drop");
    fireEvent.dragOver(row("Act 1"), { dataTransfer });
    fireEvent.drop(row("Act 1"), { dataTransfer });
    expect(onMove).toHaveBeenCalledWith("c", 0);
    // A row dropped on itself, or a drag that ends elsewhere, moves nothing.
    fireEvent.dragStart(row("Act 2"), { dataTransfer });
    fireEvent.drop(row("Act 2"), { dataTransfer });
    fireEvent.dragStart(row("Act 2"), { dataTransfer });
    fireEvent.dragEnd(row("Act 2"), { dataTransfer });
    fireEvent.dragOver(row("Act 1"), { dataTransfer });
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it("does nothing while disabled", () => {
    const { onMove } = list({ disabled: true });
    expect(row("Act 1")).toHaveAttribute("draggable", "false");
    fireEvent.keyDown(row("Act 1"), { key: "ArrowDown", altKey: true });
    fireEvent.contextMenu(row("Act 1"));
    expect(onMove).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("ReorderList's Delete key", () => {
  function deletable() {
    const onDelete = vi.fn();
    const view = (items: typeof steps) => (
      <ReorderList
        label="Steps"
        items={items}
        idOf={(step) => step.id}
        menuLabel={(step) => step.name}
        dragType="application/x-test"
        onMove={vi.fn()}
        onDelete={onDelete}
      >
        {(step) => (
          <>
            <span>{step.name}</span>
            <input aria-label={`Name of ${step.name}`} defaultValue={step.name} />
          </>
        )}
      </ReorderList>
    );
    const { rerender } = render(view(steps));
    return { onDelete, rerender: (items: typeof steps) => rerender(view(items)) };
  }

  it("asks the caller to delete the focused row, but not from a field or with a modifier", () => {
    const { onDelete } = deletable();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Name of Act 2" }), { key: "Delete" });
    fireEvent.keyDown(row("Act 2"), { key: "Delete", shiftKey: true });
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.keyDown(row("Act 2"), { key: "Delete" });
    expect(onDelete).toHaveBeenCalledWith(steps[1]);
  });

  it("gives the focus to the row in the removed row's place, or the last one", () => {
    const { rerender } = deletable();
    row("Act 2").focus();
    rerender([steps[0]!, steps[2]!]);
    expect(row("Act 3")).toHaveFocus();
    rerender([steps[0]!]);
    expect(row("Act 1")).toHaveFocus();
    // The focus in a field of the removed row goes to the row in its place too.
    rerender([steps[0]!, steps[1]!]);
    screen.getByRole("textbox", { name: "Name of Act 1" }).focus();
    rerender([steps[1]!]);
    expect(row("Act 2")).toHaveFocus();
    // A row removed while the focus is in another row leaves the focus where it is.
    rerender([steps[1]!, steps[2]!]);
    const field = screen.getByRole("textbox", { name: "Name of Act 3" });
    field.focus();
    rerender([steps[2]!]);
    expect(field).toHaveFocus();
  });
});
