import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EditableText, LabelledField } from "../../../src";

describe("LabelledField", () => {
  it("shows its label above the field, and names the group by it", () => {
    render(
      <LabelledField label="Description" className="card-description">
        <EditableText
          text=""
          empty="No description"
          label="Description"
          editLabel="Edit description"
          editIcon={null}
          onCommit={async () => null}
        />
      </LabelledField>,
    );
    const group = screen.getByRole("group", { name: "Description" });
    expect(group).toHaveClass("eh-labelled-field", "card-description");
    expect(group).toHaveTextContent("DescriptionNo description");
    expect(screen.getByRole("button", { name: "Edit description" })).toBeInTheDocument();
  });

  it("leaves the visible label to a list field's caption, still naming the group", () => {
    render(
      <LabelledField label="Other names" captioned>
        <EditableText
          text="Mattie"
          caption="Other names"
          multiline
          label="Other names"
          editLabel="Edit other names"
          editIcon={null}
          onCommit={async () => null}
        />
      </LabelledField>,
    );
    const group = screen.getByRole("group", { name: "Other names" });
    expect(group.querySelector("legend")).toHaveClass("eh-visually-hidden");
    expect(group.querySelector(".eh-editable-caption")).toHaveTextContent("Other names");
  });
});
