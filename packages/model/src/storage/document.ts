import type { z } from "zod";

/** The views' kinds of document (decision 3); each has its own data. */
export type DocumentKindName = "board" | "timeline" | "gantt" | "todo";

/** What a stored document is: Eisenhower's mark, the kind, the kind's version of its data, and the data. */
export interface EisenhowerDocument<T> {
  format: "eisenhower";
  kind: DocumentKindName;
  version: number;
  data: T;
}

/**
 * A kind of document: its name, the version of its data this code writes, the schema its data must pass and
 * the checks a schema cannot say (ids that refer to others, an end after its start…), each problem one
 * sentence for logs.
 */
export interface DocumentKind<T> {
  kind: DocumentKindName;
  version: number;
  schema: z.ZodType<T>;
  problems?: (data: T) => string[];
}

/** Why a text is not a document of a kind. */
export type DocumentProblem = "notJson" | "notEisenhower" | "wrongKind" | "newerVersion" | "invalid";

/** A text that is not a document of the expected kind; `details` are for logs, never interface text. */
export class DocumentError extends Error {
  override readonly name = "DocumentError";
  readonly problem: DocumentProblem;
  readonly details: readonly string[];

  constructor(problem: DocumentProblem, details: readonly string[] = [], options?: ErrorOptions) {
    super(details.length > 0 ? `${problem}: ${details.join("; ")}` : problem, options);
    this.problem = problem;
    this.details = details;
  }
}

/** The document's text: JSON, two-space indented, ending with a new line (readable and diffable on disk). */
export function serialiseDocument<T>(kind: DocumentKind<T>, data: T): string {
  const document: EisenhowerDocument<T> = { format: "eisenhower", kind: kind.kind, version: kind.version, data };
  return `${JSON.stringify(document, null, 2)}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The data of a document of this kind, checked by its schema and its own checks.
 *
 * @throws DocumentError when the text is not JSON, not an Eisenhower document, of another kind, written by a
 * newer version, or not valid; a document is never half read.
 */
export function parseDocument<T>(kind: DocumentKind<T>, text: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new DocumentError("notJson", [String(cause)], { cause });
  }
  if (!isRecord(parsed) || parsed.format !== "eisenhower") throw new DocumentError("notEisenhower");
  if (parsed.kind !== kind.kind) throw new DocumentError("wrongKind", [`${String(parsed.kind)}, not ${kind.kind}`]);
  if (typeof parsed.version !== "number" || !Number.isInteger(parsed.version) || parsed.version < 1) {
    throw new DocumentError("invalid", ["version is not a whole number from 1"]);
  }
  if (parsed.version > kind.version) {
    throw new DocumentError("newerVersion", [`version ${parsed.version}, this code reads up to ${kind.version}`]);
  }
  const result = kind.schema.safeParse(parsed.data);
  if (!result.success) {
    throw new DocumentError(
      "invalid",
      result.error.issues.map((issue) => `${issue.path.join(".") || "data"}: ${issue.message}`),
    );
  }
  const problems = kind.problems?.(result.data) ?? [];
  if (problems.length > 0) throw new DocumentError("invalid", problems);
  return result.data;
}
