import { expect, type Page, test } from "@playwright/test";

import { openApp } from "./app";

/** A day `offset` days from today, written as the chart writes it ("6 Nov 2026"), by the page's own `Intl`. */
function dayFromToday(page: Page, offset: number): Promise<string> {
  return page.evaluate((days) => {
    const now = new Date();
    const day = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + days, 12));
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(day);
  }, offset);
}

const bar = (page: Page, name: string) =>
  page.getByRole("treegrid", { name: "Gantt chart" }).getByRole("button", { name: new RegExp(`^${name},`) });

test("shows the sample chart with its groups, milestones and the conflict, in words", async ({ page }) => {
  const errors = await openApp(page, "Gantt");
  const chart = page.getByRole("treegrid", { name: "Gantt chart" });
  await expect(chart.getByRole("row", { name: /Design/ }).first()).toBeVisible();
  await expect(chart.getByRole("button", { name: /^Launch day, milestone/ })).toBeVisible();
  // The press release starts before the copy it depends on is written: said above the chart and by the task.
  await expect(page.getByText("1 task starts before a task it depends on ends.")).toBeVisible();
  await expect(chart.getByText("Starts too early")).toBeVisible();
  await expect(bar(page, "Press release")).toHaveAccessibleName(/starts before Write the shop copy ends/);
  expect(errors).toEqual([]);
});

test("drags a bar to move its days, and its end to make it longer", async ({ page }) => {
  await openApp(page, "Gantt");
  await page.getByRole("button", { name: "Days", exact: true }).click();
  const copy = bar(page, "Write the shop copy");
  await copy.scrollIntoViewIfNeeded();
  await expect(copy).toHaveAccessibleName(
    `Write the shop copy, ${await dayFromToday(page, 10)} to ${await dayFromToday(page, 17)}, 8 days, 0% done`,
  );

  // The day scale draws a day 32 pixels wide: two days later.
  const box = (await copy.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 32, y, { steps: 4 });
  await page.mouse.move(box.x + box.width / 2 + 64, y, { steps: 4 });
  await page.mouse.up();
  await expect(copy).toHaveAccessibleName(
    `Write the shop copy, ${await dayFromToday(page, 12)} to ${await dayFromToday(page, 19)}, 8 days, 0% done`,
  );

  // Its end, three days later: the handle is at the bar's right edge. (Moving the copy pushed the press release
  // after it, so the note about a task starting too early is gone and the chart has moved up.)
  const moved = (await copy.boundingBox())!;
  const middle = moved.y + moved.height / 2;
  await page.mouse.move(moved.x + moved.width - 2, middle);
  await page.mouse.down();
  await page.mouse.move(moved.x + moved.width - 2 + 96, middle, { steps: 6 });
  await page.mouse.up();
  await expect(copy).toHaveAccessibleName(
    `Write the shop copy, ${await dayFromToday(page, 12)} to ${await dayFromToday(page, 22)}, 11 days, 0% done`,
  );
});

test("changes the scale with the keys, and moves a task and its end a day with Alt and the arrows", async ({
  page,
}) => {
  await openApp(page, "Gantt");
  const copy = bar(page, "Write the shop copy");
  await copy.focus();
  await page.keyboard.press("Control+=");
  await expect(page.getByRole("button", { name: "Days", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(copy).toBeFocused();
  // A step of the keys is a day on the day scale.
  await page.keyboard.press("Alt+ArrowLeft");
  await expect(copy).toHaveAccessibleName(
    `Write the shop copy, ${await dayFromToday(page, 9)} to ${await dayFromToday(page, 16)}, 8 days, 0% done`,
  );
  await expect(copy).toBeFocused();
  await page.keyboard.press("Alt+Shift+ArrowRight");
  await expect(copy).toHaveAccessibleName(
    `Write the shop copy, ${await dayFromToday(page, 9)} to ${await dayFromToday(page, 17)}, 9 days, 0% done`,
  );
  await page.keyboard.press("Control+-");
  await expect(page.getByRole("button", { name: "Weeks", exact: true })).toHaveAttribute("aria-pressed", "true");
});

/** Ctrl+drag from the middle of one bar to the middle of another, and the drop. */
async function linkDrag(page: Page, from: string, to: string) {
  const a = (await bar(page, from).boundingBox())!;
  const b = (await bar(page, to).boundingBox())!;
  await page.keyboard.down("Control");
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up("Control");
}

test("links a task to the one it depends on with Ctrl+drag, and refuses a cycle with its reason", async ({ page }) => {
  const errors = await openApp(page, "Gantt");
  await page.getByRole("button", { name: "Days", exact: true }).click();
  await bar(page, "Write the shop copy").scrollIntoViewIfNeeded();
  const status = page.locator(".eh-gantt-view").getByRole("status");
  await linkDrag(page, "Write the shop copy", "Test in the rain");
  await expect(status).toHaveText(/^Test in the rain now depends on Write the shop copy/);
  // The press release depends on the shop copy, so the copy cannot depend on it.
  await linkDrag(page, "Press release", "Write the shop copy");
  await expect(status).toHaveText("This task depends on that one, so that one cannot depend on it.");
  expect(errors).toEqual([]);
});

test("pushes the tasks after a moved one with Move dependent tasks, and not without it", async ({ page }) => {
  await openApp(page, "Gantt");
  await page.getByRole("button", { name: "Days", exact: true }).click();
  const status = page.locator(".eh-gantt-view").getByRole("status");
  const toggle = page.getByRole("button", { name: "Move dependent tasks" });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  const drag = async () => {
    const box = (await bar(page, "Print a prototype").boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 4 * 32, y, { steps: 6 });
    await page.mouse.up();
  };
  await drag();
  await expect(status).toHaveText(/^Print a prototype: moved to .*; \d+ tasks? after it moved too\s*$/);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await drag();
  await expect(status).toHaveText(/^Print a prototype: moved to [^;]*$/);
});

test("drags a task up the rows by its name into another group", async ({ page }) => {
  await openApp(page, "Gantt");
  const from = page.locator(".eh-gantt-task-name", { hasText: "Write the brief" });
  const to = page.locator(".eh-gantt-task-name", { hasText: "Print a prototype" });
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + 10, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 10, b.y + b.height - 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator(".eh-gantt-view").getByRole("status")).toHaveText(
    /^Write the brief: moved to Design, 3 of 4/,
  );
});
