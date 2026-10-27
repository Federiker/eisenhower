import type { HTMLAttributes, ReactNode } from "react";

import { classNames } from "./classNames";

/**
 * A short notice in the page: a muted `note` (a hint, or what just happened) or a `problem` (something that
 * went wrong or must be put right, announced as an alert unless another role is given).
 */
export function Notice({
  tone = "note",
  as: Element = "p",
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLElement> & {
  tone?: "note" | "problem";
  as?: "p" | "span" | "div";
  children: ReactNode;
}) {
  return (
    <Element
      role={tone === "problem" ? "alert" : undefined}
      {...rest}
      className={classNames(tone === "problem" ? "eh-problem" : "eh-note", className)}
    >
      {children}
    </Element>
  );
}
