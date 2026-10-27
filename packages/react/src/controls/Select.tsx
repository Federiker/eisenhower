import type { Ref, SelectHTMLAttributes } from "react";

import { classNames } from "./classNames";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> };

/** A native select with the shared field look; its options are its children. */
export function Select({ className, ref, ...rest }: SelectProps) {
  return <select {...rest} ref={ref} className={classNames("eh-field", className)} />;
}
