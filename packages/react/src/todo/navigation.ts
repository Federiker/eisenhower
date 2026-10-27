import { type Quadrant, quadrantToward } from "@eisenhower/model";

/** The keys that move the focus between items. */
export type FocusAction = "focusUp" | "focusDown" | "focusLeft" | "focusRight" | "focusFirst" | "focusLast";

/**
 * The item a key takes the focus to in the list, from `id` among the shown items (`ids`, in order), or null
 * when there is none that way: up and down to the item before or after, Home and End to the first and last.
 */
export function listNeighbour(ids: readonly string[], id: string, action: FocusAction): string | null {
  const index = ids.indexOf(id);
  if (index < 0) return null;
  const to =
    action === "focusUp"
      ? index - 1
      : action === "focusDown"
        ? index + 1
        : action === "focusFirst"
          ? 0
          : action === "focusLast"
            ? ids.length - 1
            : -1;
  return to === index ? null : (ids[to] ?? null);
}

/**
 * The item a key takes the focus to in the matrix, from `id` in its quadrant's items (`quadrants`), or null:
 * up and down within the quadrant and on to the quadrant above or below (its last or first item), left and
 * right to the quadrant beside (the item at the same place, or its last), Home and End to the quadrant's
 * first and last.
 */
export function matrixNeighbour(
  quadrants: Readonly<Record<Quadrant, readonly string[]>>,
  id: string,
  action: FocusAction,
): string | null {
  const quadrant = (Object.keys(quadrants) as Quadrant[]).find((one) => quadrants[one].includes(id));
  if (!quadrant) return null;
  const ids = quadrants[quadrant];
  const index = ids.indexOf(id);
  const beyond = (way: "up" | "down" | "left" | "right") => {
    const next = quadrantToward(quadrant, way);
    const items = next ? quadrants[next] : [];
    if (items.length === 0) return null;
    if (way === "up") return items.at(-1)!;
    if (way === "down") return items[0]!;
    return items[Math.min(index, items.length - 1)]!;
  };
  switch (action) {
    case "focusUp":
      return index > 0 ? ids[index - 1]! : beyond("up");
    case "focusDown":
      return index < ids.length - 1 ? ids[index + 1]! : beyond("down");
    case "focusLeft":
      return beyond("left");
    case "focusRight":
      return beyond("right");
    default:
      return listNeighbour(ids, id, action);
  }
}
