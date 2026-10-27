import { expect, test } from "@playwright/test";

import { openApp, saved, saveState } from "./app";

test("has its landmarks and tabs, moved between with the arrows", async ({ page }) => {
  const errors = await openApp(page, "Board");
  await expect(page.getByRole("banner").getByRole("heading", { name: "Eisenhower", level: 1 })).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  const tabs = page.getByRole("tablist", { name: "Views" });
  await expect(tabs.getByRole("tab")).toHaveText(["Board", "Timeline", "Gantt", "Todo"]);
  await expect(page.getByRole("tabpanel", { name: "Board" })).toBeVisible();

  await tabs.getByRole("tab", { name: "Board" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab", { name: "Timeline" })).toBeFocused();
  await expect(tabs.getByRole("tab", { name: "Timeline" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Timeline" })).toBeVisible();
  await page.keyboard.press("End");
  await expect(page.getByRole("tabpanel", { name: "Todo" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab", { name: "Board" })).toBeFocused();
  expect(errors).toEqual([]);
});

test("draws every view dark when the dark theme is chosen", async ({ page }) => {
  await openApp(page, "Board");
  const background = () => page.locator(".app").evaluate((element) => getComputedStyle(element).backgroundColor);
  const card = page.locator(".eh-board-card").first();
  const cardBackground = () => card.evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.getByLabel("Theme").selectOption("light");
  expect(await background()).toBe("rgb(245, 246, 243)");
  const lightCard = await cardBackground();

  await page.getByLabel("Theme").selectOption("dark");
  await expect(page.locator(".app")).toHaveAttribute("data-theme", "dark");
  expect(await background()).toBe("rgb(32, 39, 34)");
  expect(await cardBackground()).not.toBe(lightCard);

  // "System" follows the browser's colour scheme.
  await page.getByLabel("Theme").selectOption("system");
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await background()).toBe("rgb(32, 39, 34)");
  await page.emulateMedia({ colorScheme: "light" });
  expect(await background()).toBe("rgb(245, 246, 243)");
});

test("keeps a change in this browser across a reload, and resets to the sample", async ({ page }) => {
  await openApp(page, "Todo");
  const items = page.getByRole("list", { name: "Items" });
  await items.getByRole("checkbox", { name: "Sort the old magazines" }).check();
  await saved(page);

  await page.reload();
  await expect(page.getByRole("tab", { name: "Todo", selected: true })).toBeVisible();
  await expect(items.getByRole("checkbox", { name: "Sort the old magazines" })).toBeChecked();
  await expect(saveState(page)).toHaveText("Saved in this browser");
  // Loaded, so there is nothing to undo.
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();

  await page.getByRole("button", { name: "Reset to the sample", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "This week: back to the sample." })).toBeVisible();
  await expect(items.getByRole("checkbox", { name: "Sort the old magazines" })).not.toBeChecked();
  await saved(page);
  await page.reload();
  await expect(items.getByRole("checkbox", { name: "Sort the old magazines" })).not.toBeChecked();
});

test("keeps each view's document and history apart", async ({ page }) => {
  await openApp(page, "Board");
  await page.getByRole("button", { name: "Pack the books", exact: true }).focus();
  await page.keyboard.press("Alt+ArrowRight");
  await saved(page);
  await page.getByRole("tab", { name: "Gantt" }).click();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await page.getByRole("tab", { name: "Board" }).click();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Under way" }).getByRole("button", { name: "Pack the books", exact: true }),
  ).toBeVisible();
});

test("says why a stored document cannot be read, shows the sample and leaves the stored copy alone", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("planted")) {
      localStorage.setItem("eisenhower-demo:board", '{ "format": "eisenhower", "kind": "gantt", "version": 1 }');
      sessionStorage.setItem("planted", "yes");
    }
  });
  await page.goto("/#board");
  await expect(page.getByRole("alert")).toHaveText(
    "The stored copy of Moving house could not be read. It is a document of another view; open it on that view's tab. The sample is shown; Reset to the sample to replace the stored copy.",
  );
  await expect(page.getByRole("button", { name: "Hire a van", exact: true })).toBeVisible();
  await expect(saveState(page)).toHaveText("Not saved");
  await page.getByRole("button", { name: "Pack the books", exact: true }).focus();
  await page.keyboard.press("Alt+ArrowRight");
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => localStorage.getItem("eisenhower-demo:board"))).toContain('"kind": "gantt"');

  await page.getByRole("button", { name: "Reset to the sample", exact: true }).click();
  await saved(page);
  expect(await page.evaluate(() => localStorage.getItem("eisenhower-demo:board"))).toContain('"kind": "board"');
});
