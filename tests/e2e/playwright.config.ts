import { defineConfig, devices } from "@playwright/test";

const browser = { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } };

// The demo app in the browser (`mise run test:e2e`): Vite serves it, Chromium (WebView2's engine) drives it.
// The screenshots in docs/screenshots are a project of their own (`mise run screenshots`), not run as a test.
export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  fullyParallel: true,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: "http://127.0.0.1:1440", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", testIgnore: /screenshots\.spec\.ts/, use: browser },
    {
      name: "screenshots",
      testMatch: /screenshots\.spec\.ts/,
      use: { ...browser, viewport: { width: 1280, height: 760 } },
    },
  ],
  webServer: {
    command: "bun run --filter @eisenhower/app dev",
    cwd: "../..",
    url: "http://127.0.0.1:1440",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
