// Checks the packages before they reach a release: every import of the built files is a declared
// dependency, then a consumer in tmp/release/consumer installs the three tarballs together (as a host
// installs them from the release), imports each with Node and type-checks a file using them with
// `moduleResolution: "nodenext"`.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { filesIn, runTsc, type Tarball } from "./build";
import { catalog, type Package, packages, stageOf } from "./packages";
import { fail, releaseFolder, run, shown, step } from "./run";

/** `import … from "x"` and `export … from "x"`, `import "x"`, and `import("x")` (in code or in a type). */
const specifiers = [
  /^\s*(?:import|export)\s[^;"']*?\bfrom\s*(["'])([^"']+)\1/gm,
  /^\s*import\s*(["'])([^"']+)\1/gm,
  /\bimport\(\s*(["'])([^"']+)\1\s*\)/g,
];

/** The bare specifiers (packages, not files) a built file imports. */
function bareSpecifiers(text: string): string[] {
  return specifiers
    .flatMap((pattern) => [...text.matchAll(pattern)].map((match) => match[2]!))
    .filter((specifier) => !specifier.startsWith("."));
}

/** The package a bare specifier names: `react` for `react/jsx-runtime`, `@scope/name` for its subpaths. */
function packageName(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
}

function checkImports(pkg: Package) {
  const stage = stageOf(pkg);
  const manifest = JSON.parse(readFileSync(join(stage, "package.json"), "utf8"));
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);
  const imported = new Set<string>();
  for (const file of filesIn(join(stage, "dist"))) {
    if (!file.endsWith(".js") && !file.endsWith(".d.ts")) continue;
    const text = readFileSync(file, "utf8");
    for (const specifier of bareSpecifiers(text)) imported.add(packageName(specifier));
  }
  const undeclared = [...imported].filter((name) => !declared.has(name));
  if (undeclared.length > 0) fail(`${pkg.name} imports ${undeclared.join(", ")} without declaring it.`);
  console.log(`${pkg.name} imports ${[...imported].sort().join(", ") || "nothing"}: all declared.`);
}

const consumerSource = `import { boardDocument, emptyBoard, memoryStorage, saveDocument } from "@eisenhower/model";
import { Board, EisenhowerProvider } from "@eisenhower/react";
import { tauriStorage } from "@eisenhower/tauri";

const board = emptyBoard();
export const view = (
  <EisenhowerProvider theme="system">
    <Board value={board} onChange={() => {}} layout="board" />
  </EisenhowerProvider>
);
export const saved = saveDocument(memoryStorage(), "board", boardDocument, board);
export const storage = tauriStorage();
`;

const consumerImports = `import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

for (const name of ${JSON.stringify(packages.map((pkg) => pkg.name))}) {
  const module = await import(name);
  console.log(\`\${name}: \${Object.keys(module).length} exports\`);
}
const stylesheet = fileURLToPath(import.meta.resolve("@eisenhower/react/style.css"));
if (!existsSync(stylesheet)) throw new Error(\`No stylesheet at \${stylesheet}\`);
console.log("@eisenhower/react/style.css resolves.");
`;

const consumerConfig = {
  compilerOptions: {
    target: "ES2022",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    jsx: "react-jsx",
    lib: ["ES2022", "DOM", "DOM.Iterable"],
    types: [],
    strict: true,
    noEmit: true,
    skipLibCheck: false,
  },
  files: ["consumer.tsx"],
};

/** Installs the tarballs in a fresh consumer, then imports and type-checks them there. */
function checkConsumer(tarballs: readonly Tarball[]) {
  const consumer = join(releaseFolder, "consumer");
  step(`A consumer of the tarballs, in ${shown(consumer)}`);
  rmSync(consumer, { recursive: true, force: true });
  mkdirSync(consumer, { recursive: true });
  const local = Object.fromEntries(
    tarballs.map((tarball) => [tarball.pkg.name, `file:${relative(consumer, tarball.file).replaceAll("\\", "/")}`]),
  );
  const manifest = {
    name: "eisenhower-consumer",
    private: true,
    type: "module",
    dependencies: {
      ...local,
      react: catalog.react,
      "react-dom": catalog["react-dom"],
      "@types/react": catalog["@types/react"],
    },
    // The siblings' dependencies on each other are the release's URLs, which exist only once it is
    // made: here they are met by the local tarballs.
    overrides: Object.fromEntries(Object.keys(local).map((name) => [name, `$${name}`])),
  };
  writeFileSync(join(consumer, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(consumer, "tsconfig.json"), `${JSON.stringify(consumerConfig, null, 2)}\n`);
  writeFileSync(join(consumer, "consumer.tsx"), consumerSource);
  writeFileSync(join(consumer, "imports.mjs"), consumerImports);
  run("npm", ["install", "--no-audit", "--no-fund", "--ignore-scripts", "--loglevel", "error"], { cwd: consumer });
  run("node", ["imports.mjs"], { cwd: consumer });
  runTsc(["--project", join(consumer, "tsconfig.json")]);
  console.log("The consumer type-checks with moduleResolution nodenext.");
}

export function verifyPackages(tarballs: readonly Tarball[]) {
  step("Imports of the built files");
  for (const pkg of packages) checkImports(pkg);
  checkConsumer(tarballs);
}
