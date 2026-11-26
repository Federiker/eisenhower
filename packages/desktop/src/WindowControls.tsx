import { type ReactNode, useEffect, useState } from "react";

import type { WindowCalls } from "./host/host";
import { appStrings as text } from "./strings";

/** The icons: thin lines on a 10-pixel grid, as Windows 11 draws its own (copied from jerome's WindowControls). */
const icon = (shape: ReactNode) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    stroke="currentColor"
    strokeWidth="1"
    aria-hidden="true"
    focusable="false"
  >
    {shape}
  </svg>
);
const MINIMISE = icon(<path d="M0 5.5h10" />);
const MAXIMISE = icon(<rect x="0.5" y="0.5" width="9" height="9" />);
const RESTORE = icon(
  <>
    <rect x="0.5" y="2.5" width="7" height="7" />
    <path d="M2.5 2.5v-2h7v7h-2" />
  </>,
);
const CLOSE = icon(<path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />);

/** Whether the window is maximised: read at first and again after each change of its size. */
function useMaximised(calls: WindowCalls, failed: (error: unknown) => void): boolean {
  const [maximised, setMaximised] = useState(false);
  useEffect(() => {
    let gone = false;
    let stop: (() => void) | undefined;
    const read = () =>
      calls.isMaximised().then((value) => {
        if (!gone) setMaximised(value);
      }, failed);
    calls
      .onResized(() => void read())
      .then(
        (unlisten) => {
          if (gone) unlisten();
          else stop = unlisten;
        },
        (error: unknown) => failed(error),
      );
    void read();
    return () => {
      gone = true;
      stop?.();
    };
  }, [calls, failed]);
  return maximised;
}

/**
 * The window's own minimise, maximise (or restore) and close buttons, for the window without the system's title
 * bar: borderless and as tall as the bar they end, named in their tooltips; close turns red under the pointer.
 * They are not in the Tab order, as the system's are not: the system's keys (Alt+F4, Windows+Up and Down) do the
 * same. Close asks to close the window as the system's button does, so unsaved changes are asked about first.
 */
export function WindowControls({ calls, failed }: { calls: WindowCalls; failed: (error: unknown) => void }) {
  const maximised = useMaximised(calls, failed);
  const run = (call: () => Promise<void>) => () => void call().catch(failed);
  const button = (label: string, shape: ReactNode, onClick: () => void, close = false) => (
    <button
      type="button"
      className="app-window-control"
      data-control={close ? "close" : undefined}
      aria-label={label}
      title={label}
      tabIndex={-1}
      onClick={onClick}
    >
      {shape}
    </button>
  );
  return (
    <div className="app-window-controls">
      {button(text.windowMinimise, MINIMISE, run(calls.minimise))}
      {maximised
        ? button(text.windowRestore, RESTORE, run(calls.toggleMaximise))
        : button(text.windowMaximise, MAXIMISE, run(calls.toggleMaximise))}
      {button(text.windowClose, CLOSE, run(calls.close), true)}
    </div>
  );
}
