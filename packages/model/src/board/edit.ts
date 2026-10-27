/**
 * The board's edit operations (decision 3): pure functions from a board to a new board, or the reason it was
 * refused. Copied from jerome's plot edits (services/plot-edit.ts), parts and beats become columns and cards.
 */
import { done, type EditResult, refused } from "../common/result";
import { characterCount, MAX_SUMMARY_LENGTH, nameProblem } from "../common/text";
import {
  type Board,
  type BoardCard,
  type BoardColumn,
  boardProblems,
  boardSchema,
  MAX_BOARD_CARDS,
  MAX_BOARD_COLUMNS,
} from "./schema";

/**
 * What happens to the cards of a column that is deleted: they move to the column before it, to the column
 * after it, out of every column, or go with it.
 */
export type ColumnDisposal = "before" | "after" | "outside" | "delete";

/** A group of cards: a column's id, or null for the cards outside every column. */
export type BoardGroup = { columnId: string | null; cards: BoardCard[] };

/** Where a card is: its group's index in {@link boardGroups} and its place in that group. */
export type CardPlace = { group: number; index: number };

/** Where a card goes: a group (null for outside every column) and a place in it. */
export type CardTarget = { columnId: string | null; index: number };

/** Where a new card goes: its column (null for none) and the card it follows there (null for the end). */
export type CardSpot = { columnId: string | null; after: string | null };

/** A step a card can take by keys or its menu: within its column, or to the column before or after. */
export type CardStep = "up" | "down" | "previousColumn" | "nextColumn";

/** The board as it is, or "invalid" when it would not pass its schema and checks (the last guard of every edit). */
export function checkedBoard(board: Board): EditResult<Board> {
  if (!boardSchema.safeParse(board).success || boardProblems(board).length > 0) return refused("invalid");
  return done(board);
}

/**
 * The cards by group, in order: those outside every column first, then each column's. Every column has a
 * group, even an empty one.
 */
export function boardGroups(board: Board): BoardGroup[] {
  return [null, ...board.columns.map((column) => column.id)].map((columnId) => ({
    columnId,
    cards: board.cards.filter((card) => card.columnId === columnId),
  }));
}

/** The board with its cards laid out again from groups (outside every column first, then column by column). */
function fromGroups(board: Board, groups: readonly BoardGroup[]): Board {
  return {
    ...board,
    cards: groups.flatMap((group) => group.cards.map((card) => ({ ...card, columnId: group.columnId }))),
  };
}

/** Where a card is in {@link boardGroups}; null when it is not on the board. */
export function cardPlace(board: Board, id: string): CardPlace | null {
  for (const [group, { cards }] of boardGroups(board).entries()) {
    const index = cards.findIndex((card) => card.id === id);
    if (index >= 0) return { group, index };
  }
  return null;
}

/** How many cards a column has. */
export function cardsInColumn(board: Board, id: string): number {
  return board.cards.filter((card) => card.columnId === id).length;
}

function idTaken(board: Board, id: string): boolean {
  return board.columns.some((column) => column.id === id) || board.cards.some((card) => card.id === id);
}

export function addColumn(board: Board, id: string, name: string): EditResult<Board> {
  const problem = nameProblem(name);
  if (problem) return refused(problem);
  if (board.columns.length >= MAX_BOARD_COLUMNS) return refused("limit");
  if (idTaken(board, id)) return refused("duplicate");
  return checkedBoard({ ...board, columns: [...board.columns, { id, name: name.trim() }] });
}

export function renameColumn(board: Board, id: string, name: string): EditResult<Board> {
  if (!board.columns.some((column) => column.id === id)) return refused("missing");
  const problem = nameProblem(name);
  if (problem) return refused(problem);
  return checkedBoard({
    ...board,
    columns: board.columns.map((column) => (column.id === id ? { ...column, name: name.trim() } : column)),
  });
}

/** Moves a column (with its cards) to another place in the order: its index after the move. */
export function moveColumn(board: Board, id: string, to: number): EditResult<Board> {
  const from = board.columns.findIndex((column) => column.id === id);
  if (from < 0) return refused("missing");
  const columns: BoardColumn[] = [...board.columns];
  const [column] = columns.splice(from, 1);
  columns.splice(Math.max(0, Math.min(columns.length, to)), 0, column!);
  return checkedBoard({ ...board, columns });
}

/**
 * Deletes a column. Its cards move to the end of the column before it or to the start of the column after it
 * (so they keep their place in the order), to the end of the cards outside every column, or are deleted with
 * it.
 */
export function deleteColumn(board: Board, id: string, disposal: ColumnDisposal): EditResult<Board> {
  const index = board.columns.findIndex((column) => column.id === id);
  if (index < 0) return refused("missing");
  const groups = boardGroups(board);
  const own = groups[index + 1]!;
  const rest = groups.filter((group) => group !== own);
  if (disposal === "before" || disposal === "after") {
    const neighbour = board.columns[disposal === "before" ? index - 1 : index + 1];
    if (!neighbour) return refused("missing");
    const target = rest.find((group) => group.columnId === neighbour.id)!;
    target.cards = disposal === "before" ? [...target.cards, ...own.cards] : [...own.cards, ...target.cards];
  } else if (disposal === "outside") {
    rest[0]!.cards = [...rest[0]!.cards, ...own.cards];
  }
  return checkedBoard(fromGroups({ ...board, columns: board.columns.filter((column) => column.id !== id) }, rest));
}

/** A new card with nothing but its title: no summary, no colour. */
export function blankCard(id: string, title: string, columnId: string | null): BoardCard {
  return { id, title, columnId, summary: "", colour: null };
}

/** Why a card's own fields cannot be kept: a blank or too long title, a summary too long or of several lines. */
function cardProblem(card: BoardCard) {
  const problem = nameProblem(card.title);
  if (problem) return problem;
  if (characterCount(card.summary) > MAX_SUMMARY_LENGTH) return "tooLong";
  return /[\r\n]/.test(card.summary) ? "invalid" : null;
}

/**
 * Where a new card goes: just after the selected card, in its column; else at the end of the last column;
 * else at the end of the cards outside every column.
 */
export function newCardSpot(board: Board, selected: string | null): CardSpot {
  const card = selected === null ? undefined : board.cards.find((one) => one.id === selected);
  if (card) return { columnId: card.columnId, after: card.id };
  return { columnId: board.columns.at(-1)?.id ?? null, after: null };
}

/**
 * Adds a card at its spot: after the card it follows when that card is still in the new card's column, else at
 * the end of the new card's column.
 */
export function addCardAt(board: Board, card: BoardCard, spot: CardSpot): EditResult<Board> {
  const group = boardGroups(board).find((one) => one.columnId === card.columnId);
  if (!group) return refused("missing");
  const after =
    card.columnId === spot.columnId && spot.after !== null ? group.cards.findIndex((one) => one.id === spot.after) : -1;
  return addCard(board, card, after >= 0 ? after + 1 : group.cards.length);
}

/** Adds a card to its column (its `columnId`) at this place in it; its title is kept trimmed. */
export function addCard(board: Board, card: BoardCard, index: number): EditResult<Board> {
  const problem = cardProblem(card);
  if (problem) return refused(problem);
  if (board.cards.length >= MAX_BOARD_CARDS) return refused("limit");
  if (idTaken(board, card.id)) return refused("duplicate");
  const groups = boardGroups(board);
  const group = groups.find((one) => one.columnId === card.columnId);
  if (!group) return refused("missing");
  group.cards = [...group.cards];
  group.cards.splice(Math.max(0, Math.min(group.cards.length, index)), 0, { ...card, title: card.title.trim() });
  return checkedBoard(fromGroups(board, groups));
}

/**
 * Replaces a card by its id (its title kept trimmed). A card that stays in its column keeps its place; one
 * given another column goes to the end of that column.
 */
export function editCard(board: Board, card: BoardCard): EditResult<Board> {
  const old = board.cards.find((one) => one.id === card.id);
  if (!old) return refused("missing");
  const problem = cardProblem(card);
  if (problem) return refused(problem);
  const next = { ...card, title: card.title.trim() };
  if (old.columnId === next.columnId) {
    return checkedBoard({ ...board, cards: board.cards.map((one) => (one.id === next.id ? next : one)) });
  }
  const groups = boardGroups(board).map((group) => ({
    ...group,
    cards: group.cards.filter((one) => one.id !== next.id),
  }));
  const target = groups.find((group) => group.columnId === next.columnId);
  if (!target) return refused("missing");
  target.cards.push(next);
  return checkedBoard(fromGroups(board, groups));
}

/** Deletes a card. */
export function deleteCard(board: Board, id: string): EditResult<Board> {
  if (!board.cards.some((card) => card.id === id)) return refused("missing");
  return checkedBoard({ ...board, cards: board.cards.filter((card) => card.id !== id) });
}

/**
 * Moves a card into a group (null: outside every column) at this place in it, counted without the card
 * itself; a place past the end is the end.
 */
export function moveCard(board: Board, id: string, columnId: string | null, index: number): EditResult<Board> {
  const card = board.cards.find((one) => one.id === id);
  if (!card) return refused("missing");
  const groups = boardGroups(board).map((group) => ({ ...group, cards: group.cards.filter((one) => one.id !== id) }));
  const target = groups.find((group) => group.columnId === columnId);
  if (!target) return refused("missing");
  target.cards.splice(Math.max(0, Math.min(target.cards.length, index)), 0, card);
  return checkedBoard(fromGroups(board, groups));
}

/** Where a card dropped on another goes: just before it, in its column; null when either is not there. */
export function placeBefore(board: Board, id: string, target: string): CardTarget | null {
  if (!board.cards.some((card) => card.id === id)) return null;
  for (const group of boardGroups(board)) {
    const index = group.cards.filter((card) => card.id !== id).findIndex((card) => card.id === target);
    if (index >= 0) return { columnId: group.columnId, index };
  }
  return null;
}

/**
 * Where a step takes a card, or null when it cannot go that way. Up and down stay within the column; the
 * column before takes it at its end and the column after at its start, so the card keeps its place in the
 * order. The cards outside every column count as the column before the first.
 */
export function cardStepTarget(board: Board, id: string, step: CardStep): CardTarget | null {
  const place = cardPlace(board, id);
  if (!place) return null;
  const groups = boardGroups(board);
  const group = groups[place.group]!;
  switch (step) {
    case "up":
      return place.index > 0 ? { columnId: group.columnId, index: place.index - 1 } : null;
    case "down":
      return place.index < group.cards.length - 1 ? { columnId: group.columnId, index: place.index + 1 } : null;
    case "previousColumn": {
      const before = groups[place.group - 1];
      return before ? { columnId: before.columnId, index: before.cards.length } : null;
    }
    case "nextColumn": {
      const after = groups[place.group + 1];
      return after ? { columnId: after.columnId, index: 0 } : null;
    }
  }
}

/** Moves a card one step ({@link cardStepTarget}); "missing" when it is not there or cannot go that way. */
export function stepCard(board: Board, id: string, step: CardStep): EditResult<Board> {
  const target = cardStepTarget(board, id, step);
  if (!target) return refused("missing");
  return moveCard(board, id, target.columnId, target.index);
}
