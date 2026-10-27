import { z } from "zod";

/** The number of palette colours (decision 5): the Okabe–Ito colours, drawn by `@eisenhower/react`. */
export const PALETTE_SIZE = 8;

/** A palette colour by its index, or null for none. */
export const colourSchema = z
  .number()
  .int()
  .min(0)
  .max(PALETTE_SIZE - 1)
  .nullable();

export type Colour = z.infer<typeof colourSchema>;
