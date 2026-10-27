// Checks the staged packages before anything reaches a registry: every import of the built files is
// a declared dependency and no workspace name is left, then a consumer in tmp/publish/consumer
// installs the packed tarballs (as an app installs them from npm), imports each with Node and
// type-checks a file using them with `moduleResolution: "nodenext"`.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { filesIn, runTsc } from "./build";
import { catalog, type Package, packages, stageOf } from "./packages";
import { fail, publishFolder, run, shown, step } from "./run";

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
    if (text.includes("@eisenhower/")) fail(`${shown(file)} still names a workspace package (@eisenhower/…).`);
    for (const specifier of bareSpecifiers(text)) imported.add(packageName(specifier));
  }
  const undeclared = [...imported].filter((name) => !declared.has(name));
  if (undeclared.length > 0) fail(`${pkg.published} imports ${undeclared.join(", ")} without declaring it.`);
  console.log(`${pkg.published} imports ${[...imported].sort().join(", ") || "nothing"}: all declared.`);
}

const consumerSource = `import { boardDocument, emptyBoard, memoryStorage, saveDocument } from "@frodobaggins.jr/eisenhower-model";
import { Board, EisenhowerProvider } from "@frodobaggins.jr/eisenhower-react";
import { tauriStorage } from "@frodobaggins.jr/eisenhower-tauri";

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

for (const name of ${JSON.stringify(packages.map((pkg) => pkg.published))}) {
  const module = await import(name);
  console.log(\`\${name}: \${Object.keys(module).length} exports\`);
}
const stylesheet = fileURLToPath(import.meta.resolve("@frodobaggins.jr/eisenhower-react/style.css"));
if (!existsSync(stylesheet)) throw new Error(\`No stylesheet at \${stylesheet}\`);
console.log("@frodobaggins.jr/eisenhower-react/style.css resolves.");
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

/** Installs the packed tarballs in a fresh consumer, then imports and type-checks them there. */
function checkConsumer() {
  const consumer = join(publishFolder, "consumer");
  step(`A consumer of the packed tarballs, in ${shown(consumer)}`);
  rmSync(consumer, { recursive: true, force: true });
  mkdirSync(consumer, { recursive: true });
  const tarballs: Record<string, string> = {};
  for (const pkg of packages) {
    const packed = run("npm", ["pack", stageOf(pkg), "--pack-destination", consumer, "--json", "--silent"], {
      capture: true,
    });
    tarballs[pkg.published] = `file:./${JSON.parse(packed)[0].filename}`;
  }
  const manifest = {
    name: "eisenhower-consumer",
    private: true,
    type: "module",
    dependencies: {
      ...tarballs,
      react: catalog.react,
      "react-dom": catalog["react-dom"],
      "@types/react": catalog["@types/react"],
    },
    // The siblings' own `^<version>` dependencies are met by the tarballs, not the registry.
    overrides: Object.fromEntries(Object.keys(tarballs).map((name) => [name, `$${name}`])),
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

export function verifyPackages() {
  step("Imports of the built files");
  for (const pkg of packages) checkImports(pkg);
  checkConsumer();
}
