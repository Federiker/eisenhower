import { DocumentError, StorageError } from "@eisenhower/model";
import { EisenhowerPluginError, type PluginErrorCode } from "@eisenhower/tauri";

import { fill, appStrings as text } from "../strings";

/** Every code the plugin's client can give, with its message. */
const errors: Readonly<Record<PluginErrorCode, string>> = text.errors;

/** The plugin's error behind a failure, when there is one (`tauriStorage` keeps it as the cause). */
function pluginError(error: unknown): EisenhowerPluginError | null {
  if (error instanceof EisenhowerPluginError) return error;
  if (error instanceof Error && error.cause instanceof EisenhowerPluginError) return error.cause;
  return null;
}

/**
 * What to tell the user about a failure with the document called `name`: a document that is not valid with
 * its problem in words, the plugin's error from its code, a storage problem, or `fallback` for anything else.
 * The errors' details are for logs, never shown.
 */
export function messageOf(error: unknown, name: string, fallback: string): string {
  if (error instanceof DocumentError) {
    return `${fill(text.openFailed, { name })} ${text.documentProblems[error.problem]}`;
  }
  const plugin = pluginError(error);
  if (plugin) return fill(errors[plugin.code], { name });
  if (error instanceof StorageError) return fill(text.storageProblems[error.problem], { name });
  return fill(fallback, { name });
}

/** Why a stored document could not be read: a document's problem in words, else what the storage said. */
export function storedProblem(error: unknown, name: string): string {
  const problem =
    error instanceof DocumentError
      ? text.documentProblems[error.problem]
      : error instanceof StorageError
        ? fill(text.storageProblems[error.problem], { name })
        : "";
  return fill(text.storedUnreadable, { name, problem }).replace("  ", " ");
}
