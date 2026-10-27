import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { check, current, find, LIST, show, t } from "./fixtures";

const dialog = () => screen.getByRole("dialog", { name: t("todo.detailsNamed", { title: "Book flights" }) });
const field = (label: string) => within(dialog()).getByLabelText(label);

describe("an item's details", () => {
  it("opens with Enter, showing every field", () => {
    show();
    fireEvent.keyDown(check("Book flights"), { key: "Enter" });
    expect(field(t("todo.title"))).toHaveValue("Book flights");
    expect(field(t("todo.dueDay"))).toHaveValue("2026-11-02");
    expect(field(t("todo.notes"))).toHaveValue("");
    expect(field(t("todo.notes"))).toHaveAccessibleDescription(t("todo.notesCount", { count: 0, max: 250 }));
    expect(field(t("todo.tags"))).toHaveValue("Travel");
    expect(field(t("todo.urgent"))).toBeChecked();
    expect(field(t("todo.important"))).toBeChecked();
  });

  it("saves every field at once, and gives the focus back to the item", () => {
    show();
    fireEvent.keyDown(check("Book flights"), { key: "Enter" });
    fireEvent.change(field(t("todo.title")), { target: { value: "Book trains" } });
    fireEvent.change(field(t("todo.dueDay")), { target: { value: "" } });
    fireEvent.change(field(t("todo.notes")), { target: { value: "Window seat\nQuiet coach" } });
    expect(field(t("todo.notes"))).toHaveAccessibleDescription(t("todo.notesCount", { count: 23, max: 250 }));
    fireEvent.change(field(t("todo.tags")), { target: { value: "Travel, work, ,Work" } });
    fireEvent.click(field(t("todo.urgent")));
    fireEvent.click(screen.getByRole("button", { name: t("common.save") }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(find("b")).toMatchObject({
      title: "Book trains",
      due: null,
      notes: "Window seat\nQuiet coach",
      tags: ["Travel", "work"],
      urgent: false,
      important: true,
    });
    expect(check("Book trains")).toHaveFocus();
  });

  it("says under each field why it cannot be saved, and saves nothing", () => {
    show();
    fireEvent.keyDown(check("Book flights"), { key: "Enter" });
    fireEvent.change(field(t("todo.title")), { target: { value: " " } });
    fireEvent.change(field(t("todo.notes")), { target: { value: "x".repeat(251) } });
    fireEvent.change(field(t("todo.tags")), { target: { value: "x".repeat(41) } });
    fireEvent.click(screen.getByRole("button", { name: t("common.save") }));
    expect(field(t("todo.title"))).toHaveAccessibleDescription(t("todo.problem.blank"));
    expect(field(t("todo.title"))).toHaveAttribute("aria-invalid", "true");
    expect(field(t("todo.notes"))).toHaveAccessibleDescription(
      `${t("todo.problem.notesTooLong", { max: 250 })} ${t("todo.notesCount", { count: 251, max: 250 })}`,
    );
    expect(field(t("todo.tags"))).toHaveAccessibleDescription(
      `${t("todo.problem.tagTooLong", { max: 40 })} ${t("todo.tagsHint")}`,
    );
    fireEvent.change(field(t("todo.title")), { target: { value: "x".repeat(121) } });
    fireEvent.change(field(t("todo.notes")), { target: { value: "" } });
    fireEvent.change(field(t("todo.tags")), {
      target: { value: Array.from({ length: 21 }, (_, n) => `tag ${n}`).join(",") },
    });
    fireEvent.click(screen.getByRole("button", { name: t("common.save") }));
    expect(field(t("todo.title"))).toHaveAccessibleDescription(t("todo.problem.titleTooLong", { max: 120 }));
    expect(field(t("todo.tags"))).toHaveAccessibleDescription(
      `${t("todo.problem.tagLimit", { max: 20 })} ${t("todo.tagsHint")}`,
    );
    expect(current).toBe(LIST);
  });

  it("closes without saving on Cancel or Escape, giving the focus back", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: t("todo.actionsNamed", { title: "Book flights" }) }));
    fireEvent.click(screen.getByRole("menuitem", { name: t("todo.details") }));
    fireEvent.change(field(t("todo.title")), { target: { value: "Book trains" } });
    fireEvent.click(screen.getByRole("button", { name: t("common.cancel") }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(check("Book flights")).toHaveFocus();
    fireEvent.keyDown(check("Book flights"), { key: "Enter" });
    fireEvent.keyDown(field(t("todo.title")), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(current).toBe(LIST);
  });
});
