import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EditableText, type EditableTextCommit } from "../../../src";

function editable(props: Partial<Parameters<typeof EditableText>[0]> & { onCommit?: EditableTextCommit } = {}) {
  const onCommit = props.onCommit ?? vi.fn<EditableTextCommit>(async () => null);
  const onUnsaved = vi.fn();
  const view = render(
    <EditableText
      text="river"
      label="Approved translations of fiume"
      editLabel="Edit the approved translations of fiume"
      editIcon={<svg aria-hidden="true" />}
      onCommit={onCommit}
      onUnsaved={onUnsaved}
      {...props}
    />,
  );
  return { ...view, onCommit, onUnsaved };
}

const pencil = () => screen.getByRole("button", { name: "Edit the approved translations of fiume" });
const field = () => screen.getByRole("textbox", { name: "Approved translations of fiume" });

describe("EditableText", () => {
  it("reads as text with a pencil button until edited", () => {
    editable();
    expect(screen.getByText("river")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(pencil()).toHaveAttribute("title", "Edit the approved translations of fiume");
  });

  it("starts editing from the pencil, with the text selected in a focused field", () => {
    editable();
    fireEvent.click(pencil());
    expect(field()).toHaveFocus();
    expect(field()).toHaveValue("river");
  });

  it("shows the pencil only on hover, or not at all, when asked", () => {
    const view = editable({ pencilVisible: "onHover" });
    const holder = view.container.firstElementChild!;
    expect(holder).toHaveAttribute("data-pencil", "hover");
    expect(pencil()).toBeInTheDocument();
    view.unmount();
    const hidden = editable({ pencilVisible: "hidden" });
    expect(hidden.container.firstElementChild).toHaveAttribute("data-pencil", "hidden");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    // Without a pencil the text is still edited by double-clicking it.
    fireEvent.doubleClick(screen.getByText("river"));
    expect(field()).toHaveFocus();
    hidden.unmount();
    const captioned = editable({ pencilVisible: "hidden", caption: "Translations" });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    captioned.unmount();
    editable();
    expect(screen.getByText("river").closest(".eh-editable")).not.toHaveAttribute("data-pencil");
  });

  it("starts editing on a double-click", () => {
    const { container } = editable();
    fireEvent.doubleClick(container.querySelector(".eh-editable")!);
    expect(field()).toBeInTheDocument();
  });

  it("saves a one-line text with Enter and gives the focus back to the pencil", async () => {
    const { onCommit } = editable();
    fireEvent.click(pencil());
    fireEvent.change(field(), { target: { value: "stream" } });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith("stream");
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
    await waitFor(() => expect(pencil()).toHaveFocus());
  });

  it("saves when the field is left", async () => {
    const { onCommit } = editable();
    fireEvent.click(pencil());
    fireEvent.change(field(), { target: { value: "stream" } });
    fireEvent.blur(field());
    expect(onCommit).toHaveBeenCalledWith("stream");
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
  });

  it("cancels with Escape, saving nothing", async () => {
    const { onCommit } = editable();
    fireEvent.click(pencil());
    fireEvent.change(field(), { target: { value: "stream" } });
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText("river")).toBeInTheDocument();
  });

  it("ends without saving when nothing changed", () => {
    const { onCommit } = editable();
    fireEvent.click(pencil());
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("keeps a refused value in the field with the reason under it", async () => {
    const { onCommit } = editable({ onCommit: vi.fn<EditableTextCommit>(async () => "Another entry has this term.") });
    fireEvent.click(pencil());
    fireEvent.change(field(), { target: { value: "sera" } });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Another entry has this term.");
    expect(field()).toHaveValue("sera");
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(field()).toHaveAccessibleDescription("Another entry has this term.");
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("reports unsaved changes while a changed field is open", () => {
    const { onUnsaved } = editable();
    fireEvent.click(pencil());
    expect(onUnsaved).toHaveBeenLastCalledWith(false);
    fireEvent.change(field(), { target: { value: "stream" } });
    expect(onUnsaved).toHaveBeenLastCalledWith(true);
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(onUnsaved).toHaveBeenLastCalledWith(false);
  });

  it("edits a multiline text one item per line, saving with Ctrl+Enter but not Enter", async () => {
    const { onCommit } = editable({ text: "evening\ndusk", multiline: true, shown: "evening, dusk" });
    expect(screen.getByText("evening, dusk")).toBeInTheDocument();
    fireEvent.click(pencil());
    expect(field().tagName).toBe("TEXTAREA");
    fireEvent.change(field(), { target: { value: "evening\ndusk\nnightfall" } });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.keyDown(field(), { key: "Enter", ctrlKey: true });
    expect(onCommit).toHaveBeenCalledWith("evening\ndusk\nnightfall");
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
  });

  it("ignores keys while an input method is composing", () => {
    const { onCommit } = editable();
    fireEvent.click(pencil());
    fireEvent.change(field(), { target: { value: "河" } });
    fireEvent.keyDown(field(), { key: "Enter", isComposing: true });
    expect(onCommit).not.toHaveBeenCalled();
    expect(field()).toBeInTheDocument();
  });

  it("starts editing when the caller asks", () => {
    const { rerender } = editable();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    rerender(
      <EditableText
        text="river"
        label="Approved translations of fiume"
        editLabel="Edit the approved translations of fiume"
        editIcon={null}
        editRequest={1}
        onCommit={async () => null}
      />,
    );
    expect(field()).toHaveFocus();
  });

  it("does not start while disabled", () => {
    const { container } = editable({ disabled: true });
    expect(pencil()).toBeDisabled();
    fireEvent.doubleClick(container.querySelector(".eh-editable")!);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("reads an empty text as its own muted wording, keeping its pencil", () => {
    editable({ text: "", empty: "No description" });
    expect(screen.getByText("No description")).toHaveClass("eh-editable-empty");
    expect(pencil()).toBeInTheDocument();
    fireEvent.click(pencil());
    expect(field()).toHaveValue("");
  });

  it("shows a hint under the open field, describing it", () => {
    editable({ hint: "One item per line." });
    expect(screen.queryByText("One item per line.")).not.toBeInTheDocument();
    fireEvent.click(pencil());
    expect(field()).toHaveAccessibleDescription("One item per line.");
  });

  it("selects what the caller asks for when it asks to edit", () => {
    const { rerender } = editable({ text: "evening\ndusk", multiline: true });
    rerender(
      <EditableText
        text={"evening\ndusk"}
        multiline
        label="Approved translations of fiume"
        editLabel="Edit the approved translations of fiume"
        editIcon={null}
        editRequest={1}
        selection={[8, 12]}
        onCommit={async () => null}
      />,
    );
    const area = field() as HTMLTextAreaElement;
    expect(area).toHaveFocus();
    expect([area.selectionStart, area.selectionEnd]).toEqual([8, 12]);
  });

  it("tells the caller what the open field holds, and when it closes", () => {
    const onEditing = vi.fn();
    editable({ onEditing });
    expect(onEditing).toHaveBeenLastCalledWith(null);
    fireEvent.click(pencil());
    expect(onEditing).toHaveBeenLastCalledWith("river");
    fireEvent.change(field(), { target: { value: "stream" } });
    expect(onEditing).toHaveBeenLastCalledWith("stream");
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(onEditing).toHaveBeenLastCalledWith(null);
  });

  it("puts the pencil beside a caption above the text, the caption staying while it is edited", () => {
    const { container } = editable({ text: "evening\ndusk", multiline: true, caption: "Other forms" });
    const caption = container.querySelector(".eh-editable-caption")!;
    expect(caption).toHaveTextContent("Other forms");
    expect(caption).toContainElement(pencil());
    expect(container.querySelector(".eh-editable-text")).not.toContainElement(pencil());
    fireEvent.click(pencil());
    expect(container.querySelector(".eh-editable-caption")).toHaveTextContent("Other forms");
    expect(field()).toHaveValue("evening\ndusk");
  });

  describe("as a choice", () => {
    const choices = [
      { value: "", label: "No image" },
      { value: "a", label: "cottage.svg" },
      { value: "b", label: "map.svg" },
    ];
    const select = () => screen.getByRole("combobox", { name: "Image" });
    const choice = (props: Partial<Parameters<typeof EditableText>[0]> = {}) => {
      const onCommit = vi.fn<EditableTextCommit>(async () => null);
      const view = render(
        <EditableText
          text="a"
          choices={choices}
          empty="No image"
          label="Image"
          editLabel="Edit image"
          editIcon={null}
          onCommit={onCommit}
          {...props}
        />,
      );
      return { ...view, onCommit };
    };

    it("reads as the chosen value's label, or its empty wording", () => {
      const { rerender } = choice();
      expect(screen.getByText("cottage.svg")).toBeInTheDocument();
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
      rerender(
        <EditableText
          text=""
          choices={choices}
          empty="No image"
          label="Image"
          editLabel="Edit image"
          editIcon={null}
          onCommit={async () => null}
        />,
      );
      expect(screen.getByText("No image")).toHaveClass("eh-editable-empty");
    });

    it("opens a select from its pencil and saves the choice when it is left", async () => {
      const { onCommit } = choice();
      fireEvent.click(screen.getByRole("button", { name: "Edit image" }));
      expect(select()).toHaveFocus();
      expect(select()).toHaveValue("a");
      fireEvent.change(select(), { target: { value: "b" } });
      expect(onCommit).not.toHaveBeenCalled();
      fireEvent.blur(select());
      expect(onCommit).toHaveBeenCalledWith("b");
      await waitFor(() => expect(screen.queryByRole("combobox")).not.toBeInTheDocument());
    });

    it("saves a pick made with the pointer at once, closing the field", async () => {
      const { onCommit } = choice();
      fireEvent.click(screen.getByRole("button", { name: "Edit image" }));
      fireEvent.pointerDown(select());
      fireEvent.change(select(), { target: { value: "b" } });
      expect(onCommit).toHaveBeenCalledWith("b");
      await waitFor(() => expect(screen.queryByRole("combobox")).not.toBeInTheDocument());
    });

    it("moves through the choices with the keyboard without saving until Enter", async () => {
      const { onCommit } = choice();
      fireEvent.click(screen.getByRole("button", { name: "Edit image" }));
      // A pointer that opened the dropdown and then gave way to the keyboard does not save either.
      fireEvent.pointerDown(select());
      fireEvent.keyDown(select(), { key: "ArrowDown" });
      fireEvent.change(select(), { target: { value: "b" } });
      fireEvent.keyDown(select(), { key: "ArrowUp" });
      fireEvent.change(select(), { target: { value: "" } });
      expect(onCommit).not.toHaveBeenCalled();
      fireEvent.keyDown(select(), { key: "Enter" });
      expect(onCommit).toHaveBeenCalledWith("");
      await waitFor(() => expect(screen.queryByRole("combobox")).not.toBeInTheDocument());
    });

    it("saves with Enter and cancels with Escape", async () => {
      const { onCommit } = choice();
      fireEvent.doubleClick(screen.getByText("cottage.svg"));
      fireEvent.change(select(), { target: { value: "" } });
      fireEvent.keyDown(select(), { key: "Escape" });
      expect(onCommit).not.toHaveBeenCalled();
      expect(screen.getByText("cottage.svg")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Edit image" }));
      fireEvent.change(select(), { target: { value: "" } });
      fireEvent.keyDown(select(), { key: "Enter" });
      expect(onCommit).toHaveBeenCalledWith("");
      await waitFor(() => expect(screen.queryByRole("combobox")).not.toBeInTheDocument());
    });
  });

  it("can be a table cell with the caller's attributes", () => {
    render(
      <table>
        <tbody>
          <tr>
            <EditableText
              as="td"
              className="glossary-cell"
              containerProps={{ "data-field": "approved" }}
              text="river"
              label="Approved"
              editLabel="Edit"
              editIcon={null}
              onCommit={async () => null}
            />
          </tr>
        </tbody>
      </table>,
    );
    const cell = screen.getByRole("cell");
    expect(cell).toHaveClass("eh-editable", "glossary-cell");
    expect(cell).toHaveAttribute("data-field", "approved");
    act(() => fireEvent.click(screen.getByRole("button", { name: "Edit" })));
    expect(screen.getByRole("cell")).toHaveAttribute("data-editing", "true");
  });
});
