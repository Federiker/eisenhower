import type { ButtonHTMLAttributes, Ref } from "react";

import { classNames } from "./classNames";

/**
 * How a button looks: `secondary` is the plain outlined button of the views; `primary` takes the accent colour
 * (as a dialog's main action does); `quiet` has no border; `danger` is for actions that remove something.
 */
export type ButtonVariant = "secondary" | "primary" | "quiet" | "danger";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /** Makes the button a toggle: on or off, announced with aria-pressed. */
  pressed?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

/**
 * A button with the shared look. It is `type="button"` unless told otherwise, so it never submits a form by
 * accident. Its styles are as weak as an element rule, so a feature's own rules for its buttons still win.
 */
export function Button({ variant = "secondary", pressed, type = "button", className, ref, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      {...rest}
      ref={ref}
      className={classNames("eh-button", className)}
      data-variant={variant === "secondary" ? undefined : variant}
    />
  );
}
