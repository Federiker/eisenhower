// Builds the desktop app (owner decisions, 4 November 2026; see docs/development.md, decision 19):
// `mise run app:release` (`--release`, `tauri build`) or `mise run app:debug` (`--debug`,
// `tauri build --debug`), then moves the program and every installer `tauri build` made on this
// platform, side by side, into dist/<release|debug>/ at the repository's root:
//
//   - on Windows: eisenhower.exe, the .msi and the NSIS setup .exe;
//   - on macOS: the .app (a folder) and the .dmg;
//   - on Linux: the program, the .deb, the .rpm and the .AppImage.
//
// The installers are found in Cargo's target/<profile>/bundle/<format>/ (CARGO_TARGET_DIR when it is
// set), whatever the formats; that folder is emptied before the build, so an old installer is never
// taken for a new one. dist/<profile>/ is emptied first too: a build that fails leaves it empty.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { fail, root, run, shown, step } from "./release/run";

export type Profile = "release" | "debug";

/** The build's profile from the script's arguments, or why they are wrong. */
export function profileOf(args: readonly string[]): { profile: Profile } | { problem: string } {
  const usage = "Give one of --release or --debug (bun scripts/app-build.ts --release|--debug).";
  const unknown = args.filter((arg) => arg !== "--release" && arg !== "--debug");
  if (unknown.length > 0) return { problem: `Unknown option ${unknown.join(", ")}. ${usage}` };
  const profiles = new Set(args.map((arg) => arg.slice(2) as Profile));
  if (profiles.size !== 1) return { problem: usage };
  return { profile: [...profiles][0]! };
}

/**
 * The program's file name next to the installers (`mainBinaryName` in tauri.conf.json), or undefined
 * on macOS, where it lives inside the .app.
 */
export function programName(binary: string, platform: NodeJS.Platform): string | undefined {
  if (platform === "darwin") return undefined;
  return platform === "win32" ? `${binary}.exe` : binary;
}

/** What an installer's name ends with, whatever its format's folder. */
const installerExtensions = new Set([".msi", ".exe", ".dmg", ".app", ".deb", ".rpm", ".appimage"]);

/**
 * Whether an entry of a bundle/<format>/ folder is an installer: not the formats' staging folders
 * (a .deb's tree, the .AppDir), their scripts, nor the temporary read-write disk image (rw.*.dmg) a
 * failed macOS build can leave.
 */
export function isInstaller(name: string): boolean {
  return installerExtensions.has(extname(name).toLowerCase()) && !name.startsWith("rw.");
}

/** A file or folder to move, and its name in dist/<profile>/. */
export interface Artefact {
  from: string;
  name: string;
}

/**
 * The installers in each bundle/<format>/ folder of a profile's folder (`target/<profile>`), given
 * as the entries of each format's folder, then the program when there is one.
 */
export function artefacts(
  profileFolder: string,
  bundles: Readonly<Record<string, readonly string[]>>,
  program: string | undefined,
): Artefact[] {
  const installers = Object.entries(bundles)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([format, entries]) =>
      entries
        .filter(isInstaller)
        .sort()
        .map((name) => ({ from: join(profileFolder, "bundle", format, name), name })),
    );
  return program ? [{ from: join(profileFolder, program), name: program }, ...installers] : installers;
}

/** The names two artefacts would both take in the flat dist/<profile>/ folder. */
export function clashes(items: readonly Artefact[]): string[] {
  const seen = new Set<string>();
  const clashing = new Set<string>();
  for (const { name } of items) {
    const key = name.toLowerCase();
    if (seen.has(key)) clashing.add(name);
    seen.add(key);
  }
  return [...clashing];
}

/** A size as the summary shows it. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A file's size, or a folder's (a macOS .app): the sum of its files. */
function sizeOf(path: string): number {
  const stats = statSync(path);
  if (!stats.isDirectory()) return stats.size;
  return readdirSync(path, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .reduce((sum, entry) => sum + statSync(join(entry.parentPath, entry.name)).size, 0);
}

/** Moves a file or folder, copying it when the destination is on another volume. */
function move(from: string, to: string) {
  try {
    renameSync(from, to);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
    cpSync(from, to, { recursive: true });
    rmSync(from, { recursive: true, force: true });
  }
}

/** The entries of each format's folder in a bundle folder (none when tauri build made none). */
function bundlesIn(bundleFolder: string): Record<string, string[]> {
  if (!existsSync(bundleFolder)) return {};
  return Object.fromEntries(
    readdirSync(bundleFolder, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => [entry.name, readdirSync(join(bundleFolder, entry.name))]),
  );
}

function main() {
  const parsed = profileOf(process.argv.slice(2));
  if ("problem" in parsed) fail(parsed.problem);
  const { profile } = parsed;

  const app = join(root, "packages", "desktop");
  const config = JSON.parse(readFileSync(join(app, "src-tauri", "tauri.conf.json"), "utf8")) as {
    mainBinaryName?: unknown;
  };
  if (typeof config.mainBinaryName !== "string" || config.mainBinaryName === "") {
    fail("packages/desktop/src-tauri/tauri.conf.json has no mainBinaryName: the program's name is unknown.");
  }
  const program = programName(config.mainBinaryName, process.platform);
  const target = resolve(root, process.env.CARGO_TARGET_DIR ?? "target");
  const profileFolder = join(target, profile);
  const bundleFolder = join(profileFolder, "bundle");
  const destination = join(root, "dist", profile);

  step(`Empty ${shown(destination)} and ${shown(bundleFolder)}`);
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  rmSync(bundleFolder, { recursive: true, force: true });

  step(`Build the desktop app (${profile})`);
  run("bun", ["run", "tauri:build", ...(profile === "debug" ? ["--debug"] : [])], { cwd: app });

  step(`Move the program and the installers to ${shown(destination)}`);
  const items = artefacts(profileFolder, bundlesIn(bundleFolder), program);
  if (!items.some((item) => item.name !== program)) {
    fail(`tauri build made no installer in ${shown(bundleFolder)}.`);
  }
  if (program && !existsSync(join(profileFolder, program))) {
    fail(`tauri build made no program: ${shown(join(profileFolder, program))} does not exist.`);
  }
  const clashing = clashes(items);
  if (clashing.length > 0) fail(`Two artefacts would both be ${clashing.join(", ")} in ${shown(destination)}.`);
  for (const item of items) {
    const to = join(destination, item.name);
    move(item.from, to);
    console.log(`${basename(to)}  ${formatSize(sizeOf(to))}  (from ${shown(item.from)})`);
  }
  console.log(`\nThe desktop app's ${profile} build is in ${shown(destination)}.`);
}

if (import.meta.main) main();
