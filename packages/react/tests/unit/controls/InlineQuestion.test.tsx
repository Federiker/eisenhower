import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InlineQuestion } from "../../../src";

describe("InlineQuestion", () => {
  it("asks in place as an alert dialog with its answers", () => {
    const discard = vi.fn();
    const keep = vi.fn();
    render(
      <InlineQuestion
        label="Discard your changes?"
        question="Discard your changes?"
        actions={
          <>
            <button
              type="button"
              // biome-ignore lint/a11y/noAutofocus: the test checks that the focus the question's content asks for is kept.
              autoFocus
              onClick={discard}
            >
              Discard
            </button>
            <button type="button" onClick={keep}>
              Keep editing
            </button>
          </>
        }
      />,
    );
    const question = screen.getByRole("alertdialog", { name: "Discard your changes?" });
    expect(question).toHaveClass("eh-question");
    expect(screen.getByRole("button", { name: "Discard" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(keep).toHaveBeenCalledOnce();
    expect(discard).not.toHaveBeenCalled();
  });

  it("shows what the caller adds between the question and the answers", () => {
    render(
      <InlineQuestion
        label="Delete Main?"
        question="Its entries go too."
        actions={<button type="button">Delete</button>}
      >
        <p>Or move them first.</p>
      </InlineQuestion>,
    );
    const texts = [...screen.getByRole("alertdialog").children].map((child) => child.textContent);
    expect(texts).toEqual(["Its entries go too.", "Or move them first.", "Delete"]);
  });

  it("has no row of answers when there are none", () => {
    render(<InlineQuestion label="Kept" question="Nothing to do." />);
    expect(screen.getByRole("alertdialog").querySelector(".eh-question-actions")).toBeNull();
  });

  it("answers Escape and keeps it from going further", () => {
    const onEscape = vi.fn();
    const outer = vi.fn();
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: the test listens for the keys the question lets through.
      <div onKeyDown={outer}>
        <InlineQuestion
          label="Delete the card?"
          question="The card is deleted."
          onEscape={onEscape}
          actions={<button type="button">Delete</button>}
        />
      </div>,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "Delete" }), { key: "Enter" });
    expect(onEscape).not.toHaveBeenCalled();
    expect(outer).toHaveBeenCalledOnce();
    fireEvent.keyDown(screen.getByRole("button", { name: "Delete" }), { key: "Escape" });
    expect(onEscape).toHaveBeenCalledOnce();
    expect(outer).toHaveBeenCalledOnce();
  });
});
