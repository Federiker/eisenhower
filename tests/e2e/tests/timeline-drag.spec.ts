import { expect, type Locator, type Page, test } from "@playwright/test";

import { centreOf, openApp } from "./app";

// Dragging entries on the "History of science" timeline with the mouse, in a real layout (the unit tests'
// DOM has none). The drawing fits the page: about a year a pixel around the 17th century.

const entry = (page: Page, name: RegExp) => page.getByRole("button", { name });
const row = (page: Page, title: RegExp) => page.getByRole("table").getByRole("row", { name: title });
/** An entry's dates in the entries' table: its row's first cell. */
const when = (page: Page, title: RegExp) => row(page, title).getByRole("cell").first();
/** The strip over a span's end that resizes it (hidden from screen readers: the keys do the same). */
const grip = (page: Page, id: string, part: "start" | "end") =>
  page.locator(`[data-grip="${id}"][data-part="${part}"]`);

/** Presses on an element's middle and moves the mouse by (dx, dy) in small steps, holding the button. */
async function drag(page: Page, from: Locator, dx: number, dy = 0) {
  const start = await centreOf(from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 8 });
}

test("drags a point along the axis by its precision: a year, or a day", async ({ page }) => {
  const errors = await openApp(page, "Timeline");
  const harvey = entry(page, /^Medicine: Harvey: the blood circulates/);
  await drag(page, harvey, 30);
  // While dragged, the title's tooltip says where it would go; nothing has changed yet.
  await expect(harvey).toHaveAttribute("title", /^\d{4} CE$/);
  const year = (await harvey.getAttribute("title")) ?? "";
  expect(Number.parseInt(year, 10)).toBeGreaterThan(1628);
  await expect(when(page, /Harvey/)).toHaveText("1628 CE");
  await page.mouse.up();
  // Dropped: a whole number of years later, still a year, in the table and the title's name.
  await expect(when(page, /Harvey/)).toHaveText(year);
  await expect(entry(page, /^Medicine: Harvey: the blood circulates/)).toHaveAccessibleName(
    `Medicine: Harvey: the blood circulates, ${year}`,
  );
  // The click that ends a drag opens nothing.
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const jenner = entry(page, /^Medicine: Jenner's first vaccination/);
  await drag(page, jenner, -30);
  // A day's date moves by days: still a day, a month and a year, and earlier.
  await expect(jenner).toHaveAttribute("title", /^\d{1,2} [A-Z][a-z]+ \d{4} CE$/);
  const day = (await jenner.getAttribute("title")) ?? "";
  await page.mouse.up();
  expect(Number.parseInt(day.split(" ")[2] ?? "", 10)).toBeLessThan(1796);
  await expect(when(page, /Jenner/)).toHaveText(day);
  expect(errors).toEqual([]);
});

test("drags an entry to another lane, changing its category and keeping its date", async ({ page }) => {
  await openApp(page, "Timeline");
  const harvey = entry(page, /^Medicine: Harvey: the blood circulates/);
  const lane = await centreOf(entry(page, /^Physics and chemistry: Lavoisier's Traité/));
  const from = await centreOf(harvey);
  await drag(page, harvey, 0, lane.y - from.y);
  await page.mouse.up();
  const moved = entry(page, /^Physics and chemistry: Harvey: the blood circulates, 1628 CE$/);
  await expect(moved).toBeFocused();
  await expect(row(page, /Harvey/)).toContainText("Physics and chemistry");
  await expect(when(page, /Harvey/)).toHaveText("1628 CE");
  // The click that ended the drag opened nothing; the next one opens the entry.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await moved.click();
  await expect(page.getByRole("dialog", { name: "Harvey: the blood circulates" })).toBeVisible();
});

test("resizes a span by its end, never to or past its start", async ({ page }) => {
  await openApp(page, "Timeline");
  const span = when(page, /The Hippocratic writings/);
  await expect(span).toHaveText("c. 430 BCE – c. 330 BCE");
  // Later: the end moves by whole years, the start stays.
  await drag(page, grip(page, "e-hippocrates", "end"), 40);
  await page.mouse.up();
  await expect(span).toHaveText(/^c\. 430 BCE – c\. \d+ BCE$/);
  const end = Number(/– c\. (\d+) BCE$/.exec((await span.textContent()) ?? "")?.[1]);
  expect(end).toBeLessThan(330);
  expect(end).toBeGreaterThan(200);
  // Dragged far past its start, the end stops a year after it.
  await drag(page, grip(page, "e-hippocrates", "end"), -400);
  await page.mouse.up();
  await expect(span).toHaveText("c. 430 BCE – c. 429 BCE");
  await expect(entry(page, /^Medicine: The Hippocratic writings/)).toHaveAccessibleName(
    "Medicine: The Hippocratic writings, c. 430 BCE to c. 429 BCE",
  );
});

test("Escape during a drag drops nothing", async ({ page }) => {
  await openApp(page, "Timeline");
  const harvey = entry(page, /^Medicine: Harvey: the blood circulates/);
  const lane = await centreOf(entry(page, /^Physics and chemistry: Lavoisier's Traité/));
  const from = await centreOf(harvey);
  await drag(page, harvey, 40, lane.y - from.y);
  await expect(page.locator(".eh-timeline-preview")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".eh-timeline-preview")).toHaveCount(0);
  await page.mouse.up();
  await expect(entry(page, /^Medicine: Harvey: the blood circulates, 1628 CE$/)).toBeVisible();
  await expect(row(page, /Harvey/)).toContainText("Medicine");
  await expect(when(page, /Harvey/)).toHaveText("1628 CE");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // The next click opens the entry.
  await harvey.click();
  await expect(page.getByRole("dialog", { name: "Harvey: the blood circulates" })).toBeVisible();
});
