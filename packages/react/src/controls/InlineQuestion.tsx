import type { ReactNode } from "react";

import { classNames } from "./classNames";

/**
 * A question asked in place, next to what it is about ("Discard / Keep editing", "Delete asks first"): an
 * alert dialog named by `label`, with the question, anything else the caller adds, and the answers. Escape
 * calls `onEscape` when given (and goes no further).
 */
export function InlineQuestion({
  label,
  question,
  actions,
  children,
  onEscape,
  className,
}: {
  /** The question's accessible name. */
  label: string;
  question: ReactNode;
  /** The answers, usually buttons; the first one to answer is the one to focus (autoFocus). */
  actions?: ReactNode;
  /** Shown between the question and the answers, such as a note or a choice. */
  children?: ReactNode;
  onEscape?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alertdialog"
      aria-label={label}
      className={classNames("eh-question", className)}
      onKeyDown={
        onEscape &&
        ((event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          onEscape();
        })
      }
    >
      <p>{question}</p>
      {children}
      {actions && <div className="eh-question-actions">{actions}</div>}
    </div>
  );
}
