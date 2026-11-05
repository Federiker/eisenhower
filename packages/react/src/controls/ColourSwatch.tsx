import { colourVar, PALETTE } from "../theme/palette";
import { classNames } from "./classNames";

/** Whether a value is one of the palette's colours (an index into it). */
function isPaletteColour(colour: number | null): colour is number {
  return colour !== null && Number.isInteger(colour) && colour >= 0 && colour < PALETTE.length;
}

/**
 * A palette colour as a small box, following the theme; hidden from assistive technology, so its colour's
 * name is always written beside it (in the text, or the colour picker and its list). No colour, or one outside
 * the palette, draws an empty dashed box.
 */
export function ColourSwatch({ colour, className }: { colour: number | null; className?: string }) {
  const shown = isPaletteColour(colour);
  return (
    <span
      className={classNames("eh-swatch", className)}
      aria-hidden="true"
      data-none={shown ? undefined : "true"}
      style={shown ? { background: colourVar(colour) } : undefined}
    />
  );
}

/** A colour as a form keeps it, as a colour: "" (no colour) is null, a palette index its number. */
export function menuColour(value: string): number | null {
  return value === "" ? null : Number(value);
}
