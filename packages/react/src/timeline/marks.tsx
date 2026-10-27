import type { TimelinePoint } from "@eisenhower/model";

import { MARK_Y, type PlacedEntry } from "./layout";
import { type Scale, xOf } from "./scale";

/** The room left of the axis on the drawing, and right of it. */
export const MARGIN = 24;
/** The dashes of each kind of lane line. */
export const DASHES = { solid: undefined, dashed: "8 5", dotted: "2 5" } as const;

/** An entry's mark: a dot (hollow and dashed when approximate) or a bar, and the faint period of a partial date. */
export function Mark({
  placed,
  top,
  scale,
  selected,
}: {
  placed: PlacedEntry;
  top: number;
  scale: Scale;
  selected: boolean;
}) {
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
