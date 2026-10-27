import { PALETTE_SIZE } from "@eisenhower/model";
import { describe, expect, it } from "vitest";

import { colourVar, createTranslate, PALETTE } from "../../../src";

describe("the palette", () => {
  it("has the model's eight Okabe–Ito colours, each named, in a light and a dark tone", () => {
    expect(PALETTE).toHaveLength(PALETTE_SIZE);
    const t = createTranslate();
    expect(PALETTE.map((colour) => t(colour.name))).toEqual([
      "Orange",
      "Sky blue",
      "Bluish green",
      "Yellow",
      "Blue",
      "Vermilion",
      "Reddish purple",
      "Black",
    ]);
    for (const colour of PALETTE) {
      expect(colour.light).toMatch(/^#[0-9a-f]{6}$/);
      expect(colour.dark).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("gives a colour as its theme variable, and refuses one outside the palette", () => {
    expect(colourVar(0)).toBe("var(--eh-colour-0)");
    expect(colourVar(7)).toBe("var(--eh-colour-7)");
    expect(() => colourVar(8)).toThrow(RangeError);
    expect(() => colourVar(-1)).toThrow(RangeError);
    expect(() => colourVar(1.5)).toThrow(RangeError);
  });
});
