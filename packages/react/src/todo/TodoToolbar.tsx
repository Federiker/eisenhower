import { hasTag } from "@eisenhower/model";
import { useId } from "react";

import { Button } from "../controls/Button";
import { Checkbox } from "../controls/Checkbox";
import { useTranslate } from "../strings/translate";

/**
 * The todo list's toolbar: List or Matrix (toggle buttons in a named group), the Hide done switch, and the
 * tag filter (All tags, then a toggle button a tag; an item is shown when it has every tag pressed).
 */
export function TodoToolbar({
  matrix,
  onLayout,
  hideDone,
  onHideDone,
  tags,
  tagFilter,
  onTagFilter,
}: {
  matrix: boolean;
  onLayout: (matrix: boolean) => void;
  hideDone: boolean;
  onHideDone: (hide: boolean) => void;
  /** The tags to filter by: every tag of the list, and any of the filter's that no item has any more. */
  tags: readonly string[];
  tagFilter: readonly string[];
  onTagFilter: (tags: string[]) => void;
}) {
  const t = useTranslate();
  const hideId = useId();
  const chosen = (tag: string) => tagFilter.some((one) => hasTag({ tags: [one] }, tag));
  return (
    <div className="eh-todo-toolbar">
      <fieldset className="eh-group eh-todo-layouts">
        <legend className="eh-visually-hidden">{t("todo.layout")}</legend>
        <Button pressed={!matrix} onClick={() => onLayout(false)}>
          {t("todo.layoutList")}
        </Button>
        <Button pressed={matrix} onClick={() => onLayout(true)}>
          {t("todo.layoutMatrix")}
        </Button>
      </fieldset>
      <span className="eh-todo-switch">
        <Checkbox id={hideId} role="switch" checked={hideDone} onChange={(event) => onHideDone(event.target.checked)} />
        <label htmlFor={hideId}>{t("todo.hideDone")}</label>
      </span>
      {tags.length > 0 && (
        <fieldset className="eh-group eh-todo-filter">
          <legend className="eh-visually-hidden">{t("todo.filter")}</legend>
          <Button pressed={tagFilter.length === 0} onClick={() => onTagFilter([])}>
            {t("todo.filterClear")}
          </Button>
          {tags.map((tag) => (
            <Button
              key={tag}
              pressed={chosen(tag)}
              onClick={() =>
                onTagFilter(
                  chosen(tag) ? tagFilter.filter((one) => !hasTag({ tags: [one] }, tag)) : [...tagFilter, tag],
                )
              }
            >
              {tag}
            </Button>
          ))}
        </fieldset>
      )}
    </div>
  );
}
