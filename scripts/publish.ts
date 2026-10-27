// Publishes the npm packages under the owner's scope and the Tauri plugin to crates.io (owner
// decision, 27 October 2026; see docs/development.md, decision 11). By default a dry run
// (`mise run publish:dry`): the checks, the builds in tmp/publish, a consumer of the packed tarballs,
// then `npm publish --dry-run` and `cargo publish --dry-run`. With --publish (`mise run publish`) the
// same, then the real thing. A version already on a registry is skipped.
//
//   --publish      publish for real (a clean tree, every check, NPM_TOKEN and CRATES_IO_TOKEN in .env)
//   --allow-dirty  a dry run with uncommitted changes
//   --skip-checks  a dry run without the type-check, the tests and Clippy
//
// The tokens come from the gitignored .env (see .env.example) and reach only npm's and cargo's
// publishing commands, through their environment: never an argument, never printed.
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPackages } from "./publish/build";
import { crate, packages, stageOf, version } from "./publish/packages";
import { fail, publishFolder, root, run, step } from "./publish/run";
import { verifyPackages } from "./publish/verify";

const options = new Set(["--publish", "--allow-dirty", "--skip-checks"]);
const args = process.argv.slice(2);
const unknown = args.filter((arg) => !options.has(arg));
if (unknown.length > 0) fail(`Unknown option ${unknown.join(", ")}; the options are ${[...options].join(", ")}.`);
const publish = args.includes("--publish");
const allowDirty = args.includes("--allow-dirty");
const skipChecks = args.includes("--skip-checks");
if (publish && (allowDirty || skipChecks)) fail("--allow-dirty and --skip-checks are for dry runs only.");

/** The tokens, from .env or the environment, then taken out of the environment every child inherits. */
function takeTokens(): { npm?: string; crates?: string } {
  const file = join(root, ".env");
  const values: Record<string, string> = {};
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (match) values[match[1]!] = match[2]!.replace(/^(["'])(.*)\1$/, "$2");
    }
  }
  const npm = values.NPM_TOKEN || process.env.NPM_TOKEN;
  const crates = values.CRATES_IO_TOKEN || process.env.CRATES_IO_TOKEN;
  for (const name of ["NPM_TOKEN", "CRATES_IO_TOKEN", "CARGO_REGISTRY_TOKEN"]) delete process.env[name];
  return { npm, crates };
}

const tokens = takeTokens();
if (publish && !(tokens.npm && tokens.crates)) fail("Publishing needs NPM_TOKEN and CRATES_IO_TOKEN in .env.");

console.log(`Eisenhower ${version}: ${publish ? "publishing for real" : "a dry run (--publish publishes)"}.`);

step("A clean tree");
const status = run("git", ["status", "--porcelain"], { capture: true }).trim();
if (status !== "" && !allowDirty) fail(`Uncommitted changes (commit them, or --allow-dirty for a dry run):\n${status}`);
console.log(status === "" ? "Nothing uncommitted." : "Uncommitted changes, allowed for this dry run.");

if (skipChecks) {
  step("The checks: skipped (--skip-checks)");
} else {
  for (const task of ["typecheck", "test", "rust:clippy"]) {
    step(`Check: mise run ${task}`);
    run("mise", ["run", task]);
  }
}

await buildPackages();
verifyPackages();

/** Whether a version of an npm package is on the registry already. */
async function onNpm(name: string): Promise<boolean> {
  const response = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2F")}`);
  if (response.status === 404) return false;
  if (!response.ok) fail(`npm's registry answered ${response.status} for ${name}.`);
  const packument = (await response.json()) as { versions?: Record<string, unknown> };
  return version in (packument.versions ?? {});
}

/** Whether a version of the crate is on crates.io already. */
async function onCratesIo(): Promise<boolean> {
  const response = await fetch(`https://crates.io/api/v1/crates/${crate}/${version}`, {
    headers: { "User-Agent": "eisenhower-publish (https://github.com/Federiker/eisenhower)" },
  });
  if (response.status === 404) return false;
  if (!response.ok) fail(`crates.io answered ${response.status} for ${crate}.`);
  return true;
}

// npm's settings for these commands only: the registry and, when there is a token, a reference to it
// (npm reads the value from the child's environment; the file never holds it).
const npmrc = join(publishFolder, ".npmrc");
const npmEnv = { ...process.env, ...(tokens.npm ? { NPM_TOKEN: tokens.npm } : {}) };
// biome-ignore lint/suspicious/noTemplateCurlyInString: npm's own reference to the variable, not a template.
const authentication = "//registry.npmjs.org/:_authToken=${NPM_TOKEN}";
writeFileSync(npmrc, ["registry=https://registry.npmjs.org/", ...(tokens.npm ? [authentication] : []), ""].join("\n"));

async function publishNpm(dryRun: boolean) {
  for (const pkg of packages) {
    step(`npm publish ${pkg.published}@${version}${dryRun ? " (dry run)" : ""}`);
    if (await onNpm(pkg.published)) {
      console.log(`${pkg.published}@${version} is on npm already: skipped.`);
      continue;
    }
    const flags = ["--access", "public", "--tag", "latest", "--userconfig", npmrc, ...(dryRun ? ["--dry-run"] : [])];
    run("npm", ["publish", stageOf(pkg), ...flags], { env: npmEnv });
  }
}

async function publishCrate(dryRun: boolean) {
  step(`cargo publish ${crate}@${version}${dryRun ? " (dry run)" : ""}`);
  if (await onCratesIo()) {
    console.log(`${crate}@${version} is on crates.io already: skipped.`);
    return;
  }
  const flags = dryRun ? ["--dry-run", ...(allowDirty ? ["--allow-dirty"] : [])] : [];
  const env = dryRun ? process.env : { ...process.env, CARGO_REGISTRY_TOKEN: tokens.crates };
  run("cargo", ["publish", "--package", crate, ...flags], { env });
}

try {
  await publishNpm(true);
  await publishCrate(true);
  if (publish) {
    await publishNpm(false);
    await publishCrate(false);
  }
} finally {
  rmSync(npmrc, { force: true });
}

step(publish ? "Published" : "Dry run done");
console.log(
  publish
    ? `${packages.map((pkg) => pkg.published).join(", ")} and ${crate} ${version} are published.`
    : `Everything is ready for ${version}; \`mise run publish\` publishes it.`,
);
