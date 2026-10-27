import { useEffect, useRef, useState } from "react";

/**
 * A title edited in place: the text box takes the focus with the title selected. Enter (or leaving the
 * box) saves a changed, non-blank title; Escape cancels; a blank or unchanged title just ends editing.
 * Nothing happens while an input method is composing.
 */
export function InlineRename({
  title,
  label,
  onRename,
  onCancel,
  className,
}: {
  title: string;
  /** The text box's accessible name. */
  label: string;
  /** Saves the new (trimmed) title. */
  onRename: (title: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const [value, setValue] = useState(title);
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  function finish(save: boolean) {
    if (done.current) return;
    done.current = true;
    const next = value.trim();
    if (save && next && next !== title) onRename(next);
    else onCancel();
  }

  return (
    <input
      ref={input}
      className={className ?? "eh-inline-rename"}
      aria-label={label}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          finish(true);
        } else if (event.key === "Escape") {
          event.preventDefault();
          finish(false);
        }
      }}
    />
  );
}
