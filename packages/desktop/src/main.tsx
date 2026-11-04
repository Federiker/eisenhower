import "@eisenhower/react/style.css";
import "./app.css";

import { isTauri } from "@tauri-apps/api/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { previewHost } from "./host/preview";
import { tauriHost } from "./host/tauri";

// In the Tauri window the app works on files on disk; anywhere else it is the preview.
const host = isTauri() ? tauriHost() : previewHost();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App host={host} />
  </StrictMode>,
);
