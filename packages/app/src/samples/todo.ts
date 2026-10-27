import { addDays, type CalendarDay, type TodoItem, type TodoList } from "@eisenhower/model";

/**
 * An invented todo list around `today`: home, work and garden tags, subtasks, due days (two of them past, so
 * overdue), one item done, and items in all four quadrants of the matrix.
 */
export function todoSample(today: CalendarDay): TodoList {
  const item = (id: string, title: string, fields: Partial<Omit<TodoItem, "id" | "title">> = {}): TodoItem => ({
    id,
    title,
    done: false,
    due: null,
    notes: "",
    tags: [],
    urgent: false,
    important: false,
    parentId: null,
    ...fields,
  });
  const due = (offset: number) => addDays(today, offset);
  return {
    items: [
      item("i-tax", "Send the tax return", {
        due: due(-2),
        tags: ["Home"],
        urgent: true,
        important: true,
        notes: "The receipts are in the blue folder.",
      }),
      item("i-report", "Quarterly report", { due: due(3), tags: ["Work"], urgent: true, important: true }),
      item("i-figures", "Collect the figures", {
        tags: ["Work"],
        urgent: true,
        important: true,
        parentId: "i-report",
        done: true,
      }),
      item("i-draft", "Write the summary", { tags: ["Work"], urgent: true, important: true, parentId: "i-report" }),
      item("i-course", "Plan a first-aid course", { due: due(30), tags: ["Work"], important: true }),
      item("i-shed", "Paint the shed", { tags: ["Garden", "Home"], important: true }),
      item("i-sand", "Sand the boards", { tags: ["Garden"], important: true, parentId: "i-shed" }),
      item("i-paint", "Buy the paint", { tags: ["Garden"], important: true, parentId: "i-shed", due: due(6) }),
      item("i-parcel", "Return the parcel", { due: due(-1), tags: ["Home"], urgent: true }),
      item("i-room", "Book a meeting room", { due: due(1), tags: ["Work"], urgent: true, done: true }),
      item("i-magazines", "Sort the old magazines", { tags: ["Home"] }),
      item("i-seeds", "Look at seed catalogues", { tags: ["Garden"], notes: "Tomatoes that ripen early." }),
    ],
  };
}
