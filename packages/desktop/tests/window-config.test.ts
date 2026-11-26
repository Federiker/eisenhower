import { describe, expect, it } from "vitest";

import capabilities from "../src-tauri/capabilities/main.json";
import macConfig from "../src-tauri/tauri.macos.conf.json";
import tauriConfig from "../src-tauri/tauri.conf.json";

const window = tauriConfig.app.windows[0] as Record<string, unknown>;
const macWindow = macConfig.app.windows[0] as Record<string, unknown>;

describe("the window", () => {
  it("has no system title bar on Windows and Linux, where the app draws its own", () => {
    expect(window.decorations).toBe(false);
    for (const permission of ["minimize", "toggle-maximize", "close", "start-dragging"]) {
      expect(capabilities.permissions).toContain(`core:window:allow-${permission}`);
    }
  });

  it("is painted in the app's background before the page shows, so a resize shows no white", () => {
    expect(window.backgroundColor).toBe("#f5f6f3");
  });

  it("keeps macOS's own window buttons over the app, without the title bar, and the window as elsewhere", () => {
    expect(macWindow).toMatchObject({ decorations: true, titleBarStyle: "Overlay", hiddenTitle: true });
    // The platform file replaces the whole window entry (a JSON Merge Patch replaces arrays): it repeats the rest.
    const { decorations: _decorations, titleBarStyle: _style, hiddenTitle: _hidden, ...rest } = macWindow;
    const { decorations: _shared, ...shared } = window;
    expect(rest).toEqual(shared);
  });
});
