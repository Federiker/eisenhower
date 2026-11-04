import { tauriStorage } from "@eisenhower/tauri";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask, message, open, save } from "@tauri-apps/plugin-dialog";

import { fill, appStrings as text } from "../strings";
import { type CloseChoice, mayClose } from "./closing";
import type { Host, Question } from "./host";
import { DOCUMENT_EXTENSION } from "./names";

const FILTERS = [{ name: text.documentFiles, extensions: [DOCUMENT_EXTENSION] }];

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
    chooseFile: () => open({ multiple: false, directory: false, filters: FILTERS }),
    chooseNewFile: (suggested) => save({ defaultPath: suggested, filters: FILTERS }),
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
  };
}
