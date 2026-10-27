import type { InvokeArgs } from "@tauri-apps/api/core";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { textRevision } from "@eisenhower/model";
import { afterEach } from "vitest";

/** One call the client made: the command and its arguments. */
export interface Call {
  command: string;
  args: InvokeArgs | undefined;
}

type Handler = (call: Call) => unknown;

/**
 * Stands in for the plugin with Tauri's own IPC mocks; `handler` answers each call (a thrown value or a
 * rejected promise is the command's error). Returns the calls made.
 */
export function mockPlugin(handler: Handler): Call[] {
  const calls: Call[] = [];
  mockIPC((command, args) => {
    const made = { command, args };
    calls.push(made);
    return handler(made);
  });
  return calls;
}

/**
 * A plugin that keeps its files in a map and behaves as the Rust one does: null for a missing file, the
 * SHA-256 as the hash, and `changed_on_disk` when the quoted hash is not the file's (or the file is gone).
 */
export function mockFiles(files: Map<string, string> = new Map()): Map<string, string> {
  mockPlugin(async ({ command, args }) => {
    const { path, text, expectedHash } = args as { path: string; text?: string; expectedHash?: string };
    const current = files.get(path);
    const actualHash = current === undefined ? null : await textRevision(current);
    if (command === "plugin:eisenhower|read_document") {
      return current === undefined ? null : { text: current, hash: actualHash };
    }
    if (expectedHash !== undefined && expectedHash !== actualHash) {
      throw { code: "changed_on_disk", params: { path, expectedHash, actualHash } };
    }
    files.set(path, text ?? "");
    return textRevision(text ?? "");
  });
  return files;
}

afterEach(() => {
  clearMocks();
});
