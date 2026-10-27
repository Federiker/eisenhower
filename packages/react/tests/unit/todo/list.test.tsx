import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  announced,
  check,
  current,
  dataTransfer,
  find,
  item,
  itemOf,
  LIST,
  menuTexts,
  show,
  t,
  titles,
} from "./fixtures";

const items = () => screen.getByRole("list", { name: t("todo.items") });

describe("the todo list", () => {
  it("lists the items in order, subtasks under their parent, each with its check box", () => {
    show();
    const top = within(items())
      .getAllByRole("listitem")
      .filter((one) => one.parentElement === items());
    expect(top.map((one) => one.dataset.itemId)).toEqual(["a", "b", "c"]);
    const subtasks = screen.getByRole("list", { name: t("todo.subtasksOf", { title: "Paint the shed" }) });
    expect(
      within(subtasks)
        .getAllByRole("checkbox")
        .map((one) => one.getAttribute("aria-label")),
    ).toEqual(["Buy paint", "Sand the walls"]);
    expect(check("Buy paint")).toBeChecked();
    expect(check("Book flights")).not.toBeChecked();
    expect(itemOf("Read a novel")).toHaveAttribute("data-done", "true");
  });

  it("says how many subtasks are done, the due day, overdue in words, the tags and the notes", () => {
    show();
    expect(within(itemOf("Paint the shed")).getByText(t("todo.progress", { done: 1, total: 2 }))).toBeInTheDocument();
    const overdue = within(itemOf("Book flights")).getByText(t("todo.overdue", { date: "2 Nov 2026" }));
    expect(overdue).toHaveAttribute("data-overdue", "true");
    expect(within(itemOf("Book flights")).getByRole("list", { name: t("todo.tags") })).toHaveTextContent("Travel");
    expect(within(itemOf("Read a novel")).getByText("The one on the shelf")).toBeInTheDocument();
    // What the item says is its check box's description.
    expect(check("Book flights")).toHaveAccessibleDescription(/Overdue: due 2 Nov 2026/);
    expect(check("Read a novel")).toHaveAccessibleDescription(/The one on the shelf/);
  });

  it("shows a due day not yet past without the word overdue", () => {
    show({ today: "2026-11-01" });
    expect(within(itemOf("Book flights")).getByText(t("todo.due", { date: "2 Nov 2026" }))).toBeInTheDocument();
  });

  it("ticks and unticks an item in place, struck through", () => {
    show();
    fireEvent.click(check("Book flights"));
    expect(find("b").done).toBe(true);
    expect(itemOf("Book flights")).toHaveAttribute("data-done", "true");
    fireEvent.click(check("Book flights"));
    expect(find("b").done).toBe(false);
  });

  it("hides done items with Hide done, the focus going on when an item ticked is hidden", () => {
    show();
    const hide = screen.getByRole("switch", { name: t("todo.hideDone") });
    expect(hide).not.toBeChecked();
    fireEvent.click(hide);
    expect(screen.queryByRole("checkbox", { name: "Read a novel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Buy paint" })).not.toBeInTheDocument();
    check("Book flights").focus();
    fireEvent.click(check("Book flights"));
    expect(screen.queryByRole("checkbox", { name: "Book flights" })).not.toBeInTheDocument();
    expect(announced()).toBe(t("todo.announce.hidden", { title: "Book flights" }));
    // Nothing after it is shown, so the focus goes to the one before.
    expect(check("Sand the walls")).toHaveFocus();
  });

  it("says when there is nothing, or nothing shown", () => {
    show({ initial: { items: [] } });
    expect(screen.getByText(t("todo.empty"))).toBeInTheDocument();
  });

  it("says when every item is hidden", () => {
    show({ initial: { items: [item("x", "Done already", { done: true })] }, hideDone: true });
    expect(screen.getByText(t("todo.emptyShown"))).toBeInTheDocument();
  });
});

describe("the todo list's keys", () => {
  it("moves the focus with the arrows, Home and End", () => {
    show();
    check("Paint the shed").focus();
    fireEvent.keyDown(check("Paint the shed"), { key: "ArrowDown" });
    expect(check("Buy paint")).toHaveFocus();
    fireEvent.keyDown(check("Buy paint"), { key: "End" });
    expect(check("Read a novel")).toHaveFocus();
    fireEvent.keyDown(check("Read a novel"), { key: "ArrowDown" });
    expect(check("Read a novel")).toHaveFocus();
    fireEvent.keyDown(check("Read a novel"), { key: "Home" });
    expect(check("Paint the shed")).toHaveFocus();
    fireEvent.keyDown(check("Paint the shed"), { key: "ArrowUp" });
    fireEvent.keyDown(check("Paint the shed"), { key: "ArrowLeft" });
    expect(check("Paint the shed")).toHaveFocus();
  });

  it("moves an item up and down among its siblings with Alt, keeping the focus and saying where", () => {
    show();
    check("Book flights").focus();
    fireEvent.keyDown(check("Book flights"), { key: "ArrowUp", altKey: true });
    expect(titles()).toEqual(["Book flights", "Paint the shed", "-Buy paint", "-Sand the walls", "Read a novel"]);
    expect(check("Book flights")).toHaveFocus();
    expect(announced()).toBe(t("todo.announce.moved", { title: "Book flights", position: 1, total: 3 }));
    fireEvent.keyDown(check("Book flights"), { key: "ArrowUp", altKey: true });
    expect(titles()[0]).toBe("Book flights");
    fireEvent.keyDown(check("Sand the walls"), { key: "ArrowUp", altKey: true });
    expect(announced()).toBe(
      t("todo.announce.movedUnder", { title: "Sand the walls", parent: "Paint the shed", position: 1, total: 2 }),
    );
  });

  it("makes an item a subtask of the one above with Alt+→, and a top-level item with Alt+←", () => {
    show();
    fireEvent.keyDown(check("Read a novel"), { key: "ArrowRight", altKey: true });
    expect(titles()).toEqual(["Paint the shed", "-Buy paint", "-Sand the walls", "Book flights", "-Read a novel"]);
    expect(
      within(screen.getByRole("list", { name: t("todo.subtasksOf", { title: "Book flights" }) })).getByRole(
        "checkbox",
        { name: "Read a novel" },
      ),
    ).toHaveFocus();
    fireEvent.keyDown(check("Read a novel"), { key: "ArrowLeft", altKey: true });
    expect(titles()).toEqual(["Paint the shed", "-Buy paint", "-Sand the walls", "Book flights", "Read a novel"]);
    expect(announced()).toBe(t("todo.announce.moved", { title: "Read a novel", position: 3, total: 3 }));
    // A parent cannot become a subtask.
    fireEvent.keyDown(check("Paint the shed"), { key: "ArrowRight", altKey: true });
    expect(find("a").parentId).toBeNull();
  });

  it("renames an item with F2, saying why a title cannot be used", async () => {
    show();
    fireEvent.keyDown(check("Book flights"), { key: "F2" });
    const field = await screen.findByRole("textbox", { name: t("todo.title") });
    fireEvent.change(field, { target: { value: "  " } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(await screen.findByRole("alert")).toHaveTextContent(t("todo.problem.blank"));
    fireEvent.change(field, { target: { value: "x".repeat(121) } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/120/));
    fireEvent.change(field, { target: { value: "Book trains" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(find("b").title).toBe("Book trains"));
  });

  it("asks before deleting with Delete, and goes back to the item on Escape or Cancel", () => {
    show();
    fireEvent.keyDown(check("Book flights"), { key: "Delete" });
    const question = screen.getByRole("alertdialog", { name: t("todo.deleteNamed", { title: "Book flights" }) });
    expect(question).toHaveTextContent(t("todo.deleteQuestion"));
    expect(within(question).getByRole("button", { name: t("todo.delete") })).toHaveFocus();
    fireEvent.keyDown(within(question).getByRole("button", { name: t("todo.delete") }), { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(check("Book flights")).toHaveFocus();
    fireEvent.keyDown(check("Book flights"), { key: "Delete" });
    fireEvent.click(screen.getByRole("button", { name: t("common.cancel") }));
    expect(check("Book flights")).toHaveFocus();
    fireEvent.keyDown(check("Book flights"), { key: "Delete" });
    fireEvent.click(screen.getByRole("button", { name: t("todo.delete") }));
    expect(titles()).toEqual(["Paint the shed", "-Buy paint", "-Sand the walls", "Read a novel"]);
    expect(check("Read a novel")).toHaveFocus();
    expect(announced()).toBe(t("todo.announce.deleted", { title: "Book flights" }));
  });

  it("asks whether a parent's subtasks go too", () => {
    show();
    fireEvent.keyDown(check("Paint the shed"), { key: "Delete" });
    expect(screen.getByRole("alertdialog")).toHaveTextContent(t("todo.deleteParentQuestion", { count: 2 }));
    fireEvent.click(screen.getByRole("button", { name: t("todo.keepSubtasks") }));
    expect(titles()).toEqual(["Buy paint", "Sand the walls", "Book flights", "Read a novel"]);
    expect(check("Buy paint")).toHaveFocus();
    fireEvent.keyDown(check("Sand the walls"), { key: "ArrowRight", altKey: true });
    fireEvent.keyDown(check("Buy paint"), { key: "Delete" });
    expect(screen.getByRole("alertdialog")).toHaveTextContent(t("todo.deleteParentQuestion", { count: 1 }));
    fireEvent.click(screen.getByRole("button", { name: t("todo.deleteWithSubtasks") }));
    expect(titles()).toEqual(["Book flights", "Read a novel"]);
    expect(check("Book flights")).toHaveFocus();
  });

  it("gives the focus to the field that adds items when the last one shown is deleted", () => {
    show({ initial: { items: [item("x", "Only one")] } });
    fireEvent.keyDown(check("Only one"), { key: "Delete" });
    fireEvent.click(screen.getByRole("button", { name: t("todo.delete") }));
    expect(screen.getByRole("textbox", { name: t("todo.newItem") })).toHaveFocus();
  });
});

describe("the todo list's menu", () => {
  it("opens with the Menu key, offering the item's actions, and gives the focus back", () => {
    show();
    fireEvent.keyDown(check("Paint the shed"), { key: "ContextMenu" });
    const menu = screen.getByRole("menu", { name: t("todo.menuNamed", { title: "Paint the shed" }) });
    expect(menuTexts(menu)).toEqual([
      t("todo.details"),
      t("todo.rename"),
      t("todo.addSubtask"),
      t("common.moveUp"),
      t("common.moveDown"),
      t("todo.indent"),
      t("todo.moveToQuadrant", { quadrant: t("todo.quadrant.do") }),
      t("todo.moveToQuadrant", { quadrant: t("todo.quadrant.delegate") }),
      t("todo.moveToQuadrant", { quadrant: t("todo.quadrant.drop") }),
      t("todo.delete"),
    ]);
    expect(within(menu).getByRole("menuitem", { name: t("common.moveUp") })).toBeDisabled();
    expect(within(menu).getByRole("menuitem", { name: t("todo.indent") })).toBeDisabled();
    fireEvent.keyDown(within(menu).getByRole("menuitem", { name: t("todo.details") }), { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(check("Paint the shed")).toHaveFocus();
  });

  it("moves, indents, outdents and changes the quadrant from the menu", () => {
    show();
    const choose = (title: string, action: string) => {
      fireEvent.click(screen.getByRole("button", { name: t("todo.actionsNamed", { title }) }));
      fireEvent.click(screen.getByRole("menuitem", { name: action }));
    };
    choose("Book flights", t("common.moveDown"));
    expect(titles().at(-1)).toBe("Book flights");
    choose("Book flights", t("common.moveUp"));
    choose("Read a novel", t("todo.indent"));
    expect(find("c").parentId).toBe("b");
    choose("Read a novel", t("todo.outdent"));
    expect(find("c").parentId).toBeNull();
    choose("Read a novel", t("todo.moveToQuadrant", { quadrant: t("todo.quadrant.do") }));
    expect(find("c")).toMatchObject({ urgent: true, important: true });
    expect(announced()).toBe(t("todo.announce.quadrant", { title: "Read a novel", quadrant: t("todo.quadrant.do") }));
    expect(check("Read a novel")).toHaveFocus();
  });

  it("opens on a right-click, but not in a field", () => {
    show();
    fireEvent.contextMenu(itemOf("Book flights"), { clientX: 5, clientY: 5 });
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: t("todo.rename") }));
    const field = screen.getByRole("textbox", { name: t("todo.title") });
    expect(fireEvent.contextMenu(field)).toBe(true);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("adds a subtask with its name open for editing, and deletes from the menu", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: t("todo.actionsNamed", { title: "Book flights" }) }));
    fireEvent.click(screen.getByRole("menuitem", { name: t("todo.addSubtask") }));
    expect(titles()).toContain(`-${t("todo.newSubtaskName")}`);
    const field = await screen.findByRole("textbox", { name: t("todo.title") });
    expect(field).toHaveValue(t("todo.newSubtaskName"));
    fireEvent.change(field, { target: { value: "Choose seats" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(titles()).toContain("-Choose seats"));
    fireEvent.click(screen.getByRole("button", { name: t("todo.actionsNamed", { title: "Choose seats" }) }));
    fireEvent.click(screen.getByRole("menuitem", { name: t("todo.delete") }));
    fireEvent.click(screen.getByRole("button", { name: t("todo.delete") }));
    expect(titles()).not.toContain("-Choose seats");
  });
});

describe("adding to the todo list", () => {
  it("adds an item at the end with Enter, and keeps the field for the next", () => {
    show();
    const field = screen.getByRole("textbox", { name: t("todo.newItem") });
    fireEvent.change(field, { target: { value: " Water the plants " } });
    fireEvent.submit(field);
    expect(titles().at(-1)).toBe("Water the plants");
    expect(field).toHaveValue("");
    expect(announced()).toBe(t("todo.announce.added", { title: "Water the plants" }));
    fireEvent.submit(field);
    expect(screen.getByRole("alert")).toHaveTextContent(t("todo.problem.blank"));
    expect(field).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(field, { target: { value: "x" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("gives a new item the filter's tags, so that it stays shown", () => {
    show({ tagFilter: ["Weekend"] });
    const field = screen.getByRole("textbox", { name: t("todo.newItem") });
    fireEvent.change(field, { target: { value: "Mow the lawn" } });
    fireEvent.submit(field);
    expect(current.items.at(-1)!.tags).toEqual(["Weekend"]);
    expect(check("Mow the lawn")).toBeInTheDocument();
  });
});

describe("the tag filter", () => {
  it("shows the items with every tag pressed, with the parent of a subtask shown", () => {
    show();
    const filter = screen.getByRole("group", { name: t("todo.filter") });
    expect(
      within(filter)
        .getAllByRole("button")
        .map((one) => one.textContent),
    ).toEqual([t("todo.filterClear"), "Home", "Leisure", "Travel", "Weekend"]);
    fireEvent.click(within(filter).getByRole("button", { name: "Weekend" }));
    expect(within(filter).getByRole("button", { name: "Weekend" })).toHaveAttribute("aria-pressed", "true");
    expect(
      within(items())
        .getAllByRole("checkbox")
        .map((one) => one.getAttribute("aria-label")),
    ).toEqual(["Paint the shed", "Sand the walls", "Read a novel"]);
    fireEvent.click(within(filter).getByRole("button", { name: "Leisure" }));
    expect(within(items()).getAllByRole("checkbox")).toHaveLength(1);
    fireEvent.click(within(filter).getByRole("button", { name: "Leisure" }));
    expect(within(items()).getAllByRole("checkbox")).toHaveLength(3);
    fireEvent.click(within(filter).getByRole("button", { name: t("todo.filterClear") }));
    expect(within(items()).getAllByRole("checkbox")).toHaveLength(5);
  });

  it("follows the host's filter, keeping a tag no item has any more", () => {
    const changes: string[][] = [];
    show({ tagFilter: ["Gone"], onTagFilterChange: (tags) => changes.push(tags) });
    const filter = screen.getByRole("group", { name: t("todo.filter") });
    expect(within(filter).getByRole("button", { name: "Gone" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(t("todo.emptyShown"))).toBeInTheDocument();
    fireEvent.click(within(filter).getByRole("button", { name: "Gone" }));
    expect(changes).toEqual([[]]);
    // The host did not change it: the filter stays.
    expect(within(filter).getByRole("button", { name: "Gone" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("dragging in the todo list", () => {
  it("puts an item dropped on another just before it, among its siblings", () => {
    show();
    const data = dataTransfer();
    fireEvent.dragStart(itemOf("Read a novel"), { dataTransfer: data });
    fireEvent.dragOver(itemOf("Sand the walls"), { dataTransfer: data });
    expect(itemOf("Sand the walls")).toHaveAttribute("data-drop", "before");
    fireEvent.dragLeave(itemOf("Sand the walls"), { dataTransfer: data });
    expect(itemOf("Sand the walls")).not.toHaveAttribute("data-drop");
    fireEvent.dragOver(itemOf("Sand the walls"), { dataTransfer: data });
    fireEvent.drop(itemOf("Sand the walls"), { dataTransfer: data });
    expect(titles()).toEqual(["Paint the shed", "-Buy paint", "-Read a novel", "-Sand the walls", "Book flights"]);
    expect(announced()).toBe(
      t("todo.announce.movedUnder", { title: "Read a novel", parent: "Paint the shed", position: 2, total: 3 }),
    );
  });

  it("puts an item dropped after the items at the end", () => {
    show();
    const data = dataTransfer();
    const body = items().parentElement!;
    fireEvent.dragStart(itemOf("Buy paint"), { dataTransfer: data });
    fireEvent.dragOver(body, { dataTransfer: data });
    expect(body).toHaveAttribute("data-drop", "inside");
    fireEvent.drop(body, { dataTransfer: data });
    expect(titles()).toEqual(["Paint the shed", "-Sand the walls", "Book flights", "Read a novel", "Buy paint"]);
  });

  it("moves nothing dropped on itself, refused, or after the drag ended", () => {
    show();
    const data = dataTransfer();
    fireEvent.dragStart(itemOf("Book flights"), { dataTransfer: data });
    fireEvent.drop(itemOf("Book flights"), { dataTransfer: data });
    // A parent dropped among subtasks would make subtasks of subtasks.
    fireEvent.dragStart(itemOf("Paint the shed"), { dataTransfer: data });
    fireEvent.drop(itemOf("Buy paint"), { dataTransfer: data });
    fireEvent.dragStart(itemOf("Book flights"), { dataTransfer: data });
    fireEvent.dragEnd(itemOf("Book flights"), { dataTransfer: data });
    fireEvent.dragOver(itemOf("Paint the shed"), { dataTransfer: data });
    fireEvent.drop(itemOf("Paint the shed"), { dataTransfer: data });
    fireEvent.drop(items().parentElement!, { dataTransfer: data });
    expect(current).toBe(LIST);
  });
});

describe("a read-only todo list", () => {
  it("shows the items, moves the focus, and changes nothing", () => {
    show({ readOnly: true });
    expect(screen.queryByRole("textbox", { name: t("todo.newItem") })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("todo.actionsNamed", { title: "Book flights" }) })).toBeNull();
    expect(check("Book flights")).toHaveAttribute("aria-readonly", "true");
    expect(itemOf("Book flights")).toHaveAttribute("draggable", "false");
    fireEvent.click(check("Book flights"));
    expect(check("Book flights")).not.toBeChecked();
    for (const key of ["Delete", "F2", "Enter", "ContextMenu"]) fireEvent.keyDown(check("Book flights"), { key });
    fireEvent.keyDown(check("Book flights"), { key: "ArrowUp", altKey: true });
    fireEvent.contextMenu(itemOf("Book flights"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.keyDown(check("Book flights"), { key: "ArrowDown" });
    expect(check("Read a novel")).toHaveFocus();
    expect(current).toBe(LIST);
  });
});

describe("the todo list's settings", () => {
  it("takes the host's strings and locale", () => {
    show({ strings: { "todo.hideDone": "Hide ticked" }, locale: "en-US" });
    expect(screen.getByRole("switch", { name: "Hide ticked" })).toBeInTheDocument();
    expect(within(itemOf("Book flights")).getByText(/Nov 2, 2026/)).toBeInTheDocument();
  });

  it("follows the host's layout and Hide done, telling it of changes", async () => {
    const layouts: string[] = [];
    const hides: boolean[] = [];
    show({
      layout: "list",
      onLayoutChange: (one) => layouts.push(one),
      hideDone: false,
      onHideDoneChange: (one) => hides.push(one),
    });
    fireEvent.click(screen.getByRole("button", { name: t("todo.layoutMatrix") }));
    fireEvent.click(screen.getByRole("switch", { name: t("todo.hideDone") }));
    expect(layouts).toEqual(["matrix"]);
    expect(hides).toEqual([true]);
    await act(async () => {});
    expect(screen.getByRole("button", { name: t("todo.layoutList") })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("switch", { name: t("todo.hideDone") })).not.toBeChecked();
  });
});
