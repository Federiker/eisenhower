/**
 * The desktop app's own interface text, in UK English (the views' text is in @eisenhower/react). `{name}` and
 * the like are filled in by {@link fill}.
 */
export const appStrings = {
  title: "Eisenhower",
  /** The window's title while a document is open. */
  windowTitle: "{name} – Eisenhower",
  settings: "Settings",
  theme: "Theme",
  themeSystem: "System",
  themeLight: "Light",
  themeDark: "Dark",
  locale: "Dates and numbers",
  preview: "Preview: the files are kept in this browser, not on disk.",

  // The start screen.
  start: "Start",
  recent: "Recent documents",
  noRecent: "No documents opened yet. Open one, or create a new one.",
  recentOpened: "Opened {when}",
  recentUnreadable: "The list of recent documents could not be read, so it starts again.",
  recentNotKept: "The list of recent documents could not be kept.",
  open: "Open…",
  newDocument: "New document",
  newType: "Type",
  newName: "Name",
  newNameMissing: "Give the document a name.",
  create: "Create…",
  created: "Created {name}.",

  /** The types a new document can have; a timeline is of dates or of named steps. */
  types: {
    board: "Board",
    "timeline-dates": "Timeline (dates)",
    "timeline-sequence": "Timeline (sequence)",
    gantt: "Gantt chart",
    todo: "Todo list",
  },

  /** The kinds of document, as the recent list shows them. */
  kinds: {
    board: "Board",
    timeline: "Timeline",
    gantt: "Gantt chart",
    todo: "Todo list",
  },

  // A document open.
  undo: "Undo",
  redo: "Redo",
  documentActions: "Document",
  boardLayout: "Layout",
  layoutBoard: "Board",
  layoutList: "List",
  save: "Save",
  saveAs: "Save as…",
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
  closeTitle: "Unsaved changes",
  closeOne: "{name} has changes that are not saved. Save them before closing?",
  closeSave: "Save",
  closeDiscard: "Don't save",
  closeFailed: "The window could not ask about the unsaved changes, so it stays open. Save them, then close it.",
  closeUnguarded: "The window will not ask about unsaved changes when it closes; save them before closing it.",

  // The preview's dialogues, answered in the page.
  previewOpen: "The path of the document to open:",
  previewSave: "Save the document as:",

  // Failures, in words; the systems' own details go to the console, never here.
  openFailed: "{name} could not be opened.",
  saveFailed: "{name} could not be saved.",
  createFailed: "{name} could not be created.",
  notFound: "{name} is no longer there, so it is taken off the list.",

  /** Why a text is not a document (`DocumentError`'s problem). */
  documentProblems: {
    notJson: "It is not JSON.",
    notEisenhower: "It is not an Eisenhower document.",
    wrongKind: "It is a document of a kind this app does not know.",
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

  /** The plugin's errors, by the code `@eisenhower/tauri` gives them. */
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
