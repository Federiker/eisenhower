import {
  addCategory,
  deleteCategory,
  entriesInCategory,
  freeName,
  moveCategory,
  newId,
  TIMELINE_LINES,
  type TimelineCategory,
  type TimelineLine,
  updateCategory,
} from "@eisenhower/model";
import { useRef, useState } from "react";

import { Button } from "../controls/Button";
import { EditableText } from "../controls/EditableText";
import { InlineQuestion } from "../controls/InlineQuestion";
import { Notice } from "../controls/Notice";
import { ReorderList } from "../controls/ReorderList";
import { PALETTE } from "../theme/palette";
import { useTimelineView } from "./context";
import { CategorySwatch, editIcon, LINE_LABELS, PROBLEM_LABELS } from "./labels";

/**
 * The categories of a timeline (its lanes, in order; jerome's): the name, colour and line read as text, each
 * with a pencil. New category adds one named "New category" (numbered when the name is taken) with the next
 * free colour and line, open for its name; Escape keeps that name. Reordered by dragging, with Alt+Up and
 * Alt+Down, or from a category's menu (right-click or the Menu key), which also deletes it, as the Delete key
 * does. Deleting a category with entries asks whether they move to another category or go with it.
 */
export function TimelineCategoriesList() {
  const view = useTimelineView();
  const { timeline, readOnly, words } = view;
  const { t } = words;
  const [deleting, setDeleting] = useState<string | null>(null);
  const [naming, setNaming] = useState<{ id: string; nonce: number } | null>(null);
  // Where the focus goes back to when the question is cancelled: the category's row.
  const returnTo = useRef<HTMLElement | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const { categories } = timeline;

  function remove(category: TimelineCategory) {
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (entriesInCategory(timeline, category.id) > 0) {
      setDeleting(category.id);
      setMoveTo(categories.find((other) => other.id !== category.id)?.id ?? "");
      return;
    }
    view.change((current) => deleteCategory(current, category.id, null));
  }

  function cancelDelete() {
    setDeleting(null);
    returnTo.current?.focus();
  }

  function add() {
    const id = newId();
    const name = freeName(categories, t("timeline.newCategory"));
    if (view.change((current) => addCategory(current, id, name))) setNaming({ id, nonce: Date.now() });
  }

  /** Saves a change to a category; the reason when it is refused. */
  async function update(category: TimelineCategory, next: Partial<TimelineCategory>): Promise<string | null> {
    const checked = updateCategory(timeline, { ...category, ...next });
    if (!checked.ok) return t(PROBLEM_LABELS[checked.reason]);
    view.change((current) => updateCategory(current, { ...category, ...next }));
    return null;
  }

  function move(id: string, to: number) {
    if (!view.change((current) => moveCategory(current, id, to))) return;
    const category = categories.find((each) => each.id === id)!;
    view.announce(t("timeline.movedToPlace", { name: category.name, position: to + 1, count: categories.length }));
  }

  const removeWith = (category: TimelineCategory, target: string | null) => {
    if (view.change((current) => deleteCategory(current, category.id, target))) setDeleting(null);
  };

  const colours = PALETTE.map((colour, value) => ({ value: String(value), label: t(colour.name) }));
  const lines = TIMELINE_LINES.map((line) => ({ value: line, label: t(LINE_LABELS[line]) }));
  const pencil = readOnly ? "hidden" : "visible";

  return (
    <section className="eh-timeline-list" aria-label={t("timeline.categories")}>
      <h3>{t("timeline.categories")}</h3>
      {categories.length === 0 && <Notice>{t("timeline.noCategories")}</Notice>}
      <ReorderList
        label={t("timeline.categories")}
        items={categories}
        idOf={(category) => category.id}
        menuLabel={(category) => t("timeline.categoryMenu", { name: category.name })}
        actions={() => [{ id: "delete", label: t("common.delete") }]}
        disabled={readOnly}
        dragType="application/x-eisenhower-timeline-category"
        onMove={move}
        onAction={(_, category) => remove(category)}
        onDelete={(category) => remove(category)}
      >
        {(category, index) => {
          const count = entriesInCategory(timeline, category.id);
          const others = categories.filter((other) => other.id !== category.id);
          return (
            <>
              <CategorySwatch category={category} />
              <EditableText
                className="eh-timeline-list-name"
                text={category.name}
                label={t("timeline.categoryNameNumbered", { number: index + 1 })}
                editLabel={t("timeline.editCategory", { name: category.name })}
                editIcon={editIcon}
                pencilVisible={pencil}
                editRequest={naming?.id === category.id ? naming.nonce : undefined}
                disabled={readOnly}
                onCommit={(next) => update(category, { name: next })}
              />
              <span className="eh-timeline-list-choice">
                <span aria-hidden="true">{t("timeline.colour")}</span>
                <EditableText
                  text={String(category.colour)}
                  choices={colours}
                  label={t("timeline.colourNamed", { name: category.name })}
                  editLabel={t("timeline.editColour", { name: category.name })}
                  editIcon={editIcon}
                  pencilVisible={pencil}
                  disabled={readOnly}
                  onCommit={(next) => update(category, { colour: Number(next) })}
                />
              </span>
              <span className="eh-timeline-list-choice">
                <span aria-hidden="true">{t("timeline.line")}</span>
                <EditableText
                  text={category.line}
                  choices={lines}
                  label={t("timeline.lineNamed", { name: category.name })}
                  editLabel={t("timeline.editLine", { name: category.name })}
                  editIcon={editIcon}
                  pencilVisible={pencil}
                  disabled={readOnly}
                  onCommit={(next) => update(category, { line: next as TimelineLine })}
                />
              </span>
              {count > 0 && <Notice as="span">{t("timeline.entriesCount", { count })}</Notice>}
              {deleting === category.id && (
                <InlineQuestion
                  label={t("timeline.deleteCategory", { name: category.name })}
                  question={t("timeline.deleteCategoryWarning")}
                  onEscape={cancelDelete}
                  actions={
                    <>
                      <Button autoFocus={others.length === 0} onClick={() => removeWith(category, null)}>
                        {t("timeline.deleteWithEntries")}
                      </Button>
                      <Button onClick={cancelDelete}>{t("common.cancel")}</Button>
                    </>
                  }
                >
                  {others.length > 0 && (
                    <div className="eh-timeline-tools">
                      <label>
                        {t("timeline.moveEntriesTo")}
                        <select
                          className="eh-field"
                          // biome-ignore lint/a11y/noAutofocus: the question's first answer takes the focus.
                          autoFocus
                          value={moveTo}
                          onChange={(event) => setMoveTo(event.target.value)}
                        >
                          {others.map((other) => (
                            <option key={other.id} value={other.id}>
                              {other.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button disabled={moveTo === ""} onClick={() => removeWith(category, moveTo)}>
                        {t("timeline.moveAndDelete")}
                      </Button>
                    </div>
                  )}
                </InlineQuestion>
              )}
            </>
          );
        }}
      </ReorderList>
      {categories.length > 0 && !readOnly && <Notice>{t("timeline.categoriesHelp")}</Notice>}
      {!readOnly && (
        <div className="eh-timeline-add">
          <Button onClick={add}>{t("timeline.newCategory")}</Button>
        </div>
      )}
    </section>
  );
}
