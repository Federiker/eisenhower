// The release's tag (`v<version>`, annotated) and where it is: here at HEAD, and on `origin` at the
// same commit, with HEAD on origin's main. The script only creates the tag here; pushing is the
// owner's (see docs/development.md, decision 11).
import { attempt, run } from "./run";

/** Where the tag is in this clone. */
export type LocalTag =
  | { kind: "missing"; head: string }
  | { kind: "elsewhere"; head: string; tagged: string }
  | { kind: "here"; head: string };

/** A commit as the messages show it. */
export function short(commit: string): string {
  return commit.slice(0, 10);
}

/** The commit a revision names in this clone, or null when there is none. */
function commitOf(revision: string): string | null {
  const { status, stdout } = attempt("git", ["rev-parse", "--quiet", "--verify", `${revision}^{commit}`], {
    capture: true,
  });
  return status === 0 ? stdout.trim() : null;
}

export function localTag(tag: string): LocalTag {
  const head = commitOf("HEAD") ?? "";
  const tagged = commitOf(`refs/tags/${tag}`);
  if (!tagged) return { kind: "missing", head };
  return tagged === head ? { kind: "here", head } : { kind: "elsewhere", head, tagged };
}

/** Creates the release's tag at HEAD, annotated, in this clone only. */
export function createTag(tag: string, message: string) {
  run("git", ["tag", "--annotate", tag, "--message", message]);
}

/** A ref on origin: `<commit>\t<ref>` lines from `git ls-remote`. */
function remoteRefs(args: readonly string[]): Map<string, string> {
  const output = run("git", ["ls-remote", ...args, "origin"], { capture: true });
  return new Map(
    output
      .split(/\r?\n/)
      .filter((line) => line.includes("\t"))
      .map((line) => {
        const [commit, ref] = line.split("\t");
        return [ref!, commit!];
      }),
  );
}

/** Whether a commit is on another, when this clone has the other. */
function isAncestor(commit: string, of: string): boolean {
  if (commit === of) return true;
  if (attempt("git", ["cat-file", "-e", `${of}^{commit}`]).status !== 0) return false;
  return attempt("git", ["merge-base", "--is-ancestor", commit, of]).status === 0;
}

/**
 * What origin lacks for a release of HEAD at the tag: an empty list when the tag is there at HEAD and
 * HEAD is on origin's main, otherwise each problem with what to push.
 */
export function remoteProblems(tag: string, head: string): string[] {
  const tags = remoteRefs(["--tags"]);
  // An annotated tag's commit is its peeled ref (`^{}`); a lightweight tag's is the ref itself.
  const tagged = tags.get(`refs/tags/${tag}^{}`) ?? tags.get(`refs/tags/${tag}`);
  const main = remoteRefs(["--heads"]).get("refs/heads/main");
  const problems: string[] = [];
  if (!main || !isAncestor(head, main)) {
    problems.push(
      `HEAD (${short(head)}) is not on origin's main${main ? ` (at ${short(main)})` : ""}: push it with \`git push origin main\`.`,
    );
  }
  if (!tagged) problems.push(`origin has no ${tag}: push it with \`git push origin ${tag}\`.`);
  else if (tagged !== head) {
    problems.push(
      `origin's ${tag} is at ${short(tagged)}, not at HEAD (${short(head)}): a released tag is not moved; release a new version instead.`,
    );
  }
  return problems;
}
