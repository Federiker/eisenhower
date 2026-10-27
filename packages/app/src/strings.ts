/**
 * The demo app's own interface text, in UK English (the views' text is in @eisenhower/react). `{name}` and the
 * like are filled in by {@link fill}.
 */
export const appStrings = {
  title: "Eisenhower",
  subtitle: "Planning views for React and Tauri",
  views: "Views",
  board: "Board",
  timeline: "Timeline",
  gantt: "Gantt",
  todo: "Todo",
  settings: "Settings",
  theme: "Theme",
  themeSystem: "System",
  themeLight: "Light",
  themeDark: "Dark",
  locale: "Dates and numbers",
  undo: "Undo",
  redo: "Redo",
  documentActions: "Document",
  boardLayout: "Layout",
  layoutBoard: "Board",
  layoutList: "List",
  whichTimeline: "Timeline shown",

  // The samples' names: the documents the app starts with.
  sampleBoard: "Moving house",
  sampleDates: "History of science",
  sampleSequence: "The lighthouse",
  sampleGantt: "Garden weather station",
  sampleTodo: "This week",

  // The browser: each document kept in this browser's storage, saved as it changes.
  reset: "Reset to the sample",
  resetDone: "{name}: back to the sample.",
  savedHere: "Saved in this browser",
  saving: "Saving…",
  notSavedHere: "Not saved",
  changedElsewhereTitle: "Changed in another tab",
  changedElsewhere:
    "{name} was changed in another tab or window since this one read it. Overwrite it with this one? The other changes will be lost.",

  // The desktop app: files on disk.
  open: "Open…",
  save: "Save",
  saveAs: "Save as…",
  sample: "Open the sample",
  unsaved: "Unsaved changes",
  opened: "Opened {name}.",
  saved: "Saved {name}.",
  notSaved: "Not saved.",
  documentFiles: "Eisenhower documents",
  changedOnDiskTitle: "The file has changed",
  changedOnDisk:
    "{name} was changed by another program since it was opened. Overwrite it with this one? The other program's changes will be lost.",
  overwrite: "Overwrite",
  cancel: "Cancel",
  discardTitle: "Unsaved changes",
  discard: "{name} has changes that are not saved. Discard them?",
  discardOk: "Discard",

  // Failures, in words; the systems' own details go to the console, never here.
  openFailed: "{name} could not be opened.",
  saveFailed: "{name} could not be saved.",
  storedUnreadable:
    "The stored copy of {name} could not be read. {problem} The sample is shown; Reset to the sample to replace the stored copy.",
  notFound: "{name} is no longer there.",

  /** Why a text is not a document of the view's kind (`DocumentError`'s problem). */
  documentProblems: {
    notJson: "It is not JSON.",
    notEisenhower: "It is not an Eisenhower document.",
    wrongKind: "It is a document of another view; open it on that view's tab.",
    newerVersion: "It was written by a newer version of Eisenhower.",
    invalid: "It does not follow the rules of its kind of document.",
  },

  /** Why storage failed (`StorageError`'s problem), when the plugin has no code of its own to say it. */
  storageProblems: {
    changed: "{name} was changed elsewhere, so it was not overwritten.",
    readFailed: "{name} could not be read.",
    writeFailed: "{name} could not be saved; what was stored is as it was.",
    unavailable: "This browser does not let the app keep documents.",
  },

  /** The desktop app's errors, by the code `@eisenhower/tauri` gives them. */
  errors: {
    read_failed: "{name} could not be read.",
    not_text: "{name} is not a text file.",
    write_failed: "{name} could not be written; the file is as it was.",
    changed_on_disk: "{name} was changed by another program, so it was not overwritten.",
    invalid_request: "The app asked for something the plugin could not understand.",
    internal: "The work could not be finished.",
    invalid_response: "The plugin gave an answer the app did not expect.",
    unknown: "The app could not do that.",
  },
} as const;

/** A message with its `{placeholders}` filled in; a value that is missing leaves its placeholder. */
export function fill(message: string, values: Readonly<Record<string, string | number>>): string {
  return message.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    key in values ? String(values[key]) : placeholder,
  );
}
