import { expect, type Locator, type Page } from "@playwright/test";

export type Tab = "Board" | "Timeline" | "Gantt" | "Todo";

/**
 * Opens the demo app on a tab and waits for its view; returns the page's errors, which a test expects to be
 * none. Each test has a browser context of its own, so its `localStorage` starts empty: the samples.
 */
export async function openApp(page: Page, tab: Tab = "Board"): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(`/#${tab.toLowerCase()}`);
  await expect(page.getByRole("tab", { name: tab, selected: true })).toBeVisible();
  await expect(saveState(page)).toHaveText("Saved in this browser");
  return errors;
}

/** What the browser host says about the document shown: saved, saving or not saved. */
export const saveState = (page: Page) => page.locator(".app-save-state");

/** Waits until the change just made is in `localStorage`. */
export async function saved(page: Page) {
  await expect(saveState(page)).toHaveAttribute("data-saved", "true");
}

/** A region's left edge on the page, to compare where columns stand. */
export async function leftOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("not drawn");
  return box.x;
}

/** The middle of an element, for the mouse. */
export async function centreOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("not drawn");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * A drag with the mouse, from the middle of one element to the middle of another, in steps: the views' drags
 * are pointer drags, which Playwright's `dragTo` (the browser's drag and drop) does not make.
 */
export async function dragWithMouse(page: Page, from: Locator, to: Locator) {
  const start = await centreOf(from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 12, start.y + 12, { steps: 4 });
  // Where the target is once the drag has begun (the board offers No column then).
  const end = await centreOf(to);
  await page.mouse.move(end.x, end.y, { steps: 10 });
  await page.mouse.up();
}
