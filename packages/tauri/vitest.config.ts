import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@eisenhower/tauri",
    // Tauri's IPC mocks live on `window`; the model's `textRevision` uses `crypto.subtle`.
    environment: "happy-dom",
    include: ["tests/**/*.test.ts"],
  },
});
