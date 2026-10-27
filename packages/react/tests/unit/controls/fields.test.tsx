import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Checkbox, Select, TextArea, TextField } from "../../../src";

describe("fields", () => {
  it("renders a text field with the shared look, labelled by its label", () => {
    const onChange = vi.fn();
    render(
      <>
        <label htmlFor="name">Name</label>
        <TextField id="name" value="Draft" className="card-title" onChange={(event) => onChange(event.target.value)} />
      </>,
    );
    const field = screen.getByRole("textbox", { name: "Name" });
    expect(field).toHaveClass("eh-field", "card-title");
    fireEvent.change(field, { target: { value: "Draft the plan" } });
    expect(onChange).toHaveBeenCalledWith("Draft the plan");
  });

  it("renders a text area and a select with the same look", () => {
    render(
      <>
        <TextArea aria-label="Description" defaultValue="A card for each task." />
        <Select aria-label="Folder" defaultValue="doing">
          <option value="">None</option>
          <option value="doing">Doing</option>
        </Select>
      </>,
    );
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveClass("eh-field");
    const select = screen.getByRole("combobox", { name: "Folder" });
    expect(select).toHaveClass("eh-field");
    expect(select).toHaveValue("doing");
  });

  it("renders a check box in the accent colour", () => {
    const onChange = vi.fn();
    render(<Checkbox aria-label="Match case" checked={false} onChange={(event) => onChange(event.target.checked)} />);
    const box = screen.getByRole("checkbox", { name: "Match case" });
    expect(box).toHaveClass("eh-checkbox");
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
