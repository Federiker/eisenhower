import type { TodoItem, TodoList as TodoData } from "@eisenhower/model";
import { render, screen, within } from "@testing-library/react";
import { useState } from "react";

import { createTranslate, TodoList, type TodoListProps } from "../../../src";

export const t = createTranslate();

export function item(id: string, title: string, extra: Partial<TodoItem> = {}): TodoItem {
  return {
    id,
    title,
    done: false,
    due: null,
    notes: "",
    tags: [],
    urgent: false,
    important: false,
    parentId: null,
    ...extra,
  };
}

/**
 * "Paint the shed" (important) with two subtasks, "Buy paint" (done) and "Sand the walls" (urgent);
 * "Book flights" (urgent and important, due 2 November, overdue on the 5th, tagged); "Read a novel" (done,
 * tagged, with notes).
 */
export const LIST: TodoData = {
  items: [
    item("a", "Paint the shed", { important: true, tags: ["Home"] }),
    item("a1", "Buy paint", { parentId: "a", done: true, important: true }),
    item("a2", "Sand the walls", { parentId: "a", urgent: true, tags: ["Weekend"] }),
    item("b", "Book flights", { urgent: true, important: true, due: "2026-11-02", tags: ["Travel"] }),
    item("c", "Read a novel", { done: true, tags: ["Leisure", "Weekend"], notes: "The one on the shelf" }),
  ],
};

export const TODAY = "2026-11-05";

/** The list as the host holds it, after the view's changes. */
export let current: TodoData = { items: [] };

/** A host that keeps the list in its state, as an app would. */
function Host({ initial, ...props }: Partial<TodoListProps> & { initial: TodoData }) {
  const [value, setValue] = useState(initial);
  current = value;
  return (
    <TodoList
      value={value}
      onChange={(next) => {
        current = next;
        setValue(next);
      }}
      today={TODAY}
      {...props}
    />
  );
}

export function show(props: Partial<TodoListProps> & { initial?: TodoData } = {}): void {
  current = props.initial ?? LIST;
  render(<Host initial={props.initial ?? LIST} {...props} />);
}

/** The titles in the host's list, a subtask's with a leading "-". */
export const titles = () => current.items.map((one) => (one.parentId === null ? one.title : `-${one.title}`));

export const find = (id: string) => current.items.find((one) => one.id === id)!;

/** An item's check box: its focus point, named by its title. */
export const check = (title: string) => screen.getByRole("checkbox", { name: title });

/** The item (its list item) of a title. */
export const itemOf = (title: string) => check(title).closest("li")!;

export const announced = () => screen.getByRole("status").textContent?.trim();

export const menuTexts = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole("menuitem")
    .map((one) => one.textContent);

/** A drag's data, shared by its events. */
export function dataTransfer() {
  const data = new Map<string, string>();
  return {
    effectAllowed: "",
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? "",
  };
}
