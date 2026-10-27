// What the publish script's steps share: the repository's root, its messages and running programs.
import { spawnSync } from "node:child_process";
import { isAbsolute, join, relative } from "node:path";

export const root = join(import.meta.dirname, "..", "..");

/** Where the script builds and checks the packages: under the gitignored tmp/. */
export const publishFolder = join(root, "tmp", "publish");

/** Ends the script with a reason. */
export function fail(message: string): never {
  console.error(`\n${message}`);
  process.exit(1);
}

/** Announces the next step. */
export function step(title: string) {
  console.log(`\n== ${title}`);
}

/** A path as the messages show it: from the root when inside it (anything else as it is). */
export function shown(path: string): string {
  if (!isAbsolute(path)) return path;
  const fromRoot = relative(root, path);
  return fromRoot.startsWith("..") ? path : fromRoot.replaceAll("\\", "/");
}

interface RunOptions {
  cwd?: string;
  /** The child's environment; the script's own (without the tokens) when left out. */
  env?: NodeJS.ProcessEnv;
  /** Returns the program's output instead of showing it. */
  capture?: boolean;
}

/**
 * Runs a program and fails the script when it fails. Its arguments are printed, so a token never
 * goes in them: tokens reach a child through its environment. npm is a .cmd file on Windows, which
 * only the shell runs.
 */
export function run(command: string, args: readonly string[], options: RunOptions = {}): string {
  console.log(`> ${[command, ...args].map(shown).join(" ")}`);
  const shell = process.platform === "win32" && command === "npm";
  const quoted = args.map((arg) => (shell && /[\s"&|<>^]/.test(arg) ? `"${arg}"` : arg));
  const result = spawnSync(shell ? [command, ...quoted].join(" ") : command, shell ? [] : quoted, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
    shell,
  });
  if (result.error) fail(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} failed (exit code ${result.status}).`);
  return result.stdout ?? "";
}
