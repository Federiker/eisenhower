import type { Colour, GanttGroup } from "@eisenhower/model";
import { useId, useState } from "react";

import { ColourPicker } from "../controls/ColourPicker";
import { TreeDialog } from "../controls/TreeDialog";
import { useTranslate } from "../strings/translate";

/**
 * Colour…: a group's colour, chosen with the colour picker (None included). Save gives it to the group (its
 * summary bar and the tasks made in it from then on); Cancel or Escape changes nothing. The focus starts on the
 * picker and returns through `onClose` or the caller.
 */
export function GroupColourDialog({
  group,
  onSave,
  onClose,
}: {
  group: GanttGroup;
  onSave: (colour: Colour) => void;
  onClose: () => void;
}) {
  const t = useTranslate();
  const id = useId();
  const [colour, setColour] = useState<Colour>(group.colour ?? null);
  const title = t("gantt.groupColourTitle", { name: group.name });

  return (
    <TreeDialog label={title} onCancel={onClose} onSubmit={() => onSave(colour)}>
      <h3>{title}</h3>
      <div className="eh-gantt-field">
        <label htmlFor={`${id}-colour`}>{t("gantt.fieldColour")}</label>
        <ColourPicker id={`${id}-colour`} value={colour} allowNone onChange={setColour} />
      </div>
      <p className="eh-gantt-group-colour-note">{t("gantt.groupColourNote")}</p>
      <div className="eh-dialog-actions">
        <button type="submit">{t("common.save")}</button>
        <button type="button" onClick={onClose}>
          {t("common.cancel")}
        </button>
      </div>
    </TreeDialog>
  );
}
