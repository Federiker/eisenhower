import { expect, test } from "@playwright/test";

import { answerDialogues, documentText, fileText, openDesktop } from "./desktop";

const item = (id: string, title: string, urgent: boolean, important: boolean) => ({
  id,
  title,
  done: false,
  due: null,
  notes: "",
  tags: [],
  urgent,
  important,
  parentId: null,
});

test("creates a board, saves it with Ctrl+S, and opens it again from the recent list", async ({ page }) => {
  const errors = await openDesktop(page);
  await expect(page.getByText("No documents opened yet. Open one, or create a new one.")).toBeVisible();
  const asked = answerDialogues(page, "/Preview/Moving house.json");

  await page.getByRole("radio", { name: "Board" }).check();
  await page.getByRole("textbox", { name: "Name" }).fill("Moving house");
  await page.getByRole("button", { name: "Create…" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Moving house.json" })).toBeFocused();
  expect(asked).toEqual(["Save the document as:"]);
  await expect(page).toHaveTitle("Moving house.json – Eisenhower");

  await page.getByRole("button", { name: "New column" }).click();
  await expect(page.getByRole("heading", { level: 2, name: /Unsaved changes/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator("body").press("Control+s");
  await expect(page.getByRole("contentinfo").getByRole("status")).toHaveText("Saved Moving house.json.");
  expect(JSON.parse((await fileText(page, "/Preview/Moving house.json")) ?? "").data.columns).toHaveLength(1);

  await page.getByRole("button", { name: "Start" }).click();
  const recent = page.getByRole("list").getByRole("button");
  await expect(recent).toHaveCount(1);
  await expect(recent).toContainText("Moving house.json");
  await expect(recent).toContainText("Board");
  await expect(page).toHaveTitle("Eisenhower");

  await page.reload();
  await recent.click();
  await expect(page.getByRole("heading", { level: 2, name: "Moving house.json" })).toBeVisible();
  await expect(page.getByRole("region", { name: "New column" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("opens a file of any view, and refuses one that is not a document", async ({ page }) => {
  const errors = await openDesktop(page, {
    "/Preview/Week.json": documentText("todo", {
      items: [item("i1", "Water the tomatoes", true, true), item("i2", "Plan the shed", false, true)],
    }),
    "/Preview/notes.json": "not a document",
  });
  answerDialogues(page, "/Preview/notes.json", "/Preview/Week.json");

  await page.getByRole("button", { name: "Open…" }).click();
  await expect(page.getByRole("contentinfo").getByRole("alert")).toHaveText(
    "notes.json could not be opened. It is not JSON.",
  );
  await page.keyboard.press("Control+o");
  await expect(page.getByRole("heading", { level: 2, name: "Week.json" })).toBeVisible();
  await expect(page.getByText("Water the tomatoes")).toBeVisible();
  expect(errors).toEqual([]);
});

test("asks before leaving unsaved changes, and drops files that are gone from the list", async ({ page }) => {
  await openDesktop(page);
  const asked = answerDialogues(page, "/Preview/Draft.json", false, true);
  await page.getByRole("textbox", { name: "Name" }).fill("Draft");
  await page.getByRole("radio", { name: "Gantt chart" }).check();
  await page.getByRole("button", { name: "Create…" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Draft.json" })).toBeVisible();
  await page.getByRole("button", { name: "New task" }).first().click();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("heading", { level: 2, name: /Draft.json/ })).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("heading", { name: "Recent documents" })).toBeVisible();
  expect(asked.slice(1)).toEqual([
    "Unsaved changes\n\nDraft.json has changes that are not saved. Discard them?",
    "Unsaved changes\n\nDraft.json has changes that are not saved. Discard them?",
  ]);

  await page.evaluate(() => localStorage.removeItem("eisenhower-desktop-preview:/Preview/Draft.json"));
  await page.reload();
  await expect(page.getByText("No documents opened yet. Open one, or create a new one.")).toBeVisible();
});
