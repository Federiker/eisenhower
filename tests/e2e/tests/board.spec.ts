import { expect, test } from "@playwright/test";

import { centreOf, dragWithMouse, leftOf, openApp, saved } from "./app";

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

  // A real drag with the mouse: the board's drags are pointer drags.
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
  await dragWithMouse(page, card, board.getByRole("region", { name: "Booked" }));
  await expect(
    board.getByRole("region", { name: "Booked" }).getByRole("button", { name: "Redirect the post", exact: true }),
  ).toBeVisible();
  await expect(board.getByRole("region", { name: "No column" })).toHaveCount(0);
});

test("drags a card by its title before another, without opening it, and a column by its heading", async ({ page }) => {
  await openApp(page, "Board");
  const board = page.getByRole("region", { name: "Board" });
  const cardTitles = (column: string) =>
    board.getByRole("region", { name: column }).locator(".eh-board-card-title").allTextContents();
  const target = board
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Pack the books", exact: true }) });
  await dragWithMouse(page, board.getByRole("button", { name: "Hire a van", exact: true }), target);
  expect(await cardTitles("Under way")).toEqual(["Hire a van", "Pack the books", "Pack the kitchen"]);
  // The click as the mouse was let go on the title did not open the card.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status").first()).toContainText("Hire a van: moved to Under way, 1 of 3");
  await expect(board.getByRole("button", { name: "Hire a van", exact: true })).toBeFocused();

  const heading = (column: string) => board.getByRole("region", { name: column }).locator(".eh-board-column-heading");
  await dragWithMouse(page, heading("Done").getByRole("heading", { name: "Done" }), heading("To sort out"));
  expect(
    await board.locator(".eh-board-column").evaluateAll((all) => all.map((one) => one.getAttribute("aria-label"))),
  ).toEqual(["Done", "To sort out", "Under way", "Booked"]);
  await saved(page);
});

test("cancels a drag with Escape, and a click on a card's title still opens it", async ({ page }) => {
  await openApp(page, "Board");
  const board = page.getByRole("region", { name: "Board" });
  const title = board.getByRole("button", { name: "Removal firm", exact: true });
  const from = await centreOf(title);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 12, { steps: 4 });
  const to = await centreOf(board.getByRole("button", { name: "New card in Under way" }));
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await expect(board.getByRole("region", { name: "Under way" })).toHaveAttribute("data-drop", "inside");
  await page.keyboard.press("Escape");
  await expect(board.getByRole("region", { name: "Under way" })).not.toHaveAttribute("data-drop");
  await page.mouse.up();
  await expect(
    board.getByRole("region", { name: "Booked" }).getByRole("button", { name: "Removal firm", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await title.click();
  await expect(page.getByRole("dialog")).toBeVisible();
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

test("adds cards at a column's end from the field at its foot", async ({ page }) => {
  await openApp(page, "Board");
  const button = page.getByRole("button", { name: /^New card in / }).first();
  const column = (await button.getAttribute("aria-label"))!.replace("New card in ", "");
  await button.click();
  const field = page.getByRole("textbox", { name: `Title of the new card in ${column}` });
  await field.fill("Fix the gate");
  await field.press("Enter");
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("");
  await field.fill("Paint the shed");
  await field.press("Enter");
  await field.press("Escape");
  await expect(button).toBeFocused();
  const cards = page.getByRole("region", { name: column }).getByRole("listitem");
  await expect(cards.last()).toContainText("Paint the shed");
  await expect(cards.nth(-2)).toContainText("Fix the gate");
});

test("picks a card's colour in the colour picker, its list drawn whole over the dialog", async ({ page }) => {
  await openApp(page, "Board");
  const board = page.getByRole("region", { name: "Board" });
  await board.getByRole("button", { name: "Hire a van", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Hire a van" });
  const picker = dialog.getByRole("combobox", { name: "Colour" });
  await picker.click();
  const list = page.getByRole("listbox", { name: "Colour" });
  await expect(list.getByRole("option")).toHaveCount(9);
  // Every option is drawn inside the window, none cut off by the dialog's edges.
  const size = page.viewportSize()!;
  for (const option of await list.getByRole("option").all()) {
    const box = (await option.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height);
  }
  await expect(list.getByRole("option", { name: "Vermilion" })).toBeVisible();
  // Escape closes the list and leaves the dialog open, the focus on the picker.
  await picker.press("Escape");
  await expect(list).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(picker).toBeFocused();
  await picker.press("v");
  await picker.press("Enter");
  await expect(picker).toHaveText("Vermilion");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(board.getByRole("listitem").filter({ hasText: "Hire a van" })).toContainText("Vermilion");
  await saved(page);
});
