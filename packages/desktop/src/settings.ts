import type { Theme } from "@eisenhower/react";

/** Where the window keeps its settings, in its `localStorage`. */
export const SETTINGS_KEY = "eisenhower-desktop:settings";

/** The window's own settings: the theme and the locale dates and numbers are written in. */
export type Settings = { theme: Theme; locale: string };

export const DEFAULT_SETTINGS: Settings = { theme: "system", locale: "en-GB" };

/** The locales offered, each named in its own language. */
export const LOCALES = [
  { id: "en-GB", label: "English (United Kingdom)" },
  { id: "en-US", label: "English (United States)" },
  { id: "it-IT", label: "Italiano (Italia)" },
  { id: "de-DE", label: "Deutsch (Deutschland)" },
] as const;

const THEMES: readonly Theme[] = ["system", "light", "dark"];

/**
 * The settings kept in `storage`. They are preferences, not documents: one that is missing or not one of the
 * choices (an older app's, a hand-edited one) is the default, and nothing else is lost.
 */
export function readSettings(storage: Pick<Storage, "getItem"> | undefined): Settings {
  try {
    const kept: unknown = JSON.parse(storage?.getItem(SETTINGS_KEY) ?? "null");
    if (typeof kept !== "object" || kept === null) return DEFAULT_SETTINGS;
    const { theme, locale } = kept as Partial<Record<keyof Settings, unknown>>;
    return {
      theme: THEMES.find((one) => one === theme) ?? DEFAULT_SETTINGS.theme,
      locale: LOCALES.find((one) => one.id === locale)?.id ?? DEFAULT_SETTINGS.locale,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Keeps the settings in `storage`; false when they could not be written. */
export function writeSettings(storage: Pick<Storage, "setItem"> | undefined, settings: Settings): boolean {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return storage !== undefined;
  } catch {
    return false;
  }
}
