import { type EntryDrag, type EntryPart, draggedEntry, type Timeline, type TimelineEntry } from "@eisenhower/model";
import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "../controls/Button";
import { DRAG_THRESHOLD, dragCount, laneAt } from "./drag";
import { LABEL_HEIGHT, type Lane, LANE_PADDING, MARK_Y, type PlacedEntry, ROW_HEIGHT } from "./layout";
import { DASHES, MARGIN, Mark } from "./marks";
import { extentOf, type Scale, valueAt, xOf } from "./scale";

/** Half the height of the strip over a mark that drags it, and the width of a span's end that resizes it. */
const GRIP = 6;
const END_GRIP = 10;

export type EntryLabelProps = {
  placed: PlacedEntry;
  lane: Lane;
  lanes: readonly Lane[];
  scale: Scale;
  timeline: Timeline;
  /** The plane the drawing is laid out on, which the pointer's place is measured from. */
  plane: RefObject<HTMLDivElement | null>;
  /** The plane's size, which the drag's preview covers. */
  width: number;
  height: number;
  readOnly: boolean;
  selected: boolean;
  /** The title's accessible name and its `aria-keyshortcuts`. */
  name: string;
  shortcuts: string;
  /** Where an entry is, in words: the title's tooltip and the preview's label while it is dragged. */
  when: (entry: TimelineEntry) => string;
  register: (element: HTMLButtonElement | null) => void;
  onOpen: (from: HTMLButtonElement) => void;
  onMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  onKey: (event: KeyboardEvent<HTMLButtonElement>) => void;
  /** A drag let go of somewhere: the drawing makes the change and says so. */
  onDrop: (drag: EntryDrag) => void;
};

type Press = { part: EntryPart; x: number; y: number; origin: number; fromTitle: boolean };

/**
 * An entry's title (a button: the keys, a click opens it, a right-click its menu) and, when it may be edited,
 * the strips over its mark that the pointer drags: the mark or the title moves the entry along the axis and
 * between lanes, a span's ends resize it. A drag starts once the pointer has gone {@link DRAG_THRESHOLD} pixels,
 * snaps as the model's {@link draggedEntry} does, is drawn as a preview over the drawing and ends on the drop;
 * Escape cancels it. The drag's state is this entry's own, so the other entries do not draw again meanwhile.
 */
export function EntryLabel({
  placed,
  lane,
  lanes,
  scale,
  timeline,
  plane,
  width,
  height,
  readOnly,
  selected,
  name,
  shortcuts,
  when,
  register,
  onOpen,
  onMenu,
  onKey,
  onDrop,
}: EntryLabelProps) {
  const { entry, extent } = placed;
  const press = useRef<Press | null>(null);
  // A drag that began on the title: the click that ends it opens nothing.
  const skipClick = useRef(false);
  const [drag, setDrag] = useState<{ drag: EntryDrag; entry: TimelineEntry } | null>(null);
  const dragging = drag !== null;
  const top = lane.top + LANE_PADDING + placed.row * ROW_HEIGHT;

  useEffect(() => {
    if (!dragging) return undefined;
    const cancel = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      press.current = null;
      setDrag(null);
    };
    window.addEventListener("keydown", cancel, true);
    return () => window.removeEventListener("keydown", cancel, true);
  }, [dragging]);

  /** The pointer's place on the plane, the time it is at clamped to the axis. */
  function placeOf(event: PointerEvent) {
    const box = plane.current?.getBoundingClientRect();
    const x = event.clientX - (box?.left ?? 0) - MARGIN;
    return { value: valueAt(scale, Math.min(Math.max(x, 0), scale.width)), y: event.clientY - (box?.top ?? 0) };
  }

  function down(event: PointerEvent<HTMLElement>, part: EntryPart, fromTitle: boolean) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const origin = placeOf(event).value ?? (part === "end" ? extent.to : extent.from);
    press.current = { part, x: event.clientX, y: event.clientY, origin, fromTitle };
    skipClick.current = false;
  }

  function move(event: PointerEvent<HTMLElement>) {
    const pressed = press.current;
    if (!pressed) return;
    const far =
      Math.abs(event.clientX - pressed.x) >= DRAG_THRESHOLD || Math.abs(event.clientY - pressed.y) >= DRAG_THRESHOLD;
    if (!far && !drag) return;
    skipClick.current = pressed.fromTitle;
    const { value, y } = placeOf(event);
    // In a collapsed stretch the preview stays where it was.
    if (value === null) return;
    const next: EntryDrag = {
      part: pressed.part,
      by: dragCount(timeline, entry, pressed.part, value - pressed.origin),
      categoryId: pressed.part === "whole" ? (laneAt(lanes, y)?.category.id ?? entry.categoryId) : entry.categoryId,
    };
    const result = draggedEntry(timeline, entry.id, next);
    if (result.ok) setDrag({ drag: next, entry: result.value });
  }

  function up() {
    const done = drag;
    press.current = null;
    setDrag(null);
    if (done) onDrop(done.drag);
  }

  function cancel() {
    press.current = null;
    setDrag(null);
  }

  const pointer = (part: EntryPart, fromTitle = false) =>
    readOnly
      ? {}
      : {
          onPointerDown: (event: PointerEvent<HTMLElement>) => down(event, part, fromTitle),
          onPointerMove: move,
          onPointerUp: up,
          onPointerCancel: cancel,
        };

  const span = entry.end !== null;
  const markTop = top + MARK_Y - GRIP;
  return (
    <>
      {!readOnly && (
        <>
          <div
            className="eh-timeline-grip"
            aria-hidden="true"
            data-part="whole"
            data-grip={entry.id}
            style={{
              left: placed.x1 + MARGIN - GRIP,
              top: markTop,
              width: Math.max(placed.x2 - placed.x1, 0) + GRIP * 2,
              height: GRIP * 2,
            }}
            {...pointer("whole")}
          />
          {span &&
            (["start", "end"] as const).map((part) => (
              <div
                key={part}
                className="eh-timeline-grip"
                aria-hidden="true"
                data-part={part}
                data-grip={entry.id}
                style={{
                  left: (part === "start" ? placed.x1 : placed.x2) + MARGIN - END_GRIP / 2,
                  top: markTop,
                  width: END_GRIP,
                  height: GRIP * 2,
                }}
                {...pointer(part)}
              />
            ))}
        </>
      )}
      <Button
        variant="quiet"
        className="eh-timeline-label"
        data-entry={entry.id}
        data-dragging={drag ? drag.drag.part : undefined}
        ref={register}
        aria-label={name}
        aria-keyshortcuts={shortcuts}
        title={drag ? when(drag.entry) : entry.title}
        aria-current={selected ? "true" : undefined}
        style={{
          left: Math.max(placed.labelX + MARGIN, 0),
          top,
          maxWidth: placed.labelWidth,
          height: LABEL_HEIGHT,
        }}
        onClick={(event) => {
          if (skipClick.current) {
            skipClick.current = false;
            return;
          }
          onOpen(event.currentTarget);
        }}
        onContextMenu={onMenu}
        onKeyDown={onKey}
        {...pointer("whole", true)}
      >
        {entry.title}
      </Button>
      {drag && <Preview {...{ placed, lane, lanes, scale, timeline, width, height, when }} moved={drag.entry} />}
    </>
  );
}

/** Where a dragged entry would go: its mark in the lane it is over, and its place in words. */
function Preview({
  placed,
  lane,
  lanes,
  scale,
  timeline,
  width,
  height,
  when,
  moved,
}: Pick<EntryLabelProps, "placed" | "lane" | "lanes" | "scale" | "timeline" | "width" | "height" | "when"> & {
  moved: TimelineEntry;
}) {
  const extent = extentOf(moved, timeline);
  const target = lanes.find((each) => each.category.id === moved.categoryId) ?? lane;
  if (!extent) return null;
  const x1 = xOf(scale, extent.from);
  const top = target.top + LANE_PADDING + (target === lane ? placed.row : 0) * ROW_HEIGHT;
  const { category } = target;
  return (
    <svg className="eh-timeline-preview" width={width} height={height} aria-hidden="true">
      <g
        className="eh-timeline-lane"
        style={{ stroke: `var(--eh-colour-${category.colour})`, fill: `var(--eh-colour-${category.colour})` }}
      >
        <g strokeDasharray={extent.marker === null ? DASHES[category.line] : undefined}>
          <Mark
            placed={{ ...placed, entry: moved, extent, x1, x2: xOf(scale, extent.to) }}
            top={top}
            scale={scale}
            selected
          />
        </g>
        <text className="eh-timeline-preview-when" x={x1 + MARGIN} y={top + LABEL_HEIGHT - 4}>
          {when(moved)}
        </text>
      </g>
    </svg>
  );
}
