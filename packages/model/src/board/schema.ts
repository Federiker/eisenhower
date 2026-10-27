import { z } from "zod";

import { idSchema } from "../common/ids";
import { colourSchema } from "../common/palette";
import { MAX_SUMMARY_LENGTH, nameFits, oneLineFits } from "../common/text";

/** The most columns a board has (jerome's plot parts). */
export const MAX_BOARD_COLUMNS = 50;
/** The most cards a board has (jerome's plot beats). */
export const MAX_BOARD_CARDS = 500;

/** A column of a board (To do, Doing… or Act 1, Act 2…), in the order the user gave. Names may repeat. */
export const boardColumnSchema = z
  .object({
    id: idSchema,
    name: z.string().refine((name) => nameFits(name), "A column's name is 1 to 120 characters."),
  })
  .strict();

export type BoardColumn = z.infer<typeof boardColumnSchema>;

/** A card of a board; within a column, cards keep the order of the board's list. */
export const boardCardSchema = z
  .object({
    id: idSchema,
    title: z.string().refine((title) => nameFits(title), "A card's title is 1 to 120 characters."),
    /** The column it is in; null for a card outside every column (shown in a column of its own, first). */
    columnId: idSchema.nullable(),
    /** One line; may be empty. */
    summary: z
      .string()
      .refine((text) => oneLineFits(text, MAX_SUMMARY_LENGTH), "A summary is one line of up to 500 characters."),
    /** One of the palette's colours, or null for none. */
    colour: colourSchema,
  })
  .strict();

export type BoardCard = z.infer<typeof boardCardSchema>;

/**
 * A board (decision 15): its columns and its cards, each in order. A card's column is its `columnId`, so the
 * cards of a column are the board's cards with that id, in the board's order. Check the rules between them
 * with {@link boardProblems}.
 */
export const boardSchema = z
  .object({
    columns: z.array(boardColumnSchema).max(MAX_BOARD_COLUMNS),
    cards: z.array(boardCardSchema).max(MAX_BOARD_CARDS),
  })
  .strict();

export type Board = z.infer<typeof boardSchema>;

/** A board with nothing on it yet. */
export function emptyBoard(): Board {
  return { columns: [], cards: [] };
}

/** What the schema cannot say: every id used once (columns and cards alike), every card's column there. */
export function boardProblems(board: Board): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const { id } of [...board.columns, ...board.cards]) {
    if (ids.has(id)) problems.push(`The id ${id} is used more than once.`);
    ids.add(id);
  }
  const columns = new Set(board.columns.map((column) => column.id));
  for (const card of board.cards) {
    if (card.columnId !== null && !columns.has(card.columnId)) {
      problems.push(`The card ${card.id} is in a column that is not on the board.`);
    }
  }
  return problems;
}
