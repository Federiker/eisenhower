// What is published and under which names (owner decision, 27 October 2026; see docs/development.md,
// decision 11): the one place the workspace's @eisenhower/* names are mapped to npm's, and the
// published manifests, made from the packages' own.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fail, publishFolder, root } from "./run";

export interface Package {
  /** The workspace's name, which the sources import. */
  workspace: string;
  /** Its name on npm, under the owner's scope. */
  published: string;
  /** Its folder under packages/. */
  folder: string;
  /** Its stylesheet, published with its imports inlined as dist/style.css (`<name>/style.css`). */
  stylesheet?: string;
}

/** The npm packages, each after the ones it depends on (the order they are published in). */
export const packages: readonly Package[] = [
  { workspace: "@eisenhower/model", published: "@frodobaggins.jr/eisenhower-model", folder: "model" },
  { workspace: "@eisenhower/tauri", published: "@frodobaggins.jr/eisenhower-tauri", folder: "tauri" },
  {
    workspace: "@eisenhower/react",
    published: "@frodobaggins.jr/eisenhower-react",
    folder: "react",
    stylesheet: "src/style.css",
  },
];

/** The crate published to crates.io. */
export const crate = "tauri-plugin-eisenhower";

const repository = "https://github.com/Federiker/eisenhower";

/** The version of everything published: the root Cargo.toml's `[workspace.package]` version. */
export const version = workspaceVersion();

function workspaceVersion(): string {
  const cargo = readFileSync(join(root, "Cargo.toml"), "utf8");
  const section = cargo.split(/^\[/m).find((part) => part.startsWith("workspace.package]"));
  const found = section?.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  return found ?? fail("No version in the root Cargo.toml's [workspace.package].");
}

/** The folder a package is staged in: its built files, its README, the licence and its manifest. */
export function stageOf(pkg: Package): string {
  return join(publishFolder, pkg.folder);
}

export function sourceOf(pkg: Package): string {
  return join(root, "packages", pkg.folder);
}

/** A text with the workspace's package names replaced by the published ones. */
export function publishedNames(text: string): string {
  let renamed = text;
  for (const pkg of packages) {
    renamed = renamed.replace(new RegExp(`${pkg.workspace.replace("/", "\\/")}\\b`, "g"), pkg.published);
  }
  return renamed;
}

type Ranges = Record<string, string>;

interface SourceManifest {
  description?: string;
  keywords?: string[];
  sideEffects?: boolean | string[];
  dependencies?: Ranges;
  peerDependencies?: Ranges;
}

/** The root package.json's catalog of shared ranges. */
export const catalog: Ranges = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).workspaces.catalog;

/** A dependency as published: `catalog:` from the root's catalog, a sibling under its npm name. */
function publishedDependency(name: string, range: string): [string, string] {
  if (range === "catalog:") return [name, catalog[name] ?? fail(`${name} is not in the root package.json's catalog.`)];
  if (range.startsWith("workspace:")) {
    const sibling = packages.find((pkg) => pkg.workspace === name);
    return sibling ? [sibling.published, `^${version}`] : fail(`${name} is not one of the published packages.`);
  }
  if (range.includes(":")) fail(`${name}: the range "${range}" cannot be published.`);
  return [name, range];
}

function publishedRanges(ranges: Ranges | undefined): Ranges | undefined {
  if (!ranges) return undefined;
  return Object.fromEntries(Object.entries(ranges).map(([name, range]) => publishedDependency(name, range)));
}

/** The package.json published for a package: no devDependencies, scripts or `private`. */
export function publishedManifest(pkg: Package): Record<string, unknown> {
  const source: SourceManifest = JSON.parse(readFileSync(join(sourceOf(pkg), "package.json"), "utf8"));
  if (!source.description) fail(`${pkg.workspace} has no description in its package.json.`);
  const entry = { types: "./dist/index.d.ts", import: "./dist/index.js" };
  return {
    name: pkg.published,
    version,
    description: source.description,
    keywords: source.keywords,
    homepage: `${repository}/tree/main/packages/${pkg.folder}#readme`,
    bugs: `${repository}/issues`,
    repository: { type: "git", url: `git+${repository}.git`, directory: `packages/${pkg.folder}` },
    license: "CC0-1.0",
    type: "module",
    sideEffects: source.sideEffects ?? false,
    exports: pkg.stylesheet ? { ".": entry, "./style.css": "./dist/style.css" } : { ".": entry },
    types: entry.types,
    files: ["dist", "README.md", "LICENSE"],
    dependencies: publishedRanges(source.dependencies),
    peerDependencies: publishedRanges(source.peerDependencies),
  };
}
