import { moveEntryToLane, shiftEntry, type Timeline, type TimelineEntry, type TimelinePoint } from "@eisenhower/model";
import {
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type WheelEvent,
} from "react";

import { Button } from "../controls/Button";
import { placeBelow } from "../controls/ContextMenu";
import { Notice } from "../controls/Notice";
import { actionOf, ariaKeyShortcuts, shortcutsIn } from "../keyboard/shortcuts";
import { axisOf } from "./axis";
import { type TimelineView, useTimelineView } from "./context";
import { type DateWords, formatPoint, formatWhen } from "./format";
import { CategorySwatch } from "./labels";
import {
  LABEL_HEIGHT,
  type Lane,
  LANE_PADDING,
  lanesOf,
  MARK_Y,
  MAX_LABEL_WIDTH,
  type PlacedEntry,
  ROW_HEIGHT,
} from "./layout";
import { pointAt, type Scale, scaleOf, valueAt, xOf } from "./scale";
import { TimelineNarrowList } from "./TimelineNarrowList";

/** Below this width the drawing becomes a list. */
const NARROW = 600;
/** The column of lane names beside the drawing. */
const NAMES_WIDTH = 140;
const AXIS_HEIGHT = 44;
const MARGIN = 24;
/** How much each zoom step multiplies or divides by. */
export const ZOOM_STEP = 1.5;
const DASHES = { solid: undefined, dashed: "8 5", dotted: "2 5" } as const;
const KEYS = shortcutsIn("timeline");

/** The width of an element, followed as it changes; a fallback where it cannot be measured. */
function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    if (element.clientWidth > 0) setWidth(element.clientWidth);
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth > 0) setWidth(element.clientWidth);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/** What an entry is called for a screen reader: "Ships: Harbour opens, Act 1 to Act 2". */
function accessibleName(entry: TimelineEntry, lane: Lane, view: TimelineView): string {
  const { timeline, showCe, words } = view;
  const start = formatPoint(entry.start, timeline, showCe, words);
  const when =
    entry.end === null
      ? start
      : words.t("timeline.span", { start, end: formatPoint(entry.end, timeline, showCe, words) });
  return words.t("timeline.entryName", { category: lane.category.name, title: entry.title, when });
}

/** The axis: step names, or dates as fine as the scale is, and the years either side of each break. */
function Axis({
  timeline,
  scale,
  showCe,
  words,
}: {
  timeline: Timeline;
  scale: Scale;
  showCe: boolean;
  words: DateWords;
}) {
  const { ticks, breaks } = axisOf(timeline, scale, showCe, words);
  const tickX = (x: number) => (timeline.kind === "sequence" ? x - scale.unit / 2 : x) + MARGIN;
  return (
    <g className="eh-timeline-axis">
      {ticks.map((tick) => (
        <g key={`${tick.x}:${tick.main}`}>
          <line x1={tickX(tick.x)} x2={tickX(tick.x)} y1={AXIS_HEIGHT - 8} y2={AXIS_HEIGHT} />
          {tick.centred ? (
            <text x={tick.x + MARGIN} y={AXIS_HEIGHT - 16} textAnchor="middle">
              {tick.main}
            </text>
          ) : (
            <text x={tick.x + MARGIN + 3} y={AXIS_HEIGHT - 26}>
              {tick.main}
            </text>
          )}
          {tick.context && (
            <text className="eh-timeline-axis-context" x={tick.x + MARGIN + 3} y={AXIS_HEIGHT - 12}>
              {tick.context}
            </text>
          )}
        </g>
      ))}
      {breaks.map((gap) => (
        <g key={gap.x} className="eh-timeline-break-label">
          <text x={gap.x + MARGIN - 2} y={AXIS_HEIGHT - 12} textAnchor="end">
            {gap.before}
          </text>
          <text x={gap.x + gap.width + MARGIN + 2} y={AXIS_HEIGHT - 12}>
            {gap.after}
          </text>
        </g>
      ))}
    </g>
  );
}

/** An entry's mark: a dot (hollow and dashed when approximate) or a bar, and the faint period of a partial date. */
function Mark({ placed, top, scale, selected }: { placed: PlacedEntry; top: number; scale: Scale; selected: boolean }) {
  const y = top + MARK_Y;
  const { entry, extent } = placed;
  const approximate = (point: TimelinePoint | null) => point !== null && "approximate" in point && point.approximate;
  const band =
    extent.band && xOf(scale, extent.band[1]) - xOf(scale, extent.band[0]) >= 4 ? (
      <rect
        className="eh-timeline-band"
        x={xOf(scale, extent.band[0]) + MARGIN}
        y={y - 7}
        width={xOf(scale, extent.band[1]) - xOf(scale, extent.band[0])}
        height={14}
      />
    ) : null;
  if (extent.marker !== null) {
    return (
      <g data-selected={selected ? "true" : undefined}>
        {band}
        <circle
          className={approximate(entry.start) ? "eh-timeline-dot eh-timeline-approximate" : "eh-timeline-dot"}
          cx={placed.x1 + MARGIN}
          cy={y}
          r={5}
        />
      </g>
    );
  }
  return (
    <g data-selected={selected ? "true" : undefined}>
      <line
        className="eh-timeline-bar"
        x1={placed.x1 + MARGIN}
        x2={Math.max(placed.x2, placed.x1 + 2) + MARGIN}
        y1={y}
        y2={y}
      />
      {approximate(entry.start) && (
        <circle className="eh-timeline-dot eh-timeline-approximate" cx={placed.x1 + MARGIN} cy={y} r={5} />
      )}
      {approximate(entry.end) && (
        <circle className="eh-timeline-dot eh-timeline-approximate" cx={placed.x2 + MARGIN} cy={y} r={5} />
      )}
    </g>
  );
}

/**
 * A timeline drawn (jerome's drawing): time left to right (to scale in Dates, with long empty stretches
 * collapsed; one column per step in a Sequence), a lane per category in its colour and line, each entry a
 * dot or a bar with its title above it. Titles are buttons in time order: the arrow keys, Home and End move
 * between them, Enter opens one, Alt and an arrow moves it (a lane up or down, a step or a year, month or day
 * earlier or later), Delete deletes it after asking, and the Menu key or a right-click opens its menu.
 * Double-clicking an empty spot on a lane starts an entry there, as New entry does. It zooms with its
 * buttons, Ctrl+wheel and the zoom keys, and becomes a list in a narrow space.
 */
export function TimelineDrawing() {
  const view = useTimelineView();
  const { timeline, readOnly, words, showCe, selectedId, zoom } = view;
  const { t } = words;
  const { ref, width } = useWidth(960);
  const scroller = useRef<HTMLDivElement | null>(null);
  const plane = useRef<HTMLDivElement | null>(null);
  const keepCentre = useRef<number | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  // The entry just moved with the keys, which keeps the focus.
  const moving = useRef<string | null>(null);
  // Fitted Dates leave room after the axis for the labels of the last entries.
  const fitWidth = Math.max(width - NAMES_WIDTH - MARGIN * 2 - (timeline.kind === "dates" ? MAX_LABEL_WIDTH : 0), 200);
  const scale = useMemo(() => scaleOf(timeline, fitWidth, zoom), [timeline, fitWidth, zoom]);
  const lanes = useMemo(() => (scale ? lanesOf(timeline, scale, AXIS_HEIGHT) : []), [timeline, scale]);
  const canAdd =
    !readOnly && timeline.categories.length > 0 && (timeline.kind === "dates" || timeline.steps.length > 0);

  // After a zoom, the time that was in the middle of the view stays there.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (keepCentre.current === null || !element || !scale) return;
    element.scrollLeft = Math.max(0, xOf(scale, keepCentre.current) + MARGIN - element.clientWidth / 2);
    keepCentre.current = null;
  }, [scale]);

  // A moved entry's title keeps the focus, wherever it is drawn now.
  // biome-ignore lint/correctness/useExhaustiveDependencies: after each change of the timeline only.
  useEffect(() => {
    const id = moving.current;
    moving.current = null;
    const button = id ? buttons.current.get(id) : undefined;
    if (button && document.activeElement !== button) button.focus();
  }, [timeline]);

  const newButton = !readOnly && (
    <Button disabled={!canAdd} data-new-entry="" onClick={(event) => view.newEntry(event.currentTarget)}>
      {t("timeline.newEntry")}
    </Button>
  );
  const needs =
    !readOnly && !canAdd ? (
      <Notice>{t(timeline.categories.length === 0 ? "timeline.needCategory" : "timeline.needStep")}</Notice>
    ) : null;

  if (width > 0 && width < NARROW)
    return (
      <div ref={ref} className="eh-timeline-drawing-wrap">
        {newButton && <div className="eh-timeline-tools">{newButton}</div>}
        {needs}
        <TimelineNarrowList />
      </div>
    );
  if (!scale) {
    return (
      <div ref={ref} className="eh-timeline-drawing-wrap">
        {newButton && <div className="eh-timeline-tools">{newButton}</div>}
        {needs}
        <Notice>{t(timeline.kind === "sequence" ? "timeline.drawingNoSteps" : "timeline.drawingEmpty")}</Notice>
      </div>
    );
  }
  const current = scale;

  function setZoom(next: number) {
    const element = scroller.current;
    if (element) keepCentre.current = valueAt(current, element.scrollLeft + element.clientWidth / 2 - MARGIN);
    view.setZoom(Math.min(Math.max(next, 1), current.maxZoom));
  }

  const ordered = lanes
    .flatMap((lane) => lane.entries.map((placed) => ({ placed, lane })))
    .sort((a, b) => a.placed.x1 - b.placed.x1 || a.lane.top - b.lane.top || a.placed.row - b.placed.row);
  const last = lanes.at(-1);
  const height = last ? last.top + last.height : AXIS_HEIGHT;
  // Wide enough for the last labels, which may reach past the end of the axis.
  const planeWidth = Math.max(
    scale.width + MARGIN * 2,
    ...ordered.map(({ placed }) => placed.labelX + placed.labelWidth + MARGIN * 2),
  );

  function focusAt(index: number) {
    const next = ordered[Math.min(Math.max(index, 0), ordered.length - 1)];
    if (next) buttons.current.get(next.placed.entry.id)?.focus();
  }

  /** Moves an entry with Alt and an arrow, and says where it went. */
  function move(entry: TimelineEntry, way: "lane" | "time", by: number) {
    const edit = way === "lane" ? moveEntryToLane : shiftEntry;
    const tried = edit(timeline, entry.id, by);
    // At the first or last lane or step there is nowhere to go: nothing happens, as in a list.
    if (!tried.ok && tried.reason === "limit") return;
    moving.current = entry.id;
    if (!view.change((now) => edit(now, entry.id, by)) || !tried.ok) return;
    const moved = tried.value.entries.find((each) => each.id === entry.id)!;
    const place =
      way === "lane"
        ? (tried.value.categories.find((category) => category.id === moved.categoryId)?.name ?? "")
        : formatWhen(moved, tried.value, showCe, words);
    view.announce(t("timeline.movedTo", { title: moved.title, place }));
  }

  function key(event: KeyboardEvent<HTMLButtonElement>, entry: TimelineEntry, index: number) {
    const action = actionOf(event.nativeEvent, KEYS);
    const editing = !readOnly;
    const steps: Partial<Record<string, () => void>> = {
      focusLeft: () => focusAt(index - 1),
      focusUp: () => focusAt(index - 1),
      focusRight: () => focusAt(index + 1),
      focusDown: () => focusAt(index + 1),
      focusFirst: () => focusAt(0),
      focusLast: () => focusAt(ordered.length - 1),
      rename: () => view.openEntry(entry.id, event.currentTarget),
      menu: () => view.openMenu(entry.id, placeBelow(event.currentTarget), event.currentTarget),
      ...(editing && {
        moveUp: () => move(entry, "lane", -1),
        moveDown: () => move(entry, "lane", 1),
        moveLeft: () => move(entry, "time", -1),
        moveRight: () => move(entry, "time", 1),
        delete: () => view.askDelete(entry.id, event.currentTarget),
      }),
    };
    const run = action ? steps[action] : undefined;
    if (!run) return;
    event.preventDefault();
    run();
  }

  function addAt(event: MouseEvent, lane: Lane) {
    if (!canAdd) return;
    const box = plane.current?.getBoundingClientRect();
    const point = pointAt(timeline, current, event.clientX - (box?.left ?? 0) - MARGIN);
    if (point) view.newEntry(null, { categoryId: lane.category.id, start: point });
  }

  const shortcuts = ariaKeyShortcuts(
    readOnly ? ["focusLeft", "focusRight"] : ["focusLeft", "focusRight", "moveUp", "moveDown", "moveLeft", "moveRight"],
  );

  return (
    <div ref={ref} className="eh-timeline-drawing-wrap">
      <div className="eh-timeline-tools">
        <fieldset className="eh-group eh-timeline-zoom" aria-label={t("timeline.zoom")}>
          <Button disabled={zoom <= 1} onClick={() => setZoom(zoom / ZOOM_STEP)}>
            {t("timeline.zoomOut")}
          </Button>
          <Button disabled={zoom >= scale.maxZoom} onClick={() => setZoom(zoom * ZOOM_STEP)}>
            {t("timeline.zoomIn")}
          </Button>
          <Button disabled={zoom <= 1} onClick={() => setZoom(1)}>
            {t("timeline.zoomFit")}
          </Button>
        </fieldset>
        {newButton}
      </div>
      {needs}
      <Notice>{t(readOnly ? "timeline.drawingHelpReadOnly" : "timeline.drawingHelp")}</Notice>
      <div className="eh-timeline-drawing" data-area="drawing" style={{ height: height + 16 }}>
        <div className="eh-timeline-lane-names" style={{ width: NAMES_WIDTH }}>
          {lanes.map((lane) => (
            <div key={lane.category.id} style={{ top: lane.top, height: lane.height }}>
              <CategorySwatch category={lane.category} /> <span>{lane.category.name}</span>
            </div>
          ))}
        </div>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: the drawing's scroll area: Ctrl+wheel zooms, and the zoom keys from the entries inside it; the entries are the controls. */}
        <div
          className="eh-timeline-scroll"
          ref={scroller}
          tabIndex={-1}
          onWheel={(event: WheelEvent) => {
            if (!event.ctrlKey) return;
            event.preventDefault();
            setZoom(event.deltaY < 0 ? zoom * ZOOM_STEP : zoom / ZOOM_STEP);
          }}
          onKeyDown={(event) => {
            const action = actionOf(event.nativeEvent, KEYS);
            const next = action === "zoomIn" ? zoom * ZOOM_STEP : action === "zoomOut" ? zoom / ZOOM_STEP : 1;
            if (action !== "zoomIn" && action !== "zoomOut" && action !== "zoomFit") return;
            event.preventDefault();
            setZoom(next);
          }}
        >
          <div className="eh-timeline-plane" ref={plane} style={{ width: planeWidth, height }}>
            <svg width={planeWidth} height={height} aria-hidden="true">
              {scale.segments
                .filter((segment) => segment.collapsed)
                .map((segment) => (
                  <g key={segment.x} className="eh-timeline-break">
                    <rect x={segment.x + MARGIN} y={0} width={segment.width} height={height} />
                    <path d={`M ${segment.x + MARGIN + 8} ${AXIS_HEIGHT - 4} l 6 -6 l 6 12 l 6 -6`} />
                  </g>
                ))}
              <Axis timeline={timeline} scale={scale} showCe={showCe} words={words} />
              {lanes.map((lane) => (
                <g
                  key={lane.category.id}
                  className="eh-timeline-lane"
                  style={{
                    stroke: `var(--eh-colour-${lane.category.colour})`,
                    fill: `var(--eh-colour-${lane.category.colour})`,
                  }}
                >
                  <line
                    className="eh-timeline-lane-line"
                    x1={MARGIN}
                    x2={planeWidth - MARGIN}
                    y1={lane.top + LANE_PADDING + MARK_Y}
                    y2={lane.top + LANE_PADDING + MARK_Y}
                    strokeDasharray={DASHES[lane.category.line]}
                  />
                  {lane.entries.map((placed) => (
                    <g
                      key={placed.entry.id}
                      strokeDasharray={placed.extent.marker === null ? DASHES[lane.category.line] : undefined}
                    >
                      <Mark
                        placed={placed}
                        top={lane.top + LANE_PADDING + placed.row * ROW_HEIGHT}
                        scale={scale}
                        selected={placed.entry.id === selectedId}
                      />
                    </g>
                  ))}
                </g>
              ))}
            </svg>
            {lanes.map((lane) => (
              <div
                key={lane.category.id}
                className="eh-timeline-lane-hit"
                aria-hidden="true"
                data-category={lane.category.id}
                style={{ top: lane.top, height: lane.height }}
                onDoubleClick={(event) => addAt(event, lane)}
              />
            ))}
            {ordered.map(({ placed, lane }, index) => (
              <Button
                key={placed.entry.id}
                variant="quiet"
                className="eh-timeline-label"
                data-entry={placed.entry.id}
                ref={(element) => {
                  if (element) buttons.current.set(placed.entry.id, element);
                  else buttons.current.delete(placed.entry.id);
                }}
                aria-label={accessibleName(placed.entry, lane, view)}
                aria-keyshortcuts={shortcuts}
                title={placed.entry.title}
                aria-current={placed.entry.id === selectedId ? "true" : undefined}
                style={{
                  left: Math.max(placed.labelX + MARGIN, 0),
                  top: lane.top + LANE_PADDING + placed.row * ROW_HEIGHT,
                  maxWidth: placed.labelWidth,
                  height: LABEL_HEIGHT,
                }}
                onClick={(event) => view.openEntry(placed.entry.id, event.currentTarget)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  view.openMenu(placed.entry.id, { left: event.clientX, top: event.clientY }, event.currentTarget);
                }}
                onKeyDown={(event) => key(event, placed.entry, index)}
              >
                {placed.entry.title}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
