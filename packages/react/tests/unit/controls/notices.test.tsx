import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Notice } from "../../../src";

describe("Notice", () => {
  it("is a muted note paragraph by default", () => {
    render(<Notice>Saved</Notice>);
    const note = screen.getByText("Saved");
    expect(note.tagName).toBe("P");
    expect(note).toHaveClass("eh-note");
    expect(note).not.toHaveAttribute("role");
  });

  it("announces a problem as an alert", () => {
    render(<Notice tone="problem">The name is blank.</Notice>);
    expect(screen.getByRole("alert")).toHaveTextContent("The name is blank.");
    expect(screen.getByRole("alert")).toHaveClass("eh-problem");
  });

  it("takes another element, role and class", () => {
    render(
      <Notice as="span" role="status" className="bin-notice" id="saved">
        Saved
      </Notice>,
    );
    const note = screen.getByRole("status");
    expect(note.tagName).toBe("SPAN");
    expect(note).toHaveClass("eh-note", "bin-notice");
    expect(note).toHaveAttribute("id", "saved");
  });
});
