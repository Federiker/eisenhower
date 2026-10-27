import { expect, test } from "@playwright/test";

import { centreOf, leftOf, openApp, saved } from "./app";

test("shows the sample board, and the same cards as a list", async ({ page }) => {
  const errors = await openApp(page, "Board");
  const board = page.getByRole("region", { name: "Board" });
  for (const column of ["To sort out", "Under way", "Booked", "Done"]) {
    await expect(board.getByRole("region", { name: column })).toBeVisible();
  }
  await expect(board.getByRole("button", { name: "Hire a van", exact: true })).toBeVisible();
  // No card is outside the columns, so there is no "No column" column.
  await expect(board.getByRole("region", { name: "No column" })).toHaveCount(0);

  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.getByRole("button", { name: "List", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(board.getByRole("heading", { name: "Under way" })).toBeVisible();
  await expect(board.getByRole("button", { name: "Pack the kitchen", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("offers No column after the others while a card is dragged, and puts it first once a card is dropped there", async ({
  page,
}) => {
  await openApp(page, "Board");
  const board = page.getByRole("region", { name: "Board" });
  const card = board
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Hire a van", exact: true }) });
  const noColumn = board.getByRole("region", { name: "No column" });
  const done = board.getByRole("region", { name: "Done" });

  // A real drag with the mouse: Chromium runs HTML5 drag and drop from the pointer's moves.
  const from = await centreOf(card);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 20, from.y + 20, { steps: 4 });
  await expect(noColumn).toBeVisible();
  await expect(noColumn).toContainText("Drop a card here to take it out of its column.");
  expect(await leftOf(noColumn)).toBeGreaterThan(await leftOf(done));

  const to = await centreOf(noColumn);
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();

  await expect(noColumn.getByRole("button", { name: "Hire a van", exact: true })).toBeVisible();
  await expect(
    board.getByRole("region", { name: "To sort out" }).getByRole("button", { name: "Hire a van", exact: true }),
  ).toHaveCount(0);
  // Now it has a card, No column is the first column.
  expect(await leftOf(noColumn)).toBeLessThan(await leftOf(board.getByRole("region", { name: "To sort out" })));
  await expect(page.getByRole("status").first()).toContainText("Hire a van: moved to No column, 1 of 1");
});

test("drags a card onto another column", async ({ page }) => {
  await openApp(page, "Board");
  const board = page.getByRole("region", { name: "Board" });
  const card = board
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Redirect the post", exact: true }) });
  await card.dragTo(board.getByRole("region", { name: "Booked" }));
  await expect(
    board.getByRole("region", { name: "Booked" }).getByRole("button", { name: "Redirect the post", exact: true }),
  ).toBeVisible();
  await expect(board.getByRole("region", { name: "No column" })).toHaveCount(0);
});

test("moves a card with Alt and the arrows, keeping the focus on it, and undoes it with Ctrl+Z", async ({ page }) => {
  await openApp(page, "Board");
  const board = page.getByRole("region", { name: "Board" });
  const title = board.getByRole("button", { name: "Pack the books", exact: true });
  await title.focus();
  await page.keyboard.press("Alt+ArrowRight");
  await expect(
    board.getByRole("region", { name: "Booked" }).getByRole("button", { name: "Pack the books", exact: true }),
  ).toBeVisible();
  await expect(board.getByRole("button", { name: "Pack the books", exact: true })).toBeFocused();
  await page.keyboard.press("Alt+ArrowDown");
  const booked = board.getByRole("region", { name: "Booked" }).getByRole("listitem");
  await expect(booked.nth(1)).toContainText("Pack the books");

  await page.keyboard.press("Control+z");
  await expect(booked.nth(0)).toContainText("Pack the books");
  await page.keyboard.press("Control+z");
  await expect(
    board.getByRole("region", { name: "Under way" }).getByRole("button", { name: "Pack the books", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Control+y");
  await expect(
    board.getByRole("region", { name: "Booked" }).getByRole("button", { name: "Pack the books", exact: true }),
  ).toBeVisible();
  await saved(page);
});
