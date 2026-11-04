import { canDependOn, type Gantt, type GanttTask, ganttSections, MAX_DEPENDENCIES } from "@eisenhower/model";
import { useEffect, useRef, useState } from "react";

import { TreeDialog } from "../controls/TreeDialog";
import { useTranslate } from "../strings/translate";

/** The tasks a task may come to depend on, in the rows' order: not itself, not one already, none making a cycle. */
function possiblePredecessors(gantt: Gantt, task: GanttTask): GanttTask[] {
  if (task.dependsOn.length >= MAX_DEPENDENCIES) return [];
  return ganttSections(gantt)
    .flatMap((section) => section.tasks)
    .filter((one) => !task.dependsOn.includes(one.id) && canDependOn(gantt, task.id, one.id));
}

/**
 * Depends on…: the keys' way to link a task (Ctrl+drag is the pointer's), a small dialog listing the tasks it
 * may depend on, the first one chosen. Add makes it depend on the chosen one; Cancel or Escape closes without
 * changing anything. The focus starts on the chosen task and returns through `onClose` or the caller.
 */
export function DependsOnDialog({
  gantt,
  task,
  onChoose,
  onClose,
}: {
  gantt: Gantt;
  task: GanttTask;
  onChoose: (predecessorId: string) => void;
  onClose: () => void;
}) {
  const t = useTranslate();
  const [choices] = useState(() => possiblePredecessors(gantt, task));
  const [chosen, setChosen] = useState<string | null>(choices[0]?.id ?? null);
  const list = useRef<HTMLDivElement>(null);
  const title = t("gantt.dependsOnTitle", { name: task.name });

  useEffect(() => {
    list.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
  }, []);

  return (
    <TreeDialog label={title} onCancel={onClose} onSubmit={() => chosen !== null && onChoose(chosen)}>
      <h3>{title}</h3>
      {choices.length === 0 ? (
        <p>{t("gantt.noPredecessors")}</p>
      ) : (
        <div ref={list} className="eh-dialog-list" role="radiogroup" aria-label={title}>
          {choices.map((one) => (
            <label key={one.id}>
              <input type="radio" name="depends-on" checked={chosen === one.id} onChange={() => setChosen(one.id)} />
              {one.name}
            </label>
          ))}
        </div>
      )}
      <div className="eh-dialog-actions">
        <button type="submit" disabled={chosen === null}>
          {t("gantt.dependsOnConfirm")}
        </button>
        <button type="button" onClick={onClose}>
          {t("common.cancel")}
        </button>
      </div>
    </TreeDialog>
  );
}
