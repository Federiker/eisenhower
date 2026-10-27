import { expect, test } from "@playwright/test";

import { openApp, saved } from "./app";

test("shows the sample list with its subtasks, tags and overdue items", async ({ page }) => {
  const errors = await openApp(page, "Todo");
  const items = page.getByRole("list", { name: "Items" });
  await expect(items.getByRole("checkbox", { name: "Send the tax return" })).toBeVisible();
  await expect(items.getByRole("list", { name: "Subtasks of Quarterly report" })).toBeVisible();
  await expect(items.getByText(/^Overdue: due /)).toHaveCount(2);
  await expect(items.getByRole("checkbox", { name: "Book a meeting room" })).toBeChecked();
  expect(errors).toEqual([]);
});

test("ticks a subtask, and its parent counts it", async ({ page }) => {
  await openApp(page, "Todo");
  const items = page.getByRole("list", { name: "Items" });
  await expect(items.getByText("1 of 2 done")).toBeVisible();
  await items.getByRole("checkbox", { name: "Write the summary" }).check();
  await expect(items.getByRole("checkbox", { name: "Write the summary" })).toBeChecked();
  await expect(items.getByText("2 of 2 done")).toBeVisible();
});

test("filters by tag: an item with any tag pressed is shown", async ({ page }) => {
  await openApp(page, "Todo");
  const items = page.getByRole("list", { name: "Items" });
  await page.getByRole("button", { name: "Garden", exact: true }).click();
  await expect(items.getByRole("checkbox", { name: "Look at seed catalogues" })).toBeVisible();
  await expect(items.getByRole("checkbox", { name: "Paint the shed" })).toBeVisible();
  await expect(items.getByRole("checkbox", { name: "Send the tax return" })).toHaveCount(0);
  await expect(items.getByRole("checkbox", { name: "Plan a first-aid course" })).toHaveCount(0);

  // A second tag widens the list.
  await page.getByRole("button", { name: "Work", exact: true }).click();
  await expect(items.getByRole("checkbox", { name: "Plan a first-aid course" })).toBeVisible();
  await expect(items.getByRole("checkbox", { name: "Look at seed catalogues" })).toBeVisible();
  await expect(items.getByRole("checkbox", { name: "Send the tax return" })).toHaveCount(0);

  await page.getByRole("button", { name: "All tags", exact: true }).click();
  await expect(items.getByRole("checkbox", { name: "Send the tax return" })).toBeVisible();
});

test("drags an item between the matrix's quadrants, and moves one with Alt and the arrows", async ({ page }) => {
  await openApp(page, "Todo");
  await page.getByRole("button", { name: "Matrix", exact: true }).click();
  const quadrant = (name: string) => page.getByRole("region", { name, exact: true });
  await expect(quadrant("Drop").getByRole("checkbox", { name: "Sort the old magazines" })).toBeVisible();

  const item = quadrant("Drop")
    .getByRole("listitem")
    .filter({ has: page.getByRole("checkbox", { name: "Sort the old magazines" }) });
  await item.dragTo(quadrant("Do").getByRole("heading", { name: "Do" }));
  await expect(quadrant("Do").getByRole("checkbox", { name: "Sort the old magazines" })).toBeVisible();
  await expect(quadrant("Drop").getByRole("checkbox", { name: "Sort the old magazines" })).toHaveCount(0);

  // Alt+→ from Do (urgent and important) goes to Schedule (important, not urgent).
  await quadrant("Do").getByRole("checkbox", { name: "Sort the old magazines" }).focus();
  await page.keyboard.press("Alt+ArrowRight");
  await expect(quadrant("Schedule").getByRole("checkbox", { name: "Sort the old magazines" })).toBeFocused();
  await saved(page);
});
