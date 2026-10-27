import type { BoardColumn } from "@eisenhower/model";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import { EditableText } from "../controls/EditableText";
import { IconButton } from "../controls/IconButton";
import { Notice } from "../controls/Notice";
import { useTranslate } from "../strings/translate";
import type { DragHandlers } from "./CardItem";
import { MoreIcon, PencilIcon } from "./icons";

/**
 * A column's heading on the board or in the list: its name read as text with a pencil (a double-click also
 * edits it; Enter or leaving the field saves, Escape puts it back), how many cards it has, and its menu. The
 * heading is dragged to move the column; Alt and the arrows, F2, the Delete key and the Menu key act on it
 * (see Board). Copied from jerome's PlotPartHeading.tsx.
 */
export function ColumnHeading({
  column,
  index,
  count,
  readOnly,
  drop,
  editRequest,
  onRename,
  onKeyDown,
  onMenu,
  onMore,
  drag,
  children,
}: {
  column: BoardColumn;
  index: number;
  count: number;
  readOnly: boolean;
  /** Whether a dragged column would be dropped here. */
  drop: boolean;
  /** Changes when the name should open for editing (a new column, named in place, or F2). */
  editRequest?: number;
  /** Saves a new name; the reason when it is refused. */
  onRename: (name: string) => Promise<string | null>;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onMenu: (event: MouseEvent<HTMLElement>) => void;
  onMore: (button: HTMLButtonElement) => void;
  drag: DragHandlers;
  /** Shown under the heading, such as the question before the column is deleted. */
  children?: ReactNode;
}) {
  const t = useTranslate();
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: passes on the keys and the right-click menu of the heading's own controls; the heading itself is not a control.
    <div
      className="eh-board-column-heading"
      data-column-id={column.id}
      data-drop={drop ? "before" : undefined}
      onKeyDown={onKeyDown}
      onContextMenu={onMenu}
      {...drag}
    >
      <EditableText
        className="eh-board-column-name"
        text={column.name}
        shown={<h3>{column.name}</h3>}
        label={t("board.columnName", { number: index + 1 })}
        editLabel={t("board.editColumn", { name: column.name })}
        editIcon={<PencilIcon />}
        pencilVisible={readOnly ? "hidden" : "visible"}
        editRequest={editRequest}
        disabled={readOnly}
        onCommit={onRename}
      />
      <Notice as="span">{t("board.cards", { count })}</Notice>
      {!readOnly && (
        <IconButton
          className="eh-board-more"
          label={t("board.moreActionsNamed", { name: column.name })}
          title={t("board.moreActions")}
          aria-haspopup="menu"
          icon={<MoreIcon />}
          onClick={(event) => onMore(event.currentTarget)}
        />
      )}
      {children}
    </div>
  );
}
