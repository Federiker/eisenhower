import type { SubtaskDisposal, TodoItem } from "@eisenhower/model";

import { Button } from "../controls/Button";
import { InlineQuestion } from "../controls/InlineQuestion";
import { useTranslate } from "../strings/translate";

/**
 * The question asked under an item before it is deleted (jerome's way): Delete or Cancel; for an item with
 * subtasks, whether they go with it or stay as top-level items. The first answer has the focus; Escape
 * cancels.
 */
export function DeleteQuestion({
  item,
  subtasks,
  onDelete,
  onCancel,
}: {
  item: TodoItem;
  /** How many subtasks the item has. */
  subtasks: number;
  onDelete: (subtasks: SubtaskDisposal) => void;
  onCancel: () => void;
}) {
  const t = useTranslate();
  return (
    <InlineQuestion
      label={t("todo.deleteNamed", { title: item.title })}
      question={subtasks > 0 ? t("todo.deleteParentQuestion", { count: subtasks }) : t("todo.deleteQuestion")}
      onEscape={onCancel}
      actions={
        <>
          <Button autoFocus variant="danger" onClick={() => onDelete("delete")}>
            {t(subtasks > 0 ? "todo.deleteWithSubtasks" : "todo.delete")}
          </Button>
          {subtasks > 0 && <Button onClick={() => onDelete("keep")}>{t("todo.keepSubtasks")}</Button>}
          <Button onClick={onCancel}>{t("common.cancel")}</Button>
        </>
      }
    />
  );
}
