import { useEffect, useRef, useState } from "react";

import { useTranslate } from "../strings/translate";

import { TreeDialog } from "./TreeDialog";

/** A place the item can be moved into (a column, a group, a parent); `id` null is the top level. */
export type MoveTarget = { id: string | null; title: string; depth: number };

/**
 * Move to…: a small dialog listing the places an item can go (the caller's: a board's columns, a parent
 * task's siblings…), indented by depth, with the current place chosen. Move appends the item there; Cancel or
 * Escape closes without moving. The focus starts on the chosen place and returns through `onClose`.
 */
export function MoveToDialog({
  itemTitle,
  targets,
  current,
  onMove,
  onClose,
}: {
  itemTitle: string;
  targets: MoveTarget[];
  current: string | null;
  onMove: (parentId: string | null) => void;
  onClose: () => void;
}) {
  const t = useTranslate();
  const [chosen, setChosen] = useState<string | null>(current);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    list.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
  }, []);

  return (
    <TreeDialog
      label={t("common.moveTitleNamed", { name: itemTitle })}
      onCancel={onClose}
      onSubmit={() => onMove(chosen)}
    >
      <h3>{t("common.moveTitleNamed", { name: itemTitle })}</h3>
      <div ref={list} className="eh-dialog-list" role="radiogroup" aria-label={t("common.moveTitle")}>
        {targets.map((target) => (
          <label key={target.id ?? "root"} style={{ paddingInlineStart: 8 + target.depth * 16 }}>
            <input
              type="radio"
              name="move-target"
              checked={chosen === target.id}
              onChange={() => setChosen(target.id)}
            />
            {target.title}
          </label>
        ))}
      </div>
      <div className="eh-dialog-actions">
        <button type="submit" disabled={chosen === current}>
          {t("common.moveConfirm")}
        </button>
        <button type="button" onClick={onClose}>
          {t("common.cancel")}
        </button>
      </div>
    </TreeDialog>
  );
}
