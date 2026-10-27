import type { MessageKey } from "../strings/en-GB";

/** A palette colour: the message that names it, and its tones in the light and dark themes. */
export type PaletteColour = { readonly name: MessageKey; readonly light: string; readonly dark: string };

/**
 * The eight palette colours (decision 5): the Okabe–Ito colours (colour-blind safe), each in a tone for the
 * light theme and one for the dark, moved only in lightness (OKLab) until a line reaches 3:1 against every
 * background it is drawn on; black is drawn mid-grey in the dark theme. Jerome's timeline palette. The
 * stylesheet holds the same tones as `--eh-colour-0` to `--eh-colour-7`; a model's colour is an index here.
 */
export const PALETTE = [
  { name: "common.colour.orange", light: "#b97500", dark: "#e69f00" },
  { name: "common.colour.skyBlue", light: "#288dc0", dark: "#56b4e9" },
  { name: "common.colour.bluishGreen", light: "#00966c", dark: "#16a479" },
  { name: "common.colour.yellow", light: "#938500", dark: "#f0e442" },
  { name: "common.colour.blue", light: "#0072b2", dark: "#3b97da" },
  { name: "common.colour.vermilion", light: "#d55e00", dark: "#e66e22" },
  { name: "common.colour.reddishPurple", light: "#bb6a98", dark: "#cc79a7" },
  { name: "common.colour.black", light: "#000000", dark: "#9a9a9a" },
] as const satisfies readonly PaletteColour[];

/**
 * A palette colour as CSS, following the theme (and forced colours): `var(--eh-colour-3)`. Throws a RangeError
 * for an index outside the palette: a model's colours are validated before they are drawn.
 */
export function colourVar(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= PALETTE.length) {
    throw new RangeError(`No palette colour ${index}: the palette has ${PALETTE.length}.`);
  }
  return `var(--eh-colour-${index})`;
}
