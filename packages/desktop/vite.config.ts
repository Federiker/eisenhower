import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The desktop app: the Tauri window's interface (`mise run app:dev`), and its preview in the browser.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1441, strictPort: true },
  build: { target: "es2022" },
});
