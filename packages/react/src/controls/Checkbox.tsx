import type { InputHTMLAttributes, Ref } from "react";

import { classNames } from "./classNames";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { ref?: Ref<HTMLInputElement> };

/** A native check box in the accent colour. Its label is the caller's (a wrapping label or aria-label). */
export function Checkbox({ className, ref, ...rest }: CheckboxProps) {
  return <input type="checkbox" {...rest} ref={ref} className={classNames("eh-checkbox", className)} />;
}
