import {
  type Board,
  boardDocument,
  DocumentError,
  type DocumentKind,
  type DocumentKindName,
  emptyBoard,
  emptyGantt,
  emptyTimeline,
  type Gantt,
  ganttDocument,
  parseDocument,
  type StorageAdapter,
  saveDocument,
  type Timeline,
  type TodoList,
  timelineDocument,
  todoDocument,
} from "@eisenhower/model";

/** A document of any of the views, with its kind: what the app has open. */
export type AnyDocument =
  | { kind: "board"; data: Board }
  | { kind: "timeline"; data: Timeline }
  | { kind: "gantt"; data: Gantt }
  | { kind: "todo"; data: TodoList };

/** Each view's kind of document, from `@eisenhower/model`. */
const KINDS: { [K in AnyDocument["kind"]]: DocumentKind<Extract<AnyDocument, { kind: K }>["data"]> } = {
  board: boardDocument,
  timeline: timelineDocument,
  gantt: ganttDocument,
  todo: todoDocument,
};

/** The kind of a document's data (typed loosely: the kind and its data always come together). */
const kindOf = (kind: DocumentKindName) => KINDS[kind] as DocumentKind<unknown>;

/** The types a new document can have: a view, and for a timeline whether it is of dates or of steps. */
export type NewType = "board" | "timeline-dates" | "timeline-sequence" | "gantt" | "todo";

export const NEW_TYPES: readonly NewType[] = ["board", "timeline-dates", "timeline-sequence", "gantt", "todo"];

/** A new document of a type, with nothing in it yet: the model's empty data of its kind. */
export function emptyDocument(type: NewType): AnyDocument {
  switch (type) {
    case "board":
      return { kind: "board", data: emptyBoard() };
    case "timeline-dates":
      return { kind: "timeline", data: emptyTimeline("dates") };
    case "timeline-sequence":
      return { kind: "timeline", data: emptyTimeline("sequence") };
    case "gantt":
      return { kind: "gantt", data: emptyGantt() };
    case "todo":
      return { kind: "todo", data: { items: [] } };
  }
}

function isKindName(kind: unknown): kind is DocumentKindName {
  return typeof kind === "string" && Object.hasOwn(KINDS, kind);
}

/**
 * The document a text holds, whatever its view: its `kind` says which, and the kind's own checks read it.
 *
 * @throws DocumentError when it is not JSON, not an Eisenhower document, of a kind this app does not know
 * (`wrongKind`), written by a newer version, or not valid.
 */
export function parseAnyDocument(text: string): AnyDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new DocumentError("notJson", [String(cause)], { cause });
  }
  const record = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  if (record?.format !== "eisenhower") throw new DocumentError("notEisenhower");
  if (!isKindName(record.kind)) throw new DocumentError("wrongKind", [`unknown kind ${String(record.kind)}`]);
  return { kind: record.kind, data: parseDocument(kindOf(record.kind), text) } as AnyDocument;
}

/**
 * Reads the document stored under `key` with its revision; null when there is nothing there.
 *
 * @throws DocumentError when it is not a valid document; StorageError when it could not be read.
 */
export async function loadAnyDocument(
  storage: StorageAdapter,
  key: string,
): Promise<{ document: AnyDocument; revision: string } | null> {
  const stored = await storage.read(key);
  if (stored === null) return null;
  return { document: parseAnyDocument(stored.text), revision: stored.revision };
}

/**
 * Writes the document under `key` as its kind's text (`serialiseDocument`, through `saveDocument`), quoting
 * `revision` when given; resolves to the new revision.
 *
 * @throws StorageError, `changed` when the stored text is no longer the one quoted.
 */
export function saveAnyDocument(
  storage: StorageAdapter,
  key: string,
  document: AnyDocument,
  revision?: string,
): Promise<string> {
  return saveDocument(storage, key, kindOf(document.kind), document.data, revision);
}
