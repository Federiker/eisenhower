import { tauriStorage } from "@eisenhower/tauri";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask, message, open, save } from "@tauri-apps/plugin-dialog";

import { fill, appStrings as text } from "../strings";
import { type CloseChoice, mayClose } from "./closing";
import type { Host, Question } from "./host";
import { DOCUMENT_EXTENSION, OPEN_EXTENSIONS } from "./names";

/** Open… takes the app's .ike documents and the .json ones saved before; Save as… and new documents are .ike. */
const OPEN_FILTERS = [{ name: text.documentFiles, extensions: [...OPEN_EXTENSIONS] }];
const SAVE_FILTERS = [{ name: text.documentFiles, extensions: [DOCUMENT_EXTENSION] }];

/** The event a document given to the app while the window listens arrives by (the crate's `launch.rs`). */
export const LAUNCH_FILE_EVENT = "eisenhower://launch-file";

const askQuestion = ({ title, message, ok, cancel }: Question) =>
  ask(message, { title, kind: "warning", okLabel: ok, cancelLabel: cancel });

/**
 * Asks what to do with unsaved changes as the window closes, with the dialog plugin's three buttons. The
 * answer is the label of the button pressed (or the default one's name); anything else, such as closing the
 * question, is Cancel.
 */
async function askToSave(name: string): Promise<CloseChoice> {
  const buttons = { yes: text.closeSave, no: text.closeDiscard, cancel: text.cancel };
  const answer = await message(fill(text.closeOne, { name }), { title: text.closeTitle, kind: "warning", buttons });
  if (answer === buttons.yes || answer === "Yes") return "save";
  if (answer === buttons.no || answer === "No") return "discard";
  return "cancel";
}

/**
 * The Tauri window: documents read and written as files through `tauri-plugin-eisenhower` (`tauriStorage`,
 * whose revision is the file's hash), chosen with Tauri's dialog plugin. Closing the window with unsaved
 * changes asks first whether to save them.
 */
export function tauriHost(): Host {
  return {
    kind: "tauri",
    storage: tauriStorage(),
    chooseFile: () => open({ multiple: false, directory: false, filters: OPEN_FILTERS }),
    chooseNewFile: (suggested) => save({ defaultPath: suggested, filters: SAVE_FILTERS }),
    ask: askQuestion,
    setTitle: (title) => getCurrentWindow().setTitle(title),
    guardClose: (unsaved, failed) => {
      let asking = false;
      return getCurrentWindow().onCloseRequested(async (event) => {
        // A second close while the question is open waits for its answer.
        if (asking) return event.preventDefault();
        asking = true;
        try {
          if (!(await mayClose(unsaved(), askToSave))) event.preventDefault();
        } catch (error) {
          event.preventDefault();
          failed(error);
        } finally {
          asking = false;
        }
      });
    },
    // Listening first, then taking the document the app started with: one given in between is sent as an event.
    launched: async (openPath) => {
      const stop = await listen<string>(LAUNCH_FILE_EVENT, (event) => openPath(event.payload));
      try {
        const waiting = await invoke<string | null>("launch_file_take");
        if (waiting !== null) openPath(waiting);
      } catch (error) {
        stop();
        throw error;
      }
      return stop;
    },
  };
}
