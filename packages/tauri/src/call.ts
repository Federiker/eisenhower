import { type InvokeArgs, invoke } from "@tauri-apps/api/core";
import { toPluginError } from "./errors";

/** The plugin's commands, as `build.rs` lists them. */
export type PluginCommand = "read_document" | "write_document";

/** Calls `plugin:eisenhower|<command>`; a failure is always an `EisenhowerPluginError`. */
export async function call(command: PluginCommand, args?: InvokeArgs): Promise<unknown> {
  try {
    return await invoke(`plugin:eisenhower|${command}`, args);
  } catch (cause) {
    throw toPluginError(cause);
  }
}
