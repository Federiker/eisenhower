import {
  type Board,
  type BoardCard,
  characterCount,
  MAX_NAME_LENGTH,
  MAX_SUMMARY_LENGTH,
  PALETTE_SIZE,
} from "@eisenhower/model";

/** A card as typed in its dialog: the column's id or "" for none, the colour's index or "" for none. */
export type CardDraft = { title: string; summary: string; columnId: string; colour: string };

/** Why a card as typed cannot be saved yet. */
export type CardProblem = "titleBlank" | "titleTooLong" | "summaryTooLong" | "column" | "colour";

/** The dialog's values for a card. */
export function cardDraft(card: BoardCard): CardDraft {
  return {
    title: card.title,
    summary: card.summary,
    columnId: card.columnId ?? "",
    colour: card.colour === null ? "" : String(card.colour),
  };
}

/**
 * The card the dialog describes, or why it cannot be saved yet (every problem at once): a trimmed title, a
 * summary on one line, a column still on the board, a palette colour. Copied from jerome's plot-beats.ts.
 */
export function cardFromDraft(
  draft: CardDraft,
  id: string,
  board: Board,
): { card: BoardCard } | { problems: CardProblem[] } {
  const problems: CardProblem[] = [];
  const title = draft.title.trim();
  if (title === "") problems.push("titleBlank");
  else if (characterCount(title) > MAX_NAME_LENGTH) problems.push("titleTooLong");
  const summary = draft.summary.replace(/[\r\n]+/g, " ").trim();
  if (characterCount(summary) > MAX_SUMMARY_LENGTH) problems.push("summaryTooLong");
  if (draft.columnId !== "" && !board.columns.some((column) => column.id === draft.columnId)) problems.push("column");
  const colour = draft.colour === "" ? null : Number(draft.colour);
  if (colour !== null && !(Number.isInteger(colour) && colour >= 0 && colour < PALETTE_SIZE)) problems.push("colour");
  if (problems.length > 0) return { problems };
  return { card: { id, title, columnId: draft.columnId === "" ? null : draft.columnId, summary, colour } };
}
