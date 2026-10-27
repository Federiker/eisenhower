import type { ReactNode } from "react";

import { Button, type ButtonProps } from "./Button";
import { classNames } from "./classNames";

export type IconButtonProps = Omit<ButtonProps, "children" | "aria-label"> & {
  /** The button's accessible name, also shown as its tooltip. */
  label: string;
  /** The icon, hidden from assistive technology (the label names the button). */
  icon: ReactNode;
};

/** A button that shows only an icon; `label` names it for assistive technology and as its tooltip. Quiet unless told otherwise. */
export function IconButton({ label, icon, variant = "quiet", className, ...rest }: IconButtonProps) {
  return (
    <Button
      variant={variant}
      aria-label={label}
      title={label}
      {...rest}
      className={classNames("eh-icon-button", className)}
    >
      {icon}
    </Button>
  );
}
