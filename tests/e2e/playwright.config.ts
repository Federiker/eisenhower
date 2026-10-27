import { defineConfig, devices } from "@playwright/test";

// The demo app in the browser (`mise run test:e2e`): Vite serves it, Chromium (WebView2's engine) drives it.
export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  fullyParallel: true,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: "http://127.0.0.1:1440", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
  webServer: {
    command: "bun run --filter @eisenhower/app dev",
    cwd: "../..",
    url: "http://127.0.0.1:1440",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
