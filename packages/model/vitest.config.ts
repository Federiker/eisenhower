import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@eisenhower/model",
    // happy-dom for `localStorage` and `crypto.subtle`, which the storage adapters use.
    environment: "happy-dom",
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});
