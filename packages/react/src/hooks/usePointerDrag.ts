import { type PointerEvent, useEffect, useRef, useState } from "react";

/** How far, in pixels either way, a press moves before it becomes a drag; less, and it stays a click. */
const DRAG_THRESHOLD = 4;

/** The controls inside a dragged card or item that never start a drag: text fields, and a question asked in place. */
export const NOT_DRAGGED =
  "input:not([type=checkbox]), textarea, select, [contenteditable='true'], [role='alertdialog']";

/** A drag under way: what is dragged, and where it would be dropped (null: nowhere). */
type PointerDragState<T, P> = { dragged: T; place: P | null };

type Press<T, P> = {
  pointerId: number;
  x: number;
  y: number;
  dragged: T;
  active: boolean;
  cancelled: boolean;
  place: P | null;
};

/**
 * Makes the click that follows a drag (the pointer let go on the title, check box or menu button pressed) do
 * nothing: it is stopped before the page sees it. A click comes at once after the pointer is let go, if at
 * all, so none left over takes the next real click.
 */
function swallowNextClick() {
  const swallow = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    window.removeEventListener("click", swallow, true);
  };
  window.addEventListener("click", swallow, true);
  setTimeout(() => window.removeEventListener("click", swallow, true), 0);
}

/**
 * A drag made with pointer events, not the browser's drag and drop (which a Tauri window catches for dropped
 * files on Windows), as the gantt chart's rows are dragged. A press with the main button on what `pick`
 * says can be dragged becomes a drag once the pointer has moved 4 pixels (less is still a click); the pointer
 * is then captured, `place` says where the element under it would take the drop, and letting go drops it
 * there. Escape or a lost pointer cancels it, and the click that ends a drag does nothing.
 *
 * The handlers go on an element that holds everything that is dragged.
 */
export function usePointerDrag<T, P>({
  enabled,
  pick,
  place,
  onDrop,
}: {
  enabled: boolean;
  /** What a press on this element drags, or null when it starts no drag. */
  pick: (target: Element) => T | null;
  /** Where the drop would go with the pointer over `under` (null: over nothing), or null for nowhere. */
  place: (dragged: T, under: Element | null) => P | null;
  onDrop: (dragged: T, place: P) => void;
}) {
  const [drag, setDrag] = useState<PointerDragState<T, P> | null>(null);
  const press = useRef<Press<T, P> | null>(null);

  // Escape cancels a drag wherever the focus is; the pointer let go afterwards drops nothing.
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !press.current) return;
      press.current.cancelled = true;
      setDrag(null);
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [dragging]);

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (!enabled || event.button !== 0 || !(event.target instanceof Element)) return;
    const dragged = pick(event.target);
    if (dragged === null) return;
    press.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dragged,
      active: false,
      cancelled: false,
      place: null,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const current = press.current;
    if (!current || event.pointerId !== current.pointerId || current.cancelled) return;
    const starting = !current.active;
    if (starting) {
      const far = Math.max(Math.abs(event.clientX - current.x), Math.abs(event.clientY - current.y));
      if (far < DRAG_THRESHOLD) return;
      current.active = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      window.getSelection?.()?.removeAllRanges();
    }
    const next = place(current.dragged, document.elementFromPoint(event.clientX, event.clientY));
    if (!starting && JSON.stringify(next) === JSON.stringify(current.place)) return;
    current.place = next;
    setDrag({ dragged: current.dragged, place: next });
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    const current = press.current;
    if (!current || event.pointerId !== current.pointerId) return;
    press.current = null;
    setDrag(null);
    if (!current.active) return;
    swallowNextClick();
    if (!current.cancelled && current.place !== null) onDrop(current.dragged, current.place);
  }

  function onPointerCancel() {
    press.current = null;
    setDrag(null);
  }

  return { drag, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } };
}
