// Builds each npm package into its staging folder (tmp/publish/<folder>): dist/index.js from Vite's
// library mode, the declarations from tsc (tsconfig.build.json: the sources, not the tests), the
// stylesheet with its imports inlined, the README, the licence and the published manifest. The
// tracked files are never changed; sibling packages are imported under their published names.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { type Package, packages, publishedManifest, publishedNames, sourceOf, stageOf } from "./packages";
import { fail, root, run, shown, step } from "./run";

const tsc = fileURLToPath(import.meta.resolve("typescript/bin/tsc"));

/** Runs TypeScript's compiler with Bun, so the script needs nothing on the path for it. */
export function runTsc(args: readonly string[]) {
  run(process.execPath, [tsc, ...args]);
}

/** Every bare import is left to the package's dependencies: its siblings, React, zod, Tauri's API. */
function external(id: string): boolean {
  return !id.startsWith(".") && !id.startsWith("\0") && !isAbsolute(id);
}

/** A stylesheet with its relative `@import`s replaced by the files they name, recursively. */
function inlinedStylesheet(file: string): string {
  if (!existsSync(file)) fail(`${shown(file)} does not exist.`);
  return readFileSync(file, "utf8").replace(/^@import\s+"(\.[^"]+)";[ \t]*$/gm, (_, path: string) =>
    inlinedStylesheet(join(dirname(file), path)).trimEnd(),
  );
}

const relativeSpecifier = /(\bfrom\s*|\bimport\s*\(\s*)(["'])(\.{1,2}\/[^"']*)\2/g;

/**
 * A declaration file's relative imports with the `.js` a Node consumer needs (`moduleResolution`
 * `node16` or `nodenext`): the sources import without an extension (decision 12).
 */
function withExtensions(file: string, text: string): string {
  return text.replace(relativeSpecifier, (_, lead: string, quote: string, specifier: string) => {
    const target = join(dirname(file), specifier);
    if (existsSync(`${target}.d.ts`)) return `${lead}${quote}${specifier}.js${quote}`;
    if (existsSync(join(target, "index.d.ts"))) return `${lead}${quote}${specifier}/index.js${quote}`;
    return fail(`${shown(file)} imports ${specifier}, which has no declarations.`);
  });
}

/** The files under a folder, as absolute paths. */
export function filesIn(folder: string): string[] {
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

async function buildPackage(pkg: Package) {
  const source = sourceOf(pkg);
  const stage = stageOf(pkg);
  const dist = join(stage, "dist");
  step(`Build ${pkg.workspace} as ${pkg.published} in ${shown(stage)}`);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });
  await build({
    configFile: false,
    root: source,
    publicDir: false,
    logLevel: "warn",
    build: {
      lib: { entry: join(source, "src", "index.ts"), formats: ["es"], fileName: "index" },
      outDir: dist,
      emptyOutDir: false,
      minify: false,
      sourcemap: false,
      target: "es2022",
      rollupOptions: { external },
    },
  });
  runTsc(["--project", join(source, "tsconfig.build.json"), "--outDir", dist]);
  if (pkg.stylesheet) writeFileSync(join(dist, "style.css"), inlinedStylesheet(join(source, pkg.stylesheet)));
  for (const file of filesIn(dist)) {
    if (!file.endsWith(".js") && !file.endsWith(".d.ts")) continue;
    const text = publishedNames(readFileSync(file, "utf8"));
    writeFileSync(file, file.endsWith(".d.ts") ? withExtensions(file, text) : text);
  }
  writeFileSync(join(stage, "package.json"), `${JSON.stringify(publishedManifest(pkg), null, 2)}\n`);
  cpSync(join(source, "README.md"), join(stage, "README.md"));
  cpSync(join(root, "LICENSE"), join(stage, "LICENSE"));
}

/** Builds every package, after the declarations of those they reference (their own `tsc --build`). */
export async function buildPackages() {
  step("Declarations of the referenced packages");
  runTsc(["--build", ...packages.map(sourceOf)]);
  for (const pkg of packages) await buildPackage(pkg);
}
