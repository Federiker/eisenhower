import { expect, test } from "@playwright/test";

import { openApp } from "./app";

test("shows the Dates sample with BCE and approximate dates, and the Sequence one", async ({ page }) => {
  const errors = await openApp(page, "Timeline");
  const table = page.getByRole("table");
  await expect(table.getByRole("row", { name: /The Hippocratic writings/ })).toContainText("c. 430 BCE");
  await expect(table.getByRole("row", { name: /Galileo sees Jupiter's moons/ })).toContainText("7 January 1610 CE");
  await expect(page.getByRole("button", { name: /^Medicine: Jenner's first vaccination, 14 May 1796/ })).toBeVisible();

  await page.getByRole("button", { name: "The lighthouse", exact: true }).click();
  await expect(page.getByRole("button", { name: "The lighthouse", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: /^Wren: Finds the survivor, The wreck to The inquiry/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Steps" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("zooms the drawing in and back to its width", async ({ page }) => {
  await openApp(page, "Timeline");
  const zoomOut = page.getByRole("button", { name: "Zoom out", exact: true });
  const fit = page.getByRole("button", { name: "Fit", exact: true });
  await expect(zoomOut).toBeDisabled();
  const kepler = page.getByRole("button", { name: /^Astronomy: Kepler's laws/ });
  const before = (await kepler.boundingBox())!.x;
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(zoomOut).toBeEnabled();
  await expect(fit).toBeEnabled();
  // Zoomed in, the drawing is wider than its frame: the later entries are further right.
  expect((await kepler.boundingBox())!.x).toBeGreaterThan(before);
  await fit.click();
  await expect(zoomOut).toBeDisabled();
});

test("moves an entry a year later and to another lane with Alt and the arrows", async ({ page }) => {
  await openApp(page, "Timeline");
  await page.getByRole("button", { name: /^Astronomy: Kepler's laws/ }).focus();
  await page.keyboard.press("Alt+ArrowRight");
  const moved = page.getByRole("button", { name: /^Astronomy: Kepler's laws, 1610 CE/ });
  await expect(moved).toBeFocused();
  await expect(page.getByRole("table").getByRole("row", { name: /Kepler's laws/ })).toContainText("1610 CE – 1620 CE");
  await page.keyboard.press("Alt+ArrowDown");
  await expect(page.getByRole("button", { name: /^Medicine: Kepler's laws, 1610 CE/ })).toBeFocused();
});

test("writes the dates in the locale chosen", async ({ page }) => {
  await openApp(page, "Timeline");
  await page.getByLabel("Dates and numbers").selectOption("it-IT");
  await expect(page.getByRole("table").getByRole("row", { name: /Galileo/ })).toContainText("gennaio 1610");
});
