import {
  type CalendarDay,
  dayAsDate,
  isOverdue,
  subtaskProgress,
  type TodoItem,
  type TodoList as TodoData,
} from "@eisenhower/model";
import { type DragEvent, type KeyboardEvent, type MouseEvent, type ReactNode, useId } from "react";

import { Checkbox } from "../controls/Checkbox";
import { EditableText } from "../controls/EditableText";
import { IconButton } from "../controls/IconButton";
import { ariaKeyShortcuts } from "../keyboard/shortcuts";
import { useLocale, useTranslate } from "../strings/translate";
import { MoreIcon, PencilIcon } from "./icons";

/** What dragging a row does: the row's drag handlers (all of them, or only the start and end). */
export type RowDrag = {
  draggable: boolean;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  onDragLeave?: () => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
};

/** An item's due day as the locale writes it ("2 Nov 2026"), the same day wherever the user is. */
function useDayText(): (day: CalendarDay) => string {
  const locale = useLocale();
  const format = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  return (day) => format.format(dayAsDate(day));
}

/**
 * An item of the todo list or of a quadrant: its check box (named by its title, the item's focus point and
 * the keys' target), its title (renamed in place with the pencil, a double-click or F2), what it says about
 * itself (how many subtasks are done, its parent in the matrix, its due day, "Overdue" in words, its tags)
 * and its notes, then its menu button. A done item is struck through. The row is dragged to move the item.
 */
export function TodoRow({
  item,
  list,
  today,
  readOnly,
  showParent = false,
  drop = false,
  renameRequest,
  onToggle,
  onRename,
  onKeyDown,
  onMenu,
  onMore,
  drag,
  children,
  subtasks,
}: {
  item: TodoItem;
  list: TodoData;
  today: CalendarDay;
  readOnly: boolean;
  /** Whether a subtask says which item it is under (in the matrix, where it is not drawn under it). */
  showParent?: boolean;
  /** Whether a dragged item would be dropped just before this one. */
  drop?: boolean;
  /** Changes when the title should open for editing (F2, Rename, a new subtask). */
  renameRequest?: number;
  onToggle: () => void;
  onRename: (title: string) => Promise<string | null>;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onMenu: (event: MouseEvent<HTMLElement>) => void;
  onMore: (button: HTMLButtonElement) => void;
  drag: RowDrag;
  /** Shown under the row, such as the question before the item is deleted. */
  children?: ReactNode;
  /** The item's subtasks, as a list of their own (the list layout). */
  subtasks?: ReactNode;
}) {
  const t = useTranslate();
  const dayText = useDayText();
  const aboutId = useId();
  const notesId = useId();
  const progress = item.parentId === null ? subtaskProgress(list, item.id) : null;
  const parent = showParent && item.parentId !== null ? list.items.find((one) => one.id === item.parentId) : null;
  const overdue = isOverdue(item, today);
  const about = [
    progress && progress.total > 0 && (
      <span key="progress" className="eh-todo-progress">
        {t("todo.progress", { done: progress.done, total: progress.total })}
      </span>
    ),
    parent && (
      <span key="parent" className="eh-todo-parent">
        {t("todo.subtaskOf", { title: parent.title })}
      </span>
    ),
    item.due !== null && (
      <span key="due" className="eh-todo-due" data-overdue={overdue ? "true" : undefined}>
        {t(overdue ? "todo.overdue" : "todo.due", { date: dayText(item.due) })}
      </span>
    ),
    item.tags.length > 0 && (
      <ul key="tags" className="eh-todo-tags" aria-label={t("todo.tags")}>
        {item.tags.map((tag) => (
          <li key={tag} className="eh-todo-tag">
            {tag}
          </li>
        ))}
      </ul>
    ),
  ].filter(Boolean);
  const described = [about.length > 0 ? aboutId : null, item.notes !== "" ? notesId : null].filter(Boolean);

  return (
    <li
      className="eh-todo-item"
      data-item-id={item.id}
      data-done={item.done ? "true" : undefined}
      data-drop={drop ? "before" : undefined}
      onContextMenu={readOnly ? undefined : onMenu}
      {...drag}
    >
      <div className="eh-todo-row">
        <Checkbox
          className="eh-todo-check"
          checked={item.done}
          aria-label={item.title}
          aria-describedby={described.length > 0 ? described.join(" ") : undefined}
          aria-readonly={readOnly || undefined}
          aria-keyshortcuts={
            readOnly
              ? undefined
              : ariaKeyShortcuts(["moveUp", "moveDown", "moveLeft", "moveRight", "open", "rename", "delete", "menu"])
          }
          onChange={() => {
            if (!readOnly) onToggle();
          }}
          onClick={(event) => {
            if (readOnly) event.preventDefault();
          }}
          onKeyDown={onKeyDown}
        />
        <EditableText
          className="eh-todo-title"
          text={item.title}
          label={t("todo.title")}
          editLabel={t("todo.renameNamed", { title: item.title })}
          editIcon={<PencilIcon />}
          pencilVisible={readOnly ? "hidden" : "onHover"}
          disabled={readOnly}
          editRequest={renameRequest}
          onCommit={onRename}
        />
        {about.length > 0 && (
          <span id={aboutId} className="eh-todo-about">
            {about}
          </span>
        )}
        {!readOnly && (
          <IconButton
            className="eh-todo-more"
            label={t("todo.actionsNamed", { title: item.title })}
            aria-haspopup="menu"
            icon={<MoreIcon />}
            onClick={(event) => onMore(event.currentTarget)}
          />
        )}
      </div>
      {item.notes !== "" && (
        <p id={notesId} className="eh-todo-notes">
          {item.notes}
        </p>
      )}
      {children}
      {subtasks}
    </li>
  );
}
