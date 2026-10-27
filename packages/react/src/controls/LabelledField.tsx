import type { ReactNode } from "react";

import { classNames } from "./classNames";

/**
 * A field of a page that reads as text: its label above (muted) and, under it, the field itself, usually an
 * `EditableText`. The pair is a group named by the label (a fieldset and its legend), so the field's text and
 * its pencil are heard with it. A list field shows the label itself, with its pencil beside it (`EditableText`'s
 * `caption`): then the legend only names the group.
 */
export function LabelledField({
  label,
  captioned = false,
  className,
  children,
}: {
  label: string;
  /** Whether the field shows the label itself (as a list's caption, with its pencil). */
  captioned?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={classNames("eh-labelled-field", className)}>
      <legend className={captioned ? "eh-visually-hidden" : "eh-labelled-field-label"}>{label}</legend>
      {children}
    </fieldset>
  );
}
