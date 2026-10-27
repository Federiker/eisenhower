import { boardGroups } from "./edit";
import type { Board } from "./schema";

/** A way the focus moves between a board's cards, as the arrow keys, Home and End ask (decision 8). */
export type BoardDirection = "up" | "down" | "left" | "right" | "first" | "last";

/**
 * The card the focus goes to from this card, or null when there is none that way. Up and down stay in the
 * column; first and last go to its first and last card; left and right go to the nearest column that has
 * cards, to the card at the same place (or its last card when it has fewer). Copied from jerome's plot board
 * (services/plot-board.ts).
 */
export function boardNeighbour(board: Board, id: string, direction: BoardDirection): string | null {
  const columns = boardGroups(board)
    .map((group) => group.cards)
    .filter((cards) => cards.length > 0);
  const column = columns.findIndex((cards) => cards.some((card) => card.id === id));
  if (column < 0) return null;
  const cards = columns[column]!;
  const index = cards.findIndex((card) => card.id === id);
  const at = (list: typeof cards, place: number) => list[Math.max(0, Math.min(list.length - 1, place))]!.id;
  switch (direction) {
    case "up":
      return index > 0 ? cards[index - 1]!.id : null;
    case "down":
      return index < cards.length - 1 ? cards[index + 1]!.id : null;
    case "first":
      return index > 0 ? cards[0]!.id : null;
    case "last":
      return index < cards.length - 1 ? cards.at(-1)!.id : null;
    case "left":
      return column > 0 ? at(columns[column - 1]!, index) : null;
    case "right":
      return column < columns.length - 1 ? at(columns[column + 1]!, index) : null;
  }
}
