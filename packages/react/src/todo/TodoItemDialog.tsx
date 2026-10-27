import {
  characterCount,
  type EditResult,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  MAX_TODO_NOTES_LENGTH,
  MAX_TODO_TITLE_LENGTH,
  type Problem,
  quadrantOf,
  renameItem,
  setItemDue,
  setItemNotes,
  setItemQuadrant,
  setItemTags,
  type TodoItem,
  type TodoList as TodoData,
} from "@eisenhower/model";
import { useId, useState } from "react";

import { Checkbox } from "../controls/Checkbox";
import { TextArea } from "../controls/TextArea";
import { TextField } from "../controls/TextField";
import { TreeDialog } from "../controls/TreeDialog";
import { type Translate, useTranslate } from "../strings/translate";

type Field = "title" | "due" | "notes" | "tags";

type Draft = { title: string; due: string; notes: string; tags: string; urgent: boolean; important: boolean };

/** The words for a refused field. */
function problemText(t: Translate, field: Field, problem: Problem): string {
  if (problem === "blank") return t("todo.problem.blank");
  if (field === "title" && problem === "tooLong") return t("todo.problem.titleTooLong", { max: MAX_TODO_TITLE_LENGTH });
  if (field === "notes" && problem === "tooLong") return t("todo.problem.notesTooLong", { max: MAX_TODO_NOTES_LENGTH });
  if (field === "tags" && problem === "tooLong") return t("todo.problem.tagTooLong", { max: MAX_TAG_LENGTH });
  if (field === "tags" && problem === "limit") return t("todo.problem.tagLimit", { max: MAX_TAGS });
  if (field === "due") return t("todo.problem.due");
  return t("todo.problem.other");
}

/**
 * An item's details in a small modal dialog: its title, due date, notes (with how many characters are left
 * of the 250), tags (separated by commas) and its urgent and important flags. Save checks every field with
 * the model's edits, saying under each field why it cannot be saved, and otherwise saves them all at once;
 * Cancel or Escape closes without saving.
 */
export function TodoItemDialog({
  list,
  item,
  onSave,
  onClose,
}: {
  list: TodoData;
  item: TodoItem;
  /** Saves the list with the item changed, and closes. */
  onSave: (next: TodoData) => void;
  onClose: () => void;
}) {
  const t = useTranslate();
  const id = useId();
  const [draft, setDraft] = useState<Draft>({
    title: item.title,
    due: item.due ?? "",
    notes: item.notes,
    tags: item.tags.join(", "),
    urgent: item.urgent,
    important: item.important,
  });
  const [problems, setProblems] = useState<Partial<Record<Field, string>>>({});
  const edit = (change: Partial<Draft>) => setDraft((old) => ({ ...old, ...change }));

  function save() {
    const steps: [Field | null, (list: TodoData) => EditResult<TodoData>][] = [
      ["title", (current) => renameItem(current, item.id, draft.title)],
      ["due", (current) => setItemDue(current, item.id, draft.due === "" ? null : draft.due)],
      ["notes", (current) => setItemNotes(current, item.id, draft.notes)],
      ["tags", (current) => setItemTags(current, item.id, draft.tags.split(","))],
      [null, (current) => setItemQuadrant(current, item.id, quadrantOf(draft))],
    ];
    let next = list;
    const found: Partial<Record<Field, string>> = {};
    for (const [field, step] of steps) {
      const result = step(next);
      if (result.ok) next = result.value;
      else if (field) found[field] = problemText(t, field, result.reason);
    }
    setProblems(found);
    if (Object.keys(found).length === 0) onSave(next);
  }

  const described = (field: Field, extra?: string) =>
    [problems[field] ? `${id}-${field}-problem` : null, extra].filter(Boolean).join(" ") || undefined;
  const problem = (field: Field) =>
    problems[field] && (
      <p id={`${id}-${field}-problem`} className="eh-problem">
        {problems[field]}
      </p>
    );
  const title = t("todo.detailsNamed", { title: item.title });

  return (
    <TreeDialog label={title} className="eh-todo-dialog" onCancel={onClose} onSubmit={save}>
      <h3>{title}</h3>
      <div className="eh-todo-field">
        <label htmlFor={`${id}-title`}>{t("todo.title")}</label>
        <TextField
          id={`${id}-title`}
          value={draft.title}
          aria-invalid={problems.title ? true : undefined}
          aria-describedby={described("title")}
          onChange={(event) => edit({ title: event.target.value })}
        />
      </div>
      {problem("title")}
      <div className="eh-todo-field">
        <label htmlFor={`${id}-due`}>{t("todo.dueDay")}</label>
        <TextField
          id={`${id}-due`}
          type="date"
          value={draft.due}
          aria-invalid={problems.due ? true : undefined}
          aria-describedby={described("due")}
          onChange={(event) => edit({ due: event.target.value })}
        />
      </div>
      {problem("due")}
      <div className="eh-todo-field">
        <label htmlFor={`${id}-notes`}>{t("todo.notes")}</label>
        <TextArea
          id={`${id}-notes`}
          rows={4}
          value={draft.notes}
          aria-invalid={problems.notes ? true : undefined}
          aria-describedby={described("notes", `${id}-notes-count`)}
          onChange={(event) => edit({ notes: event.target.value })}
        />
      </div>
      <p id={`${id}-notes-count`} className="eh-note">
        {t("todo.notesCount", { count: characterCount(draft.notes.trim()), max: MAX_TODO_NOTES_LENGTH })}
      </p>
      {problem("notes")}
      <div className="eh-todo-field">
        <label htmlFor={`${id}-tags`}>{t("todo.tags")}</label>
        <TextField
          id={`${id}-tags`}
          value={draft.tags}
          aria-invalid={problems.tags ? true : undefined}
          aria-describedby={described("tags", `${id}-tags-hint`)}
          onChange={(event) => edit({ tags: event.target.value })}
        />
      </div>
      <p id={`${id}-tags-hint`} className="eh-note">
        {t("todo.tagsHint")}
      </p>
      {problem("tags")}
      <div className="eh-todo-flags">
        <span>
          <Checkbox
            id={`${id}-urgent`}
            checked={draft.urgent}
            onChange={(event) => edit({ urgent: event.target.checked })}
          />
          <label htmlFor={`${id}-urgent`}>{t("todo.urgent")}</label>
        </span>
        <span>
          <Checkbox
            id={`${id}-important`}
            checked={draft.important}
            onChange={(event) => edit({ important: event.target.checked })}
          />
          <label htmlFor={`${id}-important`}>{t("todo.important")}</label>
        </span>
      </div>
      <div className="eh-dialog-actions">
        <button type="submit">{t("common.save")}</button>
        <button type="button" onClick={onClose}>
          {t("common.cancel")}
        </button>
      </div>
    </TreeDialog>
  );
}
