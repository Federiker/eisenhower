import { join } from "node:path";

import { expect, type Page, test } from "@playwright/test";

import { openApp, type Tab } from "./app";

// The README's pictures of the demo app (`mise run screenshots`), written to docs/screenshots (Git LFS). Not
// a test: the "chromium" project leaves this file out.
const out = join(import.meta.dirname, "..", "..", "..", "docs", "screenshots");

async function shoot(page: Page, tab: Tab, theme: "light" | "dark", name: string, before?: () => Promise<void>) {
  await openApp(page, tab);
  await page.getByLabel("Theme").selectOption(theme);
  await before?.();
  // Nothing focused or hovered, so no ring or tooltip is in the picture.
  await page.mouse.move(0, 0);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.screenshot({ path: join(out, `${name}-${theme}.png`) });
}

test("the board", async ({ page }) => {
  await shoot(page, "Board", "light", "board");
  await shoot(page, "Board", "dark", "board");
});

test("the timeline", async ({ page }) => {
  await shoot(page, "Timeline", "light", "timeline");
  await shoot(page, "Timeline", "dark", "timeline");
});

test("the gantt chart", async ({ page }) => {
  await shoot(page, "Gantt", "light", "gantt");
  await shoot(page, "Gantt", "dark", "gantt");
});

test("the todo list and its matrix", async ({ page }) => {
  await shoot(page, "Todo", "light", "todo");
  const matrix = async () => {
    await page.getByRole("button", { name: "Matrix", exact: true }).click();
    await expect(page.getByRole("region", { name: "Do", exact: true })).toBeVisible();
  };
  await shoot(page, "Todo", "light", "matrix", matrix);
  await shoot(page, "Todo", "dark", "matrix", matrix);
});
