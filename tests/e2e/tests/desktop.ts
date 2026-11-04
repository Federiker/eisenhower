import { expect, type Page } from "@playwright/test";

/** The desktop app's preview, served by Vite beside the demo app. */
export const DESKTOP_URL = "http://127.0.0.1:1441";

/** Where the preview keeps its files, in `localStorage`, by path. */
const PREVIEW_PREFIX = "eisenhower-desktop-preview:";

/**
 * Opens the desktop app's preview on its start screen, with `files` (path to text) already in it; returns the
 * page's errors, which a test expects to be none. Each test has a browser context of its own, so its
 * `localStorage` starts empty.
 */
export async function openDesktop(page: Page, files: Record<string, string> = {}): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.addInitScript(
    ({ prefix, files }) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "yes");
      for (const [path, text] of Object.entries(files)) localStorage.setItem(`${prefix}${path}`, text);
    },
    { prefix: PREVIEW_PREFIX, files },
  );
  await page.goto(DESKTOP_URL);
  await expect(page.getByRole("heading", { name: "Recent documents" })).toBeVisible();
  return errors;
}

/** Answers the preview's next dialogues (its paths and questions) in turn: a text, true to accept, false to dismiss. */
export function answerDialogues(page: Page, ...answers: (string | boolean)[]) {
  const asked: string[] = [];
  page.on("dialog", (dialog) => {
    asked.push(dialog.message());
    const answer = answers.shift();
    if (answer === false || answer === undefined) void dialog.dismiss();
    else void dialog.accept(answer === true ? undefined : answer);
  });
  return asked;
}

/** A document's text, as the app writes it. */
export const documentText = (kind: string, data: unknown) =>
  `${JSON.stringify({ format: "eisenhower", kind, version: 1, data }, null, 2)}\n`;

/** The text of the preview's file at `path`, or null. */
export const fileText = (page: Page, path: string) =>
  page.evaluate((key) => localStorage.getItem(key), `${PREVIEW_PREFIX}${path}`);
