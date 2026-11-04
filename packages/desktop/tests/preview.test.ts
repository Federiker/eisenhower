import { afterEach, describe, expect, it, vi } from "vitest";

import { PREVIEW_PREFIX, previewHost } from "../src/host/preview";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("the preview host", () => {
  it("keeps its files in the browser, by path", async () => {
    const storage = previewHost().storage;
    const revision = await storage.write("/Preview/a.json", "{}\n");
    expect(localStorage.getItem(`${PREVIEW_PREFIX}/Preview/a.json`)).toBe("{}\n");
    expect(await storage.read("/Preview/a.json")).toEqual({ text: "{}\n", revision });
  });

  it("asks for paths and questions in the page", async () => {
    const prompt = vi.fn<typeof window.prompt>().mockReturnValueOnce("/Preview/b.json").mockReturnValueOnce("");
    window.prompt = prompt;
    window.confirm = vi.fn<typeof window.confirm>().mockReturnValue(true);
    const host = previewHost();
    expect(await host.chooseNewFile("b.json")).toBe("/Preview/b.json");
    expect(prompt).toHaveBeenCalledWith("Save the document as:", "/Preview/b.json");
    expect(await host.chooseFile()).toBeNull();
    expect(
      await host.ask({ title: "Unsaved changes", message: "Discard them?", ok: "Discard", cancel: "Cancel" }),
    ).toBe(true);
    expect(window.confirm).toHaveBeenCalledWith("Unsaved changes\n\nDiscard them?");
    expect(host.guardClose).toBeUndefined();
  });

  it("names the page", async () => {
    await previewHost().setTitle("a.json – Eisenhower");
    expect(document.title).toBe("a.json – Eisenhower");
  });
});
