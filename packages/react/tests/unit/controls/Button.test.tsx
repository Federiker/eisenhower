import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button, IconButton } from "../../../src";

describe("Button", () => {
  it("is a plain button that never submits by accident", () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent)}>
        <Button>Add</Button>
      </form>,
    );
    const button = screen.getByRole("button", { name: "Add" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("eh-button");
    expect(button).not.toHaveAttribute("data-variant");
    fireEvent.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits when asked to", () => {
    render(
      <Button type="submit" variant="primary">
        Save
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "submit");
  });

  it.each(["primary", "quiet", "danger"] as const)("marks the %s variant for its styles", (variant) => {
    render(<Button variant={variant}>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute("data-variant", variant);
  });

  it("keeps the caller's class names and attributes", () => {
    render(
      <Button className="card-delete" disabled aria-label="Delete the card">
        Delete
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Delete the card" });
    expect(button).toHaveClass("eh-button", "card-delete");
    expect(button).toBeDisabled();
  });

  it("is a toggle with aria-pressed when pressed is given", () => {
    const { rerender } = render(<Button pressed={false}>Board</Button>);
    expect(screen.getByRole("button", { name: "Board", pressed: false })).toBeInTheDocument();
    rerender(<Button pressed>Board</Button>);
    expect(screen.getByRole("button", { name: "Board", pressed: true })).toBeInTheDocument();
  });

  it("is not a toggle unless pressed is given", () => {
    render(<Button>List</Button>);
    expect(screen.getByRole("button", { name: "List" })).not.toHaveAttribute("aria-pressed");
  });

  it("passes its ref to the button", () => {
    let element: HTMLButtonElement | null = null;
    render(
      <Button
        ref={(button) => {
          element = button;
        }}
      >
        New card
      </Button>,
    );
    expect(element).toBe(screen.getByRole("button", { name: "New card" }));
  });
});

describe("IconButton", () => {
  it("is named by its label, which is also its tooltip, and hides its icon", () => {
    const onClick = vi.fn();
    render(<IconButton label="Edit the term" icon={<svg aria-hidden="true" />} onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Edit the term" });
    expect(button).toHaveAttribute("title", "Edit the term");
    expect(button).toHaveAttribute("data-variant", "quiet");
    expect(button).toHaveClass("eh-button", "eh-icon-button");
    expect(button).toHaveTextContent("");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("takes another variant", () => {
    render(<IconButton label="Remove" icon="×" variant="danger" />);
    expect(screen.getByRole("button", { name: "Remove" })).toHaveAttribute("data-variant", "danger");
  });
});
