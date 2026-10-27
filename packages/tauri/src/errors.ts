/** The codes the plugin's errors carry (`params` says which values each has). */
export const pluginErrorCodes = [
  "read_failed",
  "not_text",
  "write_failed",
  "changed_on_disk",
  "invalid_request",
  "internal",
] as const;

/**
 * A code the plugin sends, or `invalid_response` (the plugin answered something this client does not
 * understand) or `unknown` (the call failed in a way that is not the plugin's, such as a command the
 * window's capability does not allow, or no Tauri at all).
 */
export type PluginErrorCode = (typeof pluginErrorCodes)[number] | "invalid_response" | "unknown";

const knownCodes: ReadonlySet<string> = new Set(pluginErrorCodes);

/**
 * What a command of `tauri-plugin-eisenhower` could not do: a stable `code` for the host to translate
 * and the values its message needs (`path`, `expectedHash`…; `detail` is the operating system's own
 * words, for logs, never interface text).
 */
export class EisenhowerPluginError extends Error {
  override readonly name = "EisenhowerPluginError";
  readonly code: PluginErrorCode;
  readonly params: Readonly<Record<string, unknown>>;

  constructor(code: PluginErrorCode, params: Record<string, unknown> = {}, options?: ErrorOptions) {
    super(Object.keys(params).length > 0 ? `${code} ${JSON.stringify(params)}` : code, options);
    this.code = code;
    this.params = params;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The error a failed call becomes. The plugin's `{ code, params }` keeps its code; anything else (Tauri
 * refusing the command, a code this client does not know) becomes `unknown`, its text in `detail`, so
 * a failure is never hidden.
 */
export function toPluginError(cause: unknown): EisenhowerPluginError {
  if (cause instanceof EisenhowerPluginError) return cause;
  if (isRecord(cause) && typeof cause.code === "string" && knownCodes.has(cause.code)) {
    const params = isRecord(cause.params) ? cause.params : {};
    return new EisenhowerPluginError(cause.code as PluginErrorCode, params, { cause });
  }
  const detail = cause instanceof Error ? cause.message : typeof cause === "string" ? cause : JSON.stringify(cause);
  return new EisenhowerPluginError("unknown", { detail }, { cause });
}

/** An answer of the wrong shape: an error, never a substitute value. */
export function invalidResponse(command: string, detail: string): EisenhowerPluginError {
  return new EisenhowerPluginError("invalid_response", { command, detail });
}
