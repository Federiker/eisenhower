import type { DocumentKind } from "../storage/document";
import { type Board, boardProblems, boardSchema } from "./schema";

/** A board as a stored document: kind "board", version 1, checked by its schema and {@link boardProblems}. */
export const boardDocument: DocumentKind<Board> = {
  kind: "board",
  version: 1,
  schema: boardSchema,
  problems: boardProblems,
};
