import type { InputHTMLAttributes, Ref } from "react";

import { classNames } from "./classNames";

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> };

/** A one-line text field (or number, date, search…) with the shared field look. */
export function TextField({ className, ref, ...rest }: TextFieldProps) {
  return <input {...rest} ref={ref} className={classNames("eh-field", className)} />;
}
