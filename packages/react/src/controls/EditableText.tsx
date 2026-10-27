import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { IconButton } from "./IconButton";
import { classNames } from "./classNames";

/** What saving the text came to: null when it was saved (or nothing changed), otherwise the reason to show. */
export type EditableTextCommit = (text: string) => Promise<string | null>;

/** One value a choice can take, and how it reads. */
export type EditableChoice = { value: string; label: string };

/**
 * When the pencil shows: always (`visible`), only while the pointer is over the field (`onHover`; it cannot be
 * reached with Tab otherwise), or never (`hidden`; the text is then edited by double-clicking it).
 */
export type PencilVisibility = "visible" | "onHover" | "hidden";

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/**
 * Text that reads as text until it is edited in place: its pencil button or a double-click turns it into a
 * field. A one-line text (or a choice) saves with Enter or by leaving the field; a multiline one (one item per
 * line) saves by leaving it or with Ctrl+Enter (Cmd+Return on a Mac). A choice picked with the pointer (the
 * dropdown closing on it) saves at once. Escape cancels. A refused value stays in
 * the field with the reason under it, and nothing is saved. When editing ends, the focus goes back to the pencil
 * unless something else has taken it. Nothing happens while an input method is composing. `pencilVisible` can show
 * the pencil only on hover, or not at all.
 */
export function EditableText({
  text,
  shown,
  empty,
  multiline = false,
  choices,
  label,
  editLabel,
  editIcon,
  pencilVisible = "visible",
  hint,
  caption,
  editRequest,
  selection,
  disabled = false,
  onCommit,
  onUnsaved,
  onEditing,
  as: Container = "div",
  className,
  containerProps,
}: {
  /** The text as it is edited (a multiline list one item per line; a choice's value). */
  text: string;
  /** How the text reads when not editing; the text itself (or the chosen choice's label) when not given. */
  shown?: ReactNode;
  /** How an empty text reads (such as "No description"), muted, so the field keeps its place. */
  empty?: ReactNode;
  multiline?: boolean;
  /** The values a choice can take: the pencil opens a select of them instead of a text field. */
  choices?: readonly EditableChoice[];
  /** The field's accessible name. */
  label: string;
  /** The pencil button's accessible name. */
  editLabel: string;
  /** The pencil button's icon. */
  editIcon: ReactNode;
  /** When the pencil shows (default: always). Hidden, the text is edited by double-clicking it. */
  pencilVisible?: PencilVisibility;
  /** A note under the field while it is edited (such as "One name per line"). */
  hint?: ReactNode;
  /**
   * A visible label on a line of its own above the text, with the pencil beside it (a list's pencil edits the
   * whole list, not its first item). It is hidden from assistive technology: the caller names the group.
   */
  caption?: ReactNode;
  /** Changes when the caller asks the text to start editing (such as a new entry's first field). */
  editRequest?: number;
  /** What to select (UTF-16 offsets) when the caller asks to edit; all of the text otherwise. */
  selection?: readonly [number, number];
  disabled?: boolean;
  onCommit: EditableTextCommit;
  /** Whether the text has changes that are not saved (an open field with a change, or a refused value). */
  onUnsaved?: (unsaved: boolean) => void;
  /** The value in the open field as it changes, and null once the field closes (so a page can save it first). */
  onEditing?: (value: string | null) => void;
  /** The element that holds the text and the field, such as a table cell. */
  as?: "div" | "td" | "li";
  className?: string;
  /** Other attributes for the holding element (such as data attributes the caller styles by). */
  containerProps?: HTMLAttributes<HTMLElement> & Record<`data-${string}`, string | undefined>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(text);
  const [reason, setReason] = useState<string | null>(null);
  const field = useRef<Field>(null);
  const pencil = useRef<HTMLButtonElement>(null);
  const committing = useRef(false);
  const selectRange = useRef<readonly [number, number] | null>(null);
  // Whether a choice's dropdown was opened with the pointer, so that the pick it closes on saves at once.
  const pointerPick = useRef(false);
  const reasonId = useId();
  const hintId = useId();

  const unsaved = editing && (value !== text || reason !== null);
  const report = useRef(onUnsaved);
  report.current = onUnsaved;
  useEffect(() => {
    report.current?.(unsaved);
  }, [unsaved]);
  useEffect(() => () => report.current?.(false), []);

  const reportValue = useRef(onEditing);
  reportValue.current = onEditing;
  useEffect(() => {
    reportValue.current?.(editing ? value : null);
  }, [editing, value]);
  useEffect(() => () => reportValue.current?.(null), []);

  function start(range: readonly [number, number] | null = null) {
    if (disabled || editing) return;
    selectRange.current = range;
    setValue(text);
    setReason(null);
    setEditing(true);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new request starts editing.
  useEffect(() => {
    if (editRequest) start(selection ?? null);
  }, [editRequest]);

  useEffect(() => {
    const current = field.current;
    if (!editing || !current) return;
    current.focus();
    if (current instanceof HTMLSelectElement) return;
    const range = selectRange.current;
    if (range) current.setSelectionRange(range[0], range[1]);
    else current.select();
  }, [editing]);

  function stop(focusPencil: boolean) {
    setEditing(false);
    setReason(null);
    // The focus goes back to the pencil unless something else (such as the next field to fill) has taken it.
    if (focusPencil) {
      window.setTimeout(() => {
        const active = document.activeElement;
        if (!active || active === document.body) pencil.current?.focus();
      }, 0);
    }
  }

  async function commit(focusPencil: boolean, next = value) {
    if (committing.current || !editing) return;
    if (next === text && reason === null) {
      stop(focusPencil);
      return;
    }
    committing.current = true;
    try {
      const refused = await onCommit(next);
      if (refused === null) stop(focusPencil);
      else setReason(refused);
    } finally {
      committing.current = false;
    }
  }

  function cancel() {
    setValue(text);
    stop(true);
  }

  function key(event: KeyboardEvent) {
    if (event.nativeEvent.isComposing) return;
    event.stopPropagation();
    pointerPick.current = false;
    const saves = multiline ? event.key === "Enter" && (event.ctrlKey || event.metaKey) : event.key === "Enter";
    if (saves) {
      event.preventDefault();
      void commit(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  }

  if (editing) {
    const described = [reason !== null ? reasonId : null, hint ? hintId : null].filter(Boolean).join(" ");
    const shared = {
      className: "eh-editable-field",
      "aria-label": label,
      "aria-invalid": reason !== null,
      "aria-describedby": described || undefined,
      value,
      onBlur: () => void commit(false),
      onKeyDown: key,
      onChange: (event: ChangeEvent<Field>) => {
        setValue(event.target.value);
        setReason(null);
        if (choices && pointerPick.current) {
          pointerPick.current = false;
          void commit(true, event.target.value);
        }
      },
    };
    const captionLine = caption !== undefined && (
      <div className="eh-editable-caption" aria-hidden="true">
        {caption}
      </div>
    );
    return (
      <Container {...containerProps} className={classNames("eh-editable", className)} data-editing="true">
        {captionLine}
        {choices ? (
          <select
            {...shared}
            ref={field as RefObject<HTMLSelectElement>}
            onPointerDown={() => {
              pointerPick.current = true;
            }}
          >
            {choices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        ) : multiline ? (
          <textarea
            {...shared}
            ref={field as RefObject<HTMLTextAreaElement>}
            rows={Math.min(8, Math.max(2, value.split("\n").length + 1))}
          />
        ) : (
          <input {...shared} ref={field as RefObject<HTMLInputElement>} />
        )}
        {reason !== null && (
          <p id={reasonId} role="alert" className="eh-problem">
            {reason}
          </p>
        )}
        {hint && (
          <p id={hintId} className="eh-editable-hint">
            {hint}
          </p>
        )}
      </Container>
    );
  }

  const reading =
    text === "" && empty !== undefined ? (
      <span className="eh-editable-empty">{empty}</span>
    ) : (
      (shown ?? choices?.find((choice) => choice.value === text)?.label ?? text)
    );
  const pencilButton = pencilVisible !== "hidden" && (
    <IconButton
      ref={pencil}
      className="eh-editable-edit"
      label={editLabel}
      icon={editIcon}
      disabled={disabled}
      onClick={() => start()}
    />
  );
  return (
    <Container
      {...containerProps}
      className={classNames("eh-editable", className)}
      data-pencil={pencilVisible === "visible" ? undefined : pencilVisible === "onHover" ? "hover" : "hidden"}
      onDoubleClick={() => start()}
    >
      {caption === undefined ? (
        <div className="eh-editable-content">
          <div className="eh-editable-text">{reading}</div>
          {pencilButton}
        </div>
      ) : (
        <>
          <div className="eh-editable-content eh-editable-caption">
            <span aria-hidden="true">{caption}</span>
            {pencilButton}
          </div>
          <div className="eh-editable-text">{reading}</div>
        </>
      )}
    </Container>
  );
}
