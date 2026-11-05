import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createTranslate } from "../../../src";
import { latest, PLAN, setup } from "./fixtures";

const t = createTranslate();
const group = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name},`) });
const nameOf = (text: string) => screen.getByText(text, { selector: ".eh-gantt-task-name, .eh-gantt-group-name" });

describe("renaming by a double-click on a name", () => {
  it("opens a task's name in place, and Enter renames it", () => {
    setup();
    fireEvent.doubleClick(nameOf("Sketch"));
    const field = screen.getByRole("textbox", { name: t("gantt.renameTask", { name: "Sketch" }) });
    fireEvent.change(field, { target: { value: "Rough sketch" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(latest.chart.tasks.find((task) => task.id === "sketch")!.name).toBe("Rough sketch");
  });

  it("opens a group's name, which a click no longer folds; its chevron does", () => {
    setup();
    fireEvent.click(nameOf("Design"), { detail: 1 });
    expect(latest.chart.groups[0]!.collapsed).toBe(false);
    fireEvent.doubleClick(nameOf("Design"));
    expect(screen.getByRole("textbox", { name: t("gantt.renameGroup", { name: "Design" }) })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    const chevron = group("Design").querySelector(".eh-gantt-chevron")!;
    fireEvent.click(chevron, { detail: 1 });
    expect(latest.chart.groups[0]!.collapsed).toBe(true);
    // A double-click on the chevron folds and unfolds, and renames nothing.
    fireEvent.doubleClick(chevron);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    // A key on the button (a click without a pointer) still folds it.
    fireEvent.click(group("Design"), { detail: 0 });
    expect(latest.chart.groups[0]!.collapsed).toBe(false);
  });

  it("renames nothing in a read-only chart", () => {
    setup({ readOnly: true });
    fireEvent.doubleClick(nameOf("Sketch"));
    fireEvent.doubleClick(nameOf("Design"));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

describe("a group's colour", () => {
  const coloured = { ...PLAN, groups: PLAN.groups.map((one) => (one.id === "build" ? { ...one, colour: 4 } : one)) };

  it("draws its summary bar and a swatch beside its name in it; a group without one keeps the ink", () => {
    setup({}, coloured);
    const build = group("Build").closest("[role=row]")!;
    expect(build.querySelector<HTMLElement>(".eh-gantt-summary")!.style.getPropertyValue("--eh-gantt-summary")).toBe(
      "var(--eh-colour-4)",
    );
    expect(build.querySelector<HTMLElement>(".eh-gantt-group-swatch")!.style.background).toBe("var(--eh-colour-4)");
    const design = group("Design").closest("[role=row]")!;
    expect(design.querySelector<HTMLElement>(".eh-gantt-summary")!.style.getPropertyValue("--eh-gantt-summary")).toBe(
      "",
    );
    expect(design.querySelector(".eh-gantt-group-swatch")).toBeNull();
  });

  it("is the colour of a task made in the group", () => {
    const { unmount } = setup({}, coloured);
    act(() => group("Build").focus());
    fireEvent.click(screen.getByRole("button", { name: t("gantt.newTask") }));
    const made = latest.chart.tasks.find((task) => !PLAN.tasks.some((one) => one.id === task.id))!;
    expect(made).toMatchObject({ groupId: "build", colour: 4 });
    unmount();
    setup({}, coloured);
    act(() => group("Design").focus());
    fireEvent.click(screen.getByRole("button", { name: t("gantt.newTask") }));
    const plain = latest.chart.tasks.find((task) => task.groupId === "design" && task.name.startsWith("New task"))!;
    expect(plain.colour).toBeNull();
  });
});

describe("Colour… in a group's menu", () => {
  const openColour = (name: string) => {
    act(() => group(name).focus());
    fireEvent.keyDown(group(name), { key: "F10", shiftKey: true });
    fireEvent.click(screen.getByRole("menuitem", { name: t("gantt.groupColour") }));
    return screen.getByRole("dialog", { name: t("gantt.groupColourTitle", { name }) });
  };

  it("gives the group a colour with the picker, says so, and takes it away with None", () => {
    setup();
    let dialog = openColour("Build");
    const picker = within(dialog).getByRole("combobox", { name: t("gantt.fieldColour") });
    expect(picker).toHaveTextContent(t("common.colour.none"));
    fireEvent.click(picker);
    fireEvent.click(screen.getByRole("option", { name: t("common.colour.blue") }));
    fireEvent.click(within(dialog).getByRole("button", { name: t("common.save") }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(latest.chart.groups[1]!.colour).toBe(4);
    expect(screen.getByRole("status")).toHaveTextContent("Build: colour Blue");
    expect(group("Build")).toHaveFocus();

    dialog = openColour("Build");
    fireEvent.click(within(dialog).getByRole("combobox", { name: t("gantt.fieldColour") }));
    fireEvent.click(screen.getByRole("option", { name: t("common.colour.none") }));
    fireEvent.click(within(dialog).getByRole("button", { name: t("common.save") }));
    expect("colour" in latest.chart.groups[1]!).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent("Build: no colour");
  });

  it("changes nothing on Cancel", () => {
    setup();
    const dialog = openColour("Design");
    fireEvent.click(within(dialog).getByRole("button", { name: t("common.cancel") }));
    expect(latest.chart).toBe(PLAN);
    expect(group("Design")).toHaveFocus();
  });
});
