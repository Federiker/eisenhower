import { localStorageAdapter } from "@eisenhower/model";

import { appStrings as text } from "../strings";
import type { Host } from "./host";

/** Where the preview keeps its files, in the browser's `localStorage`, by path. */
export const PREVIEW_PREFIX = "eisenhower-desktop-preview:";

/** The folder the preview suggests for a new file. */
export const PREVIEW_FOLDER = "/Preview/";

/**
 * The app outside the Tauri window, for development, the end-to-end tests and the screenshots: its "files"
 * are kept in the browser's `localStorage` by path, and its dialogues are the page's own (`prompt` and
 * `confirm`). The page shows that it is a preview.
 */
export function previewHost(storage?: Storage): Host {
  return {
    kind: "preview",
    storage: localStorageAdapter(PREVIEW_PREFIX, storage),
    chooseFile: async () => window.prompt(text.previewOpen, PREVIEW_FOLDER) || null,
    chooseNewFile: async (suggested) => window.prompt(text.previewSave, `${PREVIEW_FOLDER}${suggested}`) || null,
    ask: async ({ title, message }) => window.confirm(`${title}\n\n${message}`),
    setTitle: async (title) => {
      document.title = title;
    },
    guardClose: undefined,
  };
}
