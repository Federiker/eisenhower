import type { Ref, TextareaHTMLAttributes } from "react";

import { classNames } from "./classNames";

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> };

/** A text field of several lines with the shared field look. */
export function TextArea({ className, ref, ...rest }: TextAreaProps) {
  return <textarea {...rest} ref={ref} className={classNames("eh-field", className)} />;
}
