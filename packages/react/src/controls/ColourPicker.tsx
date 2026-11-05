import type { Colour } from "@eisenhower/model";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { useTranslate } from "../strings/translate";
import { PALETTE } from "../theme/palette";
import { classNames } from "./classNames";
import { ColourSwatch } from "./ColourSwatch";

/** How long a pause in typing starts a new search for an option's name, in milliseconds. */
const TYPING_PAUSE = 500;
/** The list's tallest, in pixels, and the room it keeps from the window's edges. */
const LIST_HEIGHT = 320;
const EDGE = 8;

/**
 * The colour chosen (a palette index), and what is called with the one chosen instead, only when it differs.
 * With `allowNone`, no colour (null) is offered too, first in the list, read as `noneLabel` ("None" when not
 * given).
 */
type ColourChoice =
  | { allowNone: true; value: Colour; onChange: (colour: Colour) => void; noneLabel?: string }
  | { allowNone?: false; value: number; onChange: (colour: number) => void; noneLabel?: never };

export type ColourPickerProps = ColourChoice & {
  /** The button's id, for a `<label htmlFor>`. */
  id?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
};

/**
 * A palette colour chosen from a list (a select-only combobox, WAI-ARIA's pattern): a button with the colour's
 * swatch and name opens a list of every palette colour, each with its swatch and name (None first when allowed),
 * the chosen one ticked. The focus stays on the button, the list's current option shown through
 * aria-activedescendant. Enter, Space, ↓ or Alt+↓ opens it; ↑ ↓ Home End move; a letter goes to the next colour
 * whose name starts with what was typed; Enter or Space (or Alt+↑) chooses and closes; Escape, Tab or a click
 * outside closes without changing the colour.
 */
export function ColourPicker({
  id,
  value,
  onChange,
  allowNone = false,
  noneLabel,
  disabled = false,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
}: ColourPickerProps) {
  const t = useTranslate();
  const listId = useId();
  const optionId = (index: number) => `${listId}-option-${index}`;
  const options: Colour[] = [...(allowNone ? [null] : []), ...PALETTE.map((_, index) => index)];
  const nameOf = (colour: Colour) => {
    if (colour === null) return noneLabel ?? t("common.colour.none");
    const named = PALETTE[colour];
    return named ? t(named.name) : String(colour);
  };
  const chosen = options.indexOf(value);
  // The option the keys are on while the list is open; null while it is closed.
  const [active, setActive] = useState<number | null>(null);
  const [listName, setListName] = useState<string | undefined>(undefined);
  const holder = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const open = active !== null;
  const last = options.length - 1;

  function show(index: number) {
    if (disabled) return;
    // The list is named as the button is: by its label, unless the caller names it.
    setListName(ariaLabel ?? button.current?.labels?.[0]?.textContent ?? undefined);
    setActive(Math.min(Math.max(index, 0), last));
  }

  const close = useCallback(() => {
    setActive(null);
    typed.current.text = "";
  }, []);

  function choose(index: number) {
    const colour = options[index]!;
    close();
    button.current?.focus();
    // Null is among the options only when it is allowed, and so onChange takes it.
    if (colour !== value) (onChange as (colour: Colour) => void)(colour);
  }

  /** The option whose name starts with what was typed (after a pause, a new search), from `from` on. */
  function search(letter: string, from: number): number | null {
    const now = Date.now();
    const memory = typed.current;
    memory.text = now - memory.at > TYPING_PAUSE ? letter : memory.text + letter;
    memory.at = now;
    const text = memory.text.toLocaleLowerCase();
    // One letter typed again goes on to the next name starting with it.
    const repeated = [...text].every((each) => each === text[0]);
    const wanted = repeated ? text[0]! : text;
    const start = repeated ? from + 1 : from;
    for (let step = 0; step < options.length; step++) {
      const index = (start + step) % options.length;
      if (nameOf(options[index]!).toLocaleLowerCase().startsWith(wanted)) return index;
    }
    return null;
  }

  function key(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.nativeEvent.isComposing || disabled) return;
    const { altKey, ctrlKey, metaKey } = event;
    const typing = Date.now() - typed.current.at <= TYPING_PAUSE && typed.current.text !== "";
    const letter =
      event.key.length === 1 && !altKey && !ctrlKey && !metaKey && (event.key !== " " || typing) ? event.key : null;
    const from = active ?? Math.max(chosen, 0);
    let handled = true;
    if (letter !== null) {
      const found = search(letter, from);
      if (open) setActive(found ?? active);
      else show(found ?? from);
    } else if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") show(from);
      else if (event.key === "ArrowUp" && !altKey) show(from);
      else if (event.key === "Home") show(0);
      else if (event.key === "End") show(last);
      else handled = false;
    } else if (event.key === "Tab") {
      // Tab goes on to the next field, as it would anyway.
      close();
      handled = false;
    } else if (event.key === "ArrowUp" && altKey) choose(from);
    else if (event.key === "ArrowDown") setActive(Math.min(from + 1, last));
    else if (event.key === "ArrowUp") setActive(Math.max(from - 1, 0));
    else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(last);
    else if (event.key === "Enter" || event.key === " ") choose(from);
    else if (event.key === "Escape") close();
    else handled = false;
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  // While open, the list sits under the button (above it when there is more room there), inside the window, and
  // over a dialog's edges (it is fixed, so a dialog's scrolling does not cut it off); it follows the page's
  // scrolling. A click outside closes it.
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const element = list.current;
      const anchor = button.current;
      if (!element || !anchor) return;
      const bounds = anchor.getBoundingClientRect();
      const below = window.innerHeight - bounds.bottom - EDGE;
      const above = bounds.top - EDGE;
      const up = below < Math.min(LIST_HEIGHT, element.scrollHeight) && above > below;
      element.style.minWidth = `${bounds.width}px`;
      element.style.maxHeight = `${Math.max(Math.min(LIST_HEIGHT, up ? above : below), 48)}px`;
      element.style.top = up ? "" : `${bounds.bottom}px`;
      element.style.bottom = up ? `${window.innerHeight - bounds.top}px` : "";
      element.style.left = `${Math.max(Math.min(bounds.left, window.innerWidth - element.offsetWidth - EDGE), EDGE)}px`;
    }
    function outside(event: MouseEvent) {
      if (!holder.current?.contains(event.target as Node)) close();
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    document.addEventListener("mousedown", outside, true);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", outside, true);
    };
  }, [open, close]);

  useEffect(() => {
    if (active === null) return;
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  return (
    <div ref={holder} className={classNames("eh-colour-picker", className)}>
      <button
        ref={button}
        id={id}
        type="button"
        role="combobox"
        className="eh-field eh-colour-picker-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={active === null ? undefined : optionId(active)}
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => (open ? close() : show(Math.max(chosen, 0)))}
        onKeyDown={key}
        // Space chooses on its key's press: its release must not click the button again.
        onKeyUp={(event) => {
          if (event.key === " ") event.preventDefault();
        }}
        onBlur={close}
      >
        <ColourSwatch colour={value} />
        <span className="eh-colour-picker-name">{nameOf(value)}</span>
        <svg className="eh-colour-picker-chevron" viewBox="0 0 10 6" aria-hidden="true" focusable="false">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      {open && (
        <div
          ref={list}
          id={listId}
          role="listbox"
          className="eh-colour-picker-list"
          aria-label={labelledBy ? undefined : listName}
          aria-labelledby={labelledBy}
          // A press on the list keeps the focus on the button.
          onMouseDown={(event) => event.preventDefault()}
        >
          {options.map((colour, index) => (
            // biome-ignore lint/a11y/useFocusableInteractive lint/a11y/useKeyWithClickEvents: the focus stays on the button, whose keys move between the options and choose one (aria-activedescendant).
            <div
              key={colour ?? "none"}
              id={optionId(index)}
              role="option"
              aria-selected={index === chosen}
              data-index={index}
              data-active={index === active ? "true" : undefined}
              className="eh-colour-picker-option"
              onClick={() => choose(index)}
              onMouseMove={() => {
                if (index !== active) setActive(index);
              }}
            >
              <ColourSwatch colour={colour} />
              {nameOf(colour)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
