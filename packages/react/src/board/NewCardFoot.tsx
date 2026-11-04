import { useEffect, useId, useRef, useState } from "react";

import { Button } from "../controls/Button";
import { TextField } from "../controls/TextField";
import { useTranslate } from "../strings/translate";

/**
 * New card at the foot of a column (the owner's decision of 4 November 2026, Trello's way): a button that
 * becomes a title field. Enter adds a card with the trimmed title at the column's end and keeps the field open,
 * empty, for the next; a refused title stays in the field with the reason under it. Escape, or Enter or leaving
 * the field while it is empty, closes it and gives the focus back to the button (on leaving, only when the
 * focus went nowhere else). Nothing happens while an input method is composing.
 */
export function NewCardFoot({
  group,
  onAdd,
}: {
  /** The column's name (or No column's), naming the button and the field. */
  group: string;
  /** Adds a card with this (non-blank) title at the column's end; null when it was added, else the reason. */
  onAdd: (title: string) => string | null;
}) {
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState<string | null>(null);
  // Where the focus goes once the field has closed: back to the button, or (on leaving it) where it went.
  const backToButton = useRef<"always" | "ifNowhere" | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const reasonId = useId();

  useEffect(() => {
    if (open) {
      field.current?.focus();
      return;
    }
    const back = backToButton.current;
    backToButton.current = null;
    if (back === "always") button.current?.focus();
    else if (back === "ifNowhere") {
      const active = document.activeElement;
      if (!active || active === document.body) button.current?.focus();
    }
  }, [open]);

  function close(back: "always" | "ifNowhere") {
    backToButton.current = back;
    setTitle("");
    setReason(null);
    setOpen(false);
  }

  function add() {
    if (title.trim() === "") {
      close("always");
      return;
    }
    const refused = onAdd(title);
    if (refused === null) {
      setTitle("");
      setReason(null);
    } else setReason(refused);
  }

  if (!open) {
    return (
      <div className="eh-board-foot">
        <Button
          ref={button}
          variant="quiet"
          className="eh-board-foot-button"
          aria-label={t("board.newCardIn", { group })}
          onClick={() => setOpen(true)}
        >
          {t("board.newCard")}
        </Button>
      </div>
    );
  }
  return (
    <div className="eh-board-foot" data-open="true">
      <TextField
        ref={field}
        className="eh-board-foot-field"
        aria-label={t("board.newCardField", { group })}
        aria-invalid={reason !== null}
        aria-describedby={reason !== null ? reasonId : undefined}
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
          setReason(null);
        }}
        onBlur={() => {
          if (title.trim() === "") close("ifNowhere");
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          event.stopPropagation();
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          } else if (event.key === "Escape") {
            event.preventDefault();
            close("always");
          }
        }}
      />
      {reason !== null && (
        <p id={reasonId} role="alert" className="eh-problem">
          {reason}
        </p>
      )}
    </div>
  );
}
