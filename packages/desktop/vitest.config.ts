import react from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

export default defineProject({
  plugins: [react()],
  test: {
    name: "@eisenhower/desktop",
    // happy-dom, with Tauri's IPC mocks on `window` standing in for the native window.
    environment: "happy-dom",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
  },
});
