import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, readSettings, SETTINGS_KEY, writeSettings } from "../src/settings";

const holding = (text: string | null) => ({ getItem: (key: string) => (key === SETTINGS_KEY ? text : null) });

describe("the window's settings", () => {
  it("reads back what was kept", () => {
    const kept = new Map<string, string>();
    const storage = {
      getItem: (key: string) => kept.get(key) ?? null,
      setItem: (key: string, value: string) => void kept.set(key, value),
    };
    expect(writeSettings(storage, { theme: "dark", locale: "it-IT" })).toBe(true);
    expect(readSettings(storage)).toEqual({ theme: "dark", locale: "it-IT" });
  });

  it("takes the default for what is missing or not a choice", () => {
    expect(readSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(readSettings(holding(null))).toEqual(DEFAULT_SETTINGS);
    expect(readSettings(holding("{"))).toEqual(DEFAULT_SETTINGS);
    expect(readSettings(holding(JSON.stringify("dark")))).toEqual(DEFAULT_SETTINGS);
    expect(readSettings(holding(JSON.stringify({ theme: "pink", locale: "xx" })))).toEqual(DEFAULT_SETTINGS);
    expect(readSettings(holding(JSON.stringify({ theme: "light" })))).toEqual({ theme: "light", locale: "en-GB" });
  });

  it("says when they cannot be kept", () => {
    expect(writeSettings(undefined, DEFAULT_SETTINGS)).toBe(false);
    const full = {
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(writeSettings(full, DEFAULT_SETTINGS)).toBe(false);
  });
});
