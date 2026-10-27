import {
  addStep,
  deleteStep,
  entriesAtStep,
  freeName,
  moveStep,
  newId,
  renameStep,
  type StepDisposal,
  type TimelineStep,
} from "@eisenhower/model";
import { useRef, useState } from "react";

import { Button } from "../controls/Button";
import { EditableText } from "../controls/EditableText";
import { InlineQuestion } from "../controls/InlineQuestion";
import { Notice } from "../controls/Notice";
import { ReorderList } from "../controls/ReorderList";
import { useTimelineView } from "./context";
import { editIcon, PROBLEM_LABELS } from "./labels";

/**
 * The steps of a Sequence timeline, in order (jerome's), each name read as text with a pencil. New step adds
 * one at the end named "New step" (numbered when the name is taken), open for its name; Escape keeps that
 * name. Steps are reordered by dragging, with Alt+Up and Alt+Down, or from a step's menu (right-click or the
 * Menu key), which also deletes it, as the Delete key does. Deleting a step that has entries asks whether
 * they move to the step before, the step after, or go with it.
 */
export function TimelineStepsList() {
  const view = useTimelineView();
  const { timeline, readOnly, words } = view;
  const { t } = words;
  const [deleting, setDeleting] = useState<string | null>(null);
  const [naming, setNaming] = useState<{ id: string; nonce: number } | null>(null);
  // Where the focus goes back to when the question is cancelled: the step's row.
  const returnTo = useRef<HTMLElement | null>(null);
  const { steps } = timeline;

  function remove(id: string) {
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (entriesAtStep(timeline, id) > 0) setDeleting(id);
    else view.change((current) => deleteStep(current, id, "delete"));
  }

  function cancelDelete() {
    setDeleting(null);
    returnTo.current?.focus();
  }

  function add() {
    const id = newId();
    const name = freeName(steps, t("timeline.newStep"));
    if (view.change((current) => addStep(current, id, name))) setNaming({ id, nonce: Date.now() });
  }

  async function rename(id: string, next: string): Promise<string | null> {
    const checked = renameStep(timeline, id, next);
    if (!checked.ok) return t(PROBLEM_LABELS[checked.reason]);
    view.change((current) => renameStep(current, id, next));
    return null;
  }

  function move(id: string, to: number) {
    if (!view.change((current) => moveStep(current, id, to))) return;
    const step = steps.find((each) => each.id === id)!;
    view.announce(t("timeline.movedToPlace", { name: step.name, position: to + 1, count: steps.length }));
  }

  const removeWith = (step: TimelineStep, disposal: StepDisposal) => {
    if (view.change((current) => deleteStep(current, step.id, disposal))) setDeleting(null);
  };

  return (
    <section className="eh-timeline-list" aria-label={t("timeline.steps")}>
      <h3>{t("timeline.steps")}</h3>
      {steps.length === 0 && <Notice>{t("timeline.noSteps")}</Notice>}
      <ReorderList
        label={t("timeline.steps")}
        items={steps}
        idOf={(step) => step.id}
        menuLabel={(step) => t("timeline.stepMenu", { name: step.name })}
        actions={() => [{ id: "delete", label: t("common.delete") }]}
        disabled={readOnly}
        dragType="application/x-eisenhower-timeline-step"
        onMove={move}
        onAction={(_, step) => remove(step.id)}
        onDelete={(step) => remove(step.id)}
      >
        {(step, index) => {
          const count = entriesAtStep(timeline, step.id);
          return (
            <>
              <span className="eh-timeline-list-number" aria-hidden="true">
                {index + 1}
              </span>
              <EditableText
                className="eh-timeline-list-name"
                text={step.name}
                label={t("timeline.stepName", { number: index + 1 })}
                editLabel={t("timeline.editStep", { name: step.name })}
                editIcon={editIcon}
                pencilVisible={readOnly ? "hidden" : "visible"}
                editRequest={naming?.id === step.id ? naming.nonce : undefined}
                disabled={readOnly}
                onCommit={(next) => rename(step.id, next)}
              />
              {count > 0 && <Notice as="span">{t("timeline.entriesCount", { count })}</Notice>}
              {deleting === step.id && (
                <InlineQuestion
                  label={t("timeline.deleteStep", { name: step.name })}
                  question={t("timeline.deleteStepWarning")}
                  onEscape={cancelDelete}
                  actions={
                    <>
                      {index > 0 && (
                        <Button autoFocus onClick={() => removeWith(step, "before")}>
                          {t("timeline.moveEntriesToNamed", { name: steps[index - 1]!.name })}
                        </Button>
                      )}
                      {index < steps.length - 1 && (
                        <Button autoFocus={index === 0} onClick={() => removeWith(step, "after")}>
                          {t("timeline.moveEntriesToNamed", { name: steps[index + 1]!.name })}
                        </Button>
                      )}
                      <Button autoFocus={steps.length === 1} onClick={() => removeWith(step, "delete")}>
                        {t("timeline.deleteWithEntries")}
                      </Button>
                      <Button onClick={cancelDelete}>{t("common.cancel")}</Button>
                    </>
                  }
                />
              )}
            </>
          );
        }}
      </ReorderList>
      {steps.length > 0 && !readOnly && <Notice>{t("timeline.stepsHelp")}</Notice>}
      {!readOnly && (
        <div className="eh-timeline-add">
          <Button onClick={add}>{t("timeline.newStep")}</Button>
        </div>
      )}
    </section>
  );
}
