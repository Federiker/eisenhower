// The release's name and notes on GitHub. Edit the template below to change what a release says; the
// install lines are made from the packages and the version, so they stay right.
import { assetUrl, crateDependency, packages, repositoryUrl, version } from "./packages";

export const releaseName = `Eisenhower ${version}`;

/** One package's line in the notes: what it is, and how a host installs it. */
function packageLines(): string {
  const what: Record<string, string> = {
    "@eisenhower/model": "the views' data: schemas, edit operations and storage",
    "@eisenhower/react": "the views (with `react` and `react-dom`); its stylesheet is `@eisenhower/react/style.css`",
    "@eisenhower/tauri": "the Tauri plugin's typed client and a storage adapter on it",
  };
  return packages
    .map((pkg) => `- \`${pkg.name}\`: ${what[pkg.name] ?? ""}\n\n  \`\`\`sh\n  bun add ${assetUrl(pkg)}\n  \`\`\``)
    .join("\n\n");
}

/** The notes, in GitHub's Markdown. */
export function releaseNotes(): string {
  return `Planning views for React (a board, a timeline, a gantt chart and a todo list with an Eisenhower matrix) and their Tauri integration.

## Packages

The packages are the tarballs below, installed by URL (each finds its siblings at this release):

${packageLines()}

## Tauri plugin

In the app's \`src-tauri/Cargo.toml\`, by git at this release's tag:

\`\`\`toml
${crateDependency}
\`\`\`

See the [README](${repositoryUrl}#use-it-in-an-app) for how to use them.
`;
}
