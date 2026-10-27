import { canDependOn, type Gantt, type GanttProblem, type GanttTask, putGanttTask } from "@eisenhower/model";
import { useId, useState } from "react";

import { Checkbox } from "../controls/Checkbox";
import { Notice } from "../controls/Notice";
import { Select } from "../controls/Select";
import { TextField } from "../controls/TextField";
import { TreeDialog } from "../controls/TreeDialog";
import { useLocale, useTranslate } from "../strings/translate";
import { PALETTE } from "../theme/palette";
import { formatSpan } from "./format";

/**
 * The built-in task dialog (when the host does not open tasks itself): the name, the first and last day, the
 * milestone switch (which gives the task one day), the percentage done, the colour, the group and the tasks it
 * depends on; those that depend on it, through others too, cannot be chosen. Save stores it all at once
 * through the model, showing why when it is refused; Cancel or Escape changes nothing.
 */
export function TaskDialog({
  gantt,
  task,
  onSave,
  onClose,
}: {
  gantt: Gantt;
  task: GanttTask;
  onSave: (next: Gantt, task: GanttTask) => void;
  onClose: () => void;
}) {
  const t = useTranslate();
  const locale = useLocale();
  const [name, setName] = useState(task.name);
  const [start, setStart] = useState(task.start);
  const [end, setEnd] = useState(task.end);
  const [milestone, setMilestone] = useState(task.milestone);
  const [progress, setProgress] = useState(String(task.progress));
  const [colour, setColour] = useState(task.colour === null ? "" : String(task.colour));
  const [groupId, setGroupId] = useState(task.groupId ?? "");
  const [dependsOn, setDependsOn] = useState<readonly string[]>(task.dependsOn);
  const [problem, setProblem] = useState<GanttProblem | null>(null);
  const others = gantt.tasks.filter((other) => other.id !== task.id);
  const id = useId();

  function save() {
    const percentage = /^\d+$/.test(progress.trim()) ? Number(progress.trim()) : Number.NaN;
    const next: GanttTask = {
      ...task,
      name,
      start,
      end: milestone ? start : end,
      milestone,
      progress: percentage,
      colour: colour === "" ? null : Number(colour),
      groupId: groupId === "" ? null : groupId,
      dependsOn: [...dependsOn],
    };
    const result = putGanttTask(gantt, next);
    if (!result.ok) {
      setProblem(result.reason);
      return;
    }
    onSave(result.value, next);
  }

  return (
    <TreeDialog
      label={t("gantt.dialog", { name: task.name })}
      className="eh-gantt-dialog"
      onCancel={onClose}
      onSubmit={save}
    >
      <h3>{t("gantt.dialog", { name: task.name })}</h3>
      <div className="eh-gantt-field">
        <label htmlFor={`${id}-name`}>{t("gantt.fieldName")}</label>
        <TextField id={`${id}-name`} value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="eh-gantt-field-pair">
        <div className="eh-gantt-field">
          <label htmlFor={`${id}-start`}>{t("gantt.fieldStart")}</label>
          <TextField
            id={`${id}-start`}
            type="date"
            required
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </div>
        <div className="eh-gantt-field">
          <label htmlFor={`${id}-end`}>{t("gantt.fieldEnd")}</label>
          <TextField
            id={`${id}-end`}
            type="date"
            required
            disabled={milestone}
            value={milestone ? start : end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </div>
      </div>
      <div className="eh-gantt-check">
        <Checkbox id={`${id}-milestone`} checked={milestone} onChange={(event) => setMilestone(event.target.checked)} />
        <label htmlFor={`${id}-milestone`}>{t("gantt.fieldMilestone")}</label>
      </div>
      <div className="eh-gantt-field-pair">
        <div className="eh-gantt-field">
          <label htmlFor={`${id}-progress`}>{t("gantt.fieldProgress")}</label>
          <TextField
            id={`${id}-progress`}
            type="number"
            min={0}
            max={100}
            step={1}
            value={progress}
            onChange={(event) => setProgress(event.target.value)}
          />
        </div>
        <div className="eh-gantt-field">
          <label htmlFor={`${id}-colour`}>{t("gantt.fieldColour")}</label>
          <Select id={`${id}-colour`} value={colour} onChange={(event) => setColour(event.target.value)}>
            <option value="">{t("gantt.noColour")}</option>
            {PALETTE.map((one, index) => (
              <option key={one.name} value={String(index)}>
                {t(one.name)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="eh-gantt-field">
        <label htmlFor={`${id}-group`}>{t("gantt.fieldGroup")}</label>
        <Select id={`${id}-group`} value={groupId} onChange={(event) => setGroupId(event.target.value)}>
          <option value="">{t("gantt.noGroup")}</option>
          {gantt.groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Select>
      </div>
      <fieldset className="eh-group eh-gantt-dependencies">
        <legend>{t("gantt.fieldDependsOn")}</legend>
        {others.length === 0 ? (
          <Notice>{t("gantt.noOtherTasks")}</Notice>
        ) : (
          <div className="eh-dialog-list">
            {others.map((other, index) => {
              const checked = dependsOn.includes(other.id);
              const allowed = checked || canDependOn(gantt, task.id, other.id);
              return (
                <label key={other.id} htmlFor={`${id}-depends-${index}`}>
                  <Checkbox
                    id={`${id}-depends-${index}`}
                    checked={checked}
                    disabled={!allowed}
                    onChange={(event) =>
                      setDependsOn(
                        event.target.checked ? [...dependsOn, other.id] : dependsOn.filter((one) => one !== other.id),
                      )
                    }
                  />
                  {allowed ? other.name : t("gantt.wouldCycle", { name: other.name })}
                  <span className="eh-gantt-dependency-days">{formatSpan(other.start, other.end, t, locale)}</span>
                </label>
              );
            })}
          </div>
        )}
      </fieldset>
      {problem && <Notice tone="problem">{t(`gantt.problem.${problem}`)}</Notice>}
      <div className="eh-dialog-actions">
        <button type="submit">{t("common.save")}</button>
        <button type="button" onClick={onClose}>
          {t("common.cancel")}
        </button>
      </div>
    </TreeDialog>
  );
}
