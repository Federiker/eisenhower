import { useId, useState } from "react";

import { Button } from "../controls/Button";
import { TextField } from "../controls/TextField";
import { useTranslate } from "../strings/translate";

/**
 * The field a new item is typed in: Enter or Add adds it (the caller says why it cannot, shown under the
 * field), then the field empties and keeps the focus for the next one.
 */
export function QuickAdd({
  label,
  place,
  onAdd,
}: {
  /** The field's name ("New item", "New item in Do"), also its placeholder. */
  label: string;
  /** Marks the field, so the focus can be sent back to it (`data-quick-add`). */
  place: string;
  /** Adds an item with this title: null when it was added, otherwise why not. */
  onAdd: (title: string) => string | null;
}) {
  const t = useTranslate();
  const problemId = useId();
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <form
      className="eh-todo-add"
      onSubmit={(event) => {
        event.preventDefault();
        const refused = onAdd(title);
        setProblem(refused);
        if (refused === null) setTitle("");
      }}
    >
      <TextField
        data-quick-add={place}
        aria-label={label}
        placeholder={label}
        value={title}
        aria-invalid={problem !== null || undefined}
        aria-describedby={problem !== null ? problemId : undefined}
        onChange={(event) => {
          setTitle(event.target.value);
          setProblem(null);
        }}
      />
      <Button type="submit">{t("todo.add")}</Button>
      {problem !== null && (
        <p id={problemId} role="alert" className="eh-problem">
          {problem}
        </p>
      )}
    </form>
  );
}
