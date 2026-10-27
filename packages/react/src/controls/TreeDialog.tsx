import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode, type Ref } from "react";

import { classNames } from "./classNames";

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

/**
 * The shell of the views' small modal dialogues (Move to…, an entry, a task…): a form over a backdrop,
 * named by `label`. The focus stays inside (Tab from the last item goes to the first, Shift+Tab from the first
 * to the last); it starts where the content puts it, else on the first item, and when the dialog closes it goes
 * back to where it was before, unless the caller has moved it. Escape (not while an input method is composing)
 * and a click on the backdrop call `onEscape` and `onCancel`; submitting the form calls `onSubmit`.
 */
export function TreeDialog({
  label,
  className,
  busy,
  onCancel,
  onEscape,
  onSubmit,
  formRef,
  children,
}: {
  /** The dialog's accessible name. */
  label: string;
  className?: string;
  /** Marks the dialog busy (aria-busy) while it saves. */
  busy?: boolean;
  /** Closes without doing anything (the backdrop, and Escape unless `onEscape` is given). */
  onCancel: () => void;
  /** What Escape does, when it is not simply cancelling (such as closing a question first). */
  onEscape?: () => void;
  onSubmit?: () => void;
  formRef?: Ref<HTMLFormElement>;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLFormElement | null>(null);
  const opener = useRef<Element | null>(null);

  useLayoutEffect(() => {
    opener.current = document.activeElement;
    const form = dialog.current;
    return () => {
      // While the dialog is still in the document: give the focus back if it is inside, or nowhere.
      const active = document.activeElement;
      const lost = !active || active === document.body || (form?.contains(active) ?? false);
      const back = opener.current;
      if (lost && back instanceof HTMLElement && back.isConnected && !form?.contains(back)) back.focus();
    };
  }, []);

  useEffect(() => {
    // The content's own effects have run: when none of them took the focus, it goes to the first item.
    const form = dialog.current;
    if (form && !form.contains(document.activeElement)) form.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, []);

  function key(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.stopPropagation();
      (onEscape ?? onCancel)();
      return;
    }
    if (event.key !== "Tab" || !dialog.current) return;
    const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the backdrop cancels on a click outside the dialog; Escape does so from the keyboard.
    <div
      className="eh-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <form
        ref={(element) => {
          dialog.current = element;
          if (typeof formRef === "function") formRef(element);
          else if (formRef) formRef.current = element;
        }}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={classNames("eh-dialog", className)}
        aria-busy={busy || undefined}
        onKeyDown={key}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.();
        }}
      >
        {children}
      </form>
    </div>
  );
}
