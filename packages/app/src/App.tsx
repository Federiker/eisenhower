import { EisenhowerProvider } from "@eisenhower/react";

/** The demo app (decision 14): each view with a sample document, in the browser or the Tauri window. */
export function App() {
  return (
    <EisenhowerProvider>
      <h1>Eisenhower</h1>
    </EisenhowerProvider>
  );
}
