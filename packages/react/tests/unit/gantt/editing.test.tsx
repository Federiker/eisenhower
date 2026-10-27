import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createTranslate } from "../../../src";
import { latest, PLAN, rowNames, setup, taskOf } from "./fixtures";

const t = createTranslate();
const bar = (name: RegExp | string) => screen.getByRole("button", { name });
const group = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name},`) });
const announced = () => screen.getByRole("status").textContent?.trim();
const press = (element: HTMLElement, key: string, extra: Partial<KeyboardEventInit> = {}) =>
  fireEvent.keyDown(element, { key, ...extra });
const menuItem = (name: string) => screen.getByRole("menuitem", { name });

describe("adding", () => {
  it("adds a task after the focused one, starting the day after it ends, open for its name", () => {
    setup();
    act(() => bar(/^Sketch/).focus());
    fireEvent.click(screen.getByRole("button", { name: t("gantt.newTask") }));
    const field = screen.getByRole("textbox", { name: "Name of New task" });
    expect(field).toHaveFocus();
    fireEvent.change(field, { target: { value: "Mood board" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(rowNames().slice(2, 6)).toEqual(["[Design]", "Sketch", "Mood board", "Review"]);
    const added = latest.chart.tasks.find((one) => one.name === "Mood board")!;
    expect(added).toMatchObject({ groupId: "design", start: "2026-11-07", end: "2026-11-11", progress: 0 });
    expect(bar(/^Mood board/)).toHaveFocus();
  });

  it("adds a task today, outside every group, when nothing is focused; and in a group from its menu", () => {
    setup({}, { groups: [{ id: "g", name: "G", collapsed: true }], tasks: [] });
    fireEvent.click(screen.getByRole("button", { name: t("gantt.newTask") }));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(latest.chart.tasks[0]).toMatchObject({ name: "New task", groupId: null, start: "2026-11-05" });
    fireEvent.contextMenu(group("G"), { clientX: 5, clientY: 5 });
    fireEvent.click(menuItem(t("gantt.newTaskHere")));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(latest.chart.tasks[1]).toMatchObject({ name: "New task 2", groupId: "g" });
    // The folded group opens to show it.
    expect(latest.chart.groups[0]!.collapsed).toBe(false);
  });

  it("adds a group at the end, open for its name", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: t("gantt.newGroup") }));
    const field = screen.getByRole("textbox", { name: "Name of the group New group" });
    fireEvent.change(field, { target: { value: "Test" } });
    fireEvent.blur(field);
    expect(latest.chart.groups.at(-1)).toMatchObject({ name: "Test", collapsed: false });
    expect(group("Test")).toHaveFocus();
  });
});

describe("renaming", () => {
  it("renames a task with F2, and Escape keeps its name", () => {
    setup();
    act(() => bar(/^Brief/).focus());
    press(bar(/^Brief/), "F2");
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Name of Brief" }), { key: "Escape" });
    expect(taskOf("brief").name).toBe("Brief");
    expect(bar(/^Brief/)).toHaveFocus();
    press(bar(/^Brief/), "F2");
    const field = screen.getByRole("textbox", { name: "Name of Brief" });
    fireEvent.change(field, { target: { value: "Briefing" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(taskOf("brief").name).toBe("Briefing");
  });

  it("renames a group from its menu, and says why a name is refused", () => {
    setup();
    fireEvent.contextMenu(group("Build"), { clientX: 5, clientY: 5 });
    fireEvent.click(menuItem(t("common.rename")));
    const field = screen.getByRole("textbox", { name: "Name of the group Build" });
    fireEvent.change(field, { target: { value: "x".repeat(121) } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(screen.getByRole("alert")).toHaveTextContent(t("gantt.problem.tooLong"));
    expect(latest.chart.groups[1]!.name).toBe("Build");
  });
});

describe("deleting", () => {
  it("asks first, and Cancel or Escape keeps the task and the focus on it", () => {
    setup();
    act(() => bar(/^Frame/).focus());
    press(bar(/^Frame/), "Delete");
    const question = screen.getByRole("alertdialog", { name: "Delete Frame?" });
    expect(within(question).getByRole("button", { name: t("gantt.confirmDeleteTask") })).toHaveFocus();
    fireEvent.keyDown(question, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(bar(/^Frame/)).toHaveFocus();
    press(bar(/^Frame/), "Delete");
    fireEvent.click(screen.getByRole("button", { name: t("common.cancel") }));
    expect(taskOf("frame")).toBeDefined();
  });

  it("deletes the task and the dependencies on it, the focus going to the row below", () => {
    setup();
    act(() => bar(/^Frame/).focus());
    press(bar(/^Frame/), "Delete");
    fireEvent.click(screen.getByRole("button", { name: t("gantt.confirmDeleteTask") }));
    expect(latest.chart.tasks.map((one) => one.id)).not.toContain("frame");
    expect(taskOf("release").dependsOn).toEqual(["paint"]);
    expect(bar(/^Paint/)).toHaveFocus();
    expect(announced()).toBe("Frame deleted");
  });

  it("deletes an empty group at once, and asks where a group's tasks go", () => {
    setup();
    act(() => group("Launch").focus());
    press(group("Launch"), "Delete");
    expect(latest.chart.groups.map((one) => one.id)).toEqual(["design", "build"]);
    expect(bar(/^Paint/)).toHaveFocus();
    act(() => group("Design").focus());
    press(group("Design"), "Delete");
    const question = screen.getByRole("alertdialog", { name: "Delete the group Design?" });
    expect(within(question).getByRole("button", { name: t("common.cancel") })).toHaveFocus();
    expect(within(question).queryByRole("button", { name: /^Move tasks to/ })).toHaveTextContent("Move tasks to Build");
    fireEvent.click(within(question).getByRole("button", { name: t("gantt.moveTasksOutside") }));
    expect(rowNames()).toEqual(["Brief", "Release", "Sketch", "Review", "[Build]", "Frame", "Paint"]);
  });

  it("moves a deleted group's tasks to the group before it, or deletes them with it", () => {
    setup();
    fireEvent.contextMenu(group("Build"), { clientX: 5, clientY: 5 });
    fireEvent.click(menuItem(t("gantt.deleteGroup")));
    fireEvent.click(screen.getByRole("button", { name: "Move tasks to Design" }));
    expect(rowNames()).toEqual(["Brief", "Release", "[Design]", "Sketch", "Review", "Frame", "Paint", "[Launch]"]);
    act(() => group("Design").focus());
    press(group("Design"), "Delete");
    fireEvent.click(screen.getByRole("button", { name: t("gantt.deleteWithTasks") }));
    expect(rowNames()).toEqual(["Brief", "Release", "[Launch]"]);
    expect(taskOf("release").dependsOn).toEqual([]);
    expect(group("Launch")).toHaveFocus();
  });

  it("moves the tasks to the group after, and Escape keeps the group", () => {
    setup();
    act(() => group("Design").focus());
    press(group("Design"), "Delete");
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(group("Design")).toHaveFocus();
    press(group("Design"), "Delete");
    fireEvent.click(screen.getByRole("button", { name: "Move tasks to Build" }));
    expect(rowNames()).toEqual(["Brief", "Release", "[Build]", "Sketch", "Review", "Frame", "Paint", "[Launch]"]);
  });
});

describe("the menus", () => {
  it("open with the Menu key on a task, beside it, and give the focus back on closing", () => {
    setup();
    act(() => bar(/^Review/).focus());
    press(bar(/^Review/), "ContextMenu");
    const menu = screen.getByRole("menu", { name: "Task actions: Review" });
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([
      t("gantt.open"),
      t("common.rename"),
      t("common.moveUp"),
      t("common.moveDown"),
      t("gantt.moveToGroup"),
      t("gantt.deleteTask"),
    ]);
    fireEvent.keyDown(menuItem(t("gantt.open")), { key: "Escape" });
    expect(bar(/^Review/)).toHaveFocus();
  });

  it("move a task up, down, to another group and delete it", () => {
    setup();
    fireEvent.contextMenu(bar(/^Review/), { clientX: 5, clientY: 5 });
    fireEvent.click(menuItem(t("common.moveUp")));
    expect(rowNames().slice(3, 5)).toEqual(["Review", "Sketch"]);
    fireEvent.contextMenu(bar(/^Review/), { clientX: 5, clientY: 5 });
    fireEvent.click(menuItem(t("common.moveDown")));
    expect(rowNames().slice(3, 5)).toEqual(["Sketch", "Review"]);
    fireEvent.contextMenu(bar(/^Review/), { clientX: 5, clientY: 5 });
    fireEvent.click(menuItem(t("gantt.moveToGroup")));
    fireEvent.click(screen.getByRole("radio", { name: "Launch" }));
    fireEvent.click(screen.getByRole("button", { name: t("common.moveConfirm") }));
    expect(rowNames().slice(-2)).toEqual(["[Launch]", "Review"]);
    expect(announced()).toBe("Review: moved to Launch, 1 of 1");
    fireEvent.contextMenu(bar(/^Review/), { clientX: 5, clientY: 5 });
    fireEvent.click(menuItem(t("gantt.moveToGroup")));
    fireEvent.click(screen.getByRole("button", { name: t("common.cancel") }));
    expect(bar(/^Review/)).toHaveFocus();
    fireEvent.contextMenu(bar(/^Review/), { clientX: 5, clientY: 5 });
    fireEvent.click(menuItem(t("common.rename")));
    expect(screen.getByRole("textbox", { name: "Name of Review" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    fireEvent.contextMenu(bar(/^Review/), { clientX: 5, clientY: 5 });
    fireEvent.click(menuItem(t("gantt.deleteTask")));
    expect(screen.getByRole("alertdialog", { name: "Delete Review?" })).toBeInTheDocument();
  });

  it("fold, move and rename a group", () => {
    setup();
    fireEvent.contextMenu(group("Design"), { clientX: 5, clientY: 5 });
    expect(menuItem(t("common.moveUp"))).toBeDisabled();
    fireEvent.click(menuItem("Collapse Design"));
    expect(latest.chart.groups[0]!.collapsed).toBe(true);
    expect(group("Design")).toHaveFocus();
    fireEvent.contextMenu(group("Design"), { clientX: 5, clientY: 5 });
    fireEvent.click(menuItem(t("common.moveDown")));
    expect(latest.chart.groups.map((one) => one.id)).toEqual(["build", "design", "launch"]);
    fireEvent.contextMenu(group("Design"), { clientX: 5, clientY: 5 });
    fireEvent.click(menuItem(t("common.moveUp")));
    expect(latest.chart.groups[0]!.id).toBe("design");
  });

  it("offer only opening and folding in a read-only chart", () => {
    setup({ readOnly: true, onOpenTask: vi.fn() });
    fireEvent.contextMenu(bar(/^Review/), { clientX: 5, clientY: 5 });
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([t("gantt.open")]);
    fireEvent.keyDown(menuItem(t("gantt.open")), { key: "Escape" });
    act(() => group("Build").focus());
    press(group("Build"), "F10", { shiftKey: true });
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Collapse Build"]);
  });
});

describe("opening a task", () => {
  it("asks the host with Enter, a double click or the menu when it opens tasks itself", () => {
    const onOpenTask = vi.fn();
    setup({ onOpenTask });
    act(() => bar(/^Paint/).focus());
    press(bar(/^Paint/), "Enter");
    fireEvent.doubleClick(bar(/^Frame/));
    fireEvent.contextMenu(bar(/^Brief/), { clientX: 5, clientY: 5 });
    fireEvent.click(menuItem(t("gantt.open")));
    expect(onOpenTask.mock.calls).toEqual([["paint"], ["frame"], ["brief"]]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the built-in dialog otherwise, which saves every field", () => {
    setup();
    act(() => bar(/^Paint/).focus());
    press(bar(/^Paint/), "Enter");
    const dialog = screen.getByRole("dialog", { name: "Task: Paint" });
    const field = (name: string) => within(dialog).getByLabelText(name);
    fireEvent.change(field(t("gantt.fieldName")), { target: { value: "Varnish" } });
    fireEvent.change(field(t("gantt.fieldStart")), { target: { value: "2026-11-17" } });
    fireEvent.change(field(t("gantt.fieldEnd")), { target: { value: "2026-11-19" } });
    fireEvent.change(field(t("gantt.fieldProgress")), { target: { value: "25" } });
    fireEvent.change(field(t("gantt.fieldColour")), { target: { value: "4" } });
    fireEvent.change(field(t("gantt.fieldGroup")), { target: { value: "launch" } });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /^Frame/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: t("common.save") }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(taskOf("paint")).toEqual({
      id: "paint",
      name: "Varnish",
      groupId: "launch",
      start: "2026-11-17",
      end: "2026-11-19",
      milestone: false,
      progress: 25,
      colour: 4,
      dependsOn: ["frame"],
    });
    expect(bar(/^Varnish/)).toHaveFocus();
  });

  it("makes a milestone of a task, and leaves out the tasks that would make a cycle", () => {
    setup({}, { ...PLAN, groups: PLAN.groups.map((one) => ({ ...one, collapsed: one.id === "launch" })) });
    fireEvent.doubleClick(bar(/^Sketch/));
    const dialog = screen.getByRole("dialog", { name: "Task: Sketch" });
    // The release depends on Frame, which depends on Sketch.
    expect(within(dialog).getByRole("checkbox", { name: /^Release \(depends on this task\)/ })).toBeDisabled();
    expect(within(dialog).getByRole("checkbox", { name: /^Brief/ })).toBeEnabled();
    fireEvent.click(within(dialog).getByRole("checkbox", { name: t("gantt.fieldMilestone") }));
    expect(within(dialog).getByLabelText(t("gantt.fieldEnd"))).toBeDisabled();
    fireEvent.submit(dialog);
    expect(taskOf("sketch")).toMatchObject({ milestone: true, start: "2026-11-04", end: "2026-11-04" });
  });

  it("says why a task cannot be saved, and Cancel changes nothing", () => {
    setup();
    fireEvent.doubleClick(bar(/^Brief/));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(t("gantt.fieldEnd")), { target: { value: "2026-11-01" } });
    fireEvent.submit(dialog);
    expect(within(dialog).getByRole("alert")).toHaveTextContent(t("gantt.problem.order"));
    fireEvent.change(within(dialog).getByLabelText(t("gantt.fieldProgress")), { target: { value: "half" } });
    fireEvent.change(within(dialog).getByLabelText(t("gantt.fieldEnd")), { target: { value: "2026-11-04" } });
    fireEvent.submit(dialog);
    expect(within(dialog).getByRole("alert")).toHaveTextContent(t("gantt.problem.invalid"));
    fireEvent.click(within(dialog).getByRole("button", { name: t("common.cancel") }));
    expect(taskOf("brief").end).toBe("2026-11-03");
    expect(bar(/^Brief/)).toHaveFocus();
  });

  it("says when there are no other tasks to depend on", () => {
    setup({}, { groups: [], tasks: [PLAN.tasks[0]!] });
    fireEvent.doubleClick(bar(/^Brief/));
    expect(screen.getByText(t("gantt.noOtherTasks"))).toBeInTheDocument();
  });
});
