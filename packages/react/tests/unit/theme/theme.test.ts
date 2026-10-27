/// <reference types="node" />
// The stylesheets are read as text: the test DOM does not load CSS.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { PALETTE } from "../../../src";

const sources = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src");
const read = (path: string) => readFileSync(join(sources, path), "utf8");
const theme = read("theme/theme.css");
const style = read("style.css");
const controls = ["buttons", "dialog", "editing", "fields", "group", "menu", "notices", "question"].map((name) =>
  read(`controls/styles/${name}.css`),
);

/** The custom properties a block of the theme sets, by the selector that opens it. */
function block(selector: string): Map<string, string> {
  const start = theme.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  const body = theme.slice(theme.indexOf("{", start) + 1, theme.indexOf("}", start));
  return new Map([...body.matchAll(/(--eh-[\w-]+):\s*([^;]+);/g)].map((match) => [match[1]!, match[2]!.trim()]));
}

describe("the theme", () => {
  it("draws the palette's light tones by default and its dark tones in the dark theme", () => {
    const light = block(".eh-root");
    const dark = block('.eh-root[data-theme="dark"]');
    const system = block('.eh-root:not([data-theme="light"])');
    PALETTE.forEach((colour, index) => {
      expect(light.get(`--eh-colour-${index}`)).toBe(colour.light);
      expect(dark.get(`--eh-colour-${index}`)).toBe(colour.dark);
    });
    // The system's dark theme and the chosen one are the same.
    expect(system).toEqual(dark);
  });

  it("sets every colour in the dark theme and in forced colours that it sets in the light one", () => {
    const light = block(".eh-root");
    const dark = block('.eh-root[data-theme="dark"]');
    const forced = block(".eh-root,\n  .eh-root[data-theme]");
    const colours = [...light.keys()].filter((name) => light.get(name)!.startsWith("#")).sort();
    expect([...dark.keys()].sort()).toEqual(colours);
    expect([...forced.keys()].sort()).toEqual(colours);
    expect(theme).toMatch(/@media \(prefers-color-scheme: dark\)/);
    expect(theme).toMatch(/@media \(forced-colors: active\)/);
  });

  it("defines every variable the controls' styles use", () => {
    const defined = new Set(block(".eh-root").keys());
    for (const css of controls) {
      for (const [, name] of css.matchAll(/var\((--[\w-]+)/g)) expect(defined, name).toContain(name);
    }
  });

  it("is one stylesheet that imports the theme first, then the controls", () => {
    const imports = [...style.matchAll(/@import "([^"]+)"/g)].map((match) => match[1]);
    expect(imports[0]).toBe("./theme/theme.css");
    expect(imports).toContain("./controls/styles/menu.css");
  });
});
