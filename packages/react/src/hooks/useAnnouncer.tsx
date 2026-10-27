import { useCallback, useState } from "react";

/**
 * What a view announces politely after a move ("Draft: moved to Doing, 2 of 3"), as jerome's plot board
 * does: `announce` sets the text, `<LiveRegion message={message} />` speaks it. The same text twice is
 * announced twice (a no-break space is added every other time, so screen readers hear a change).
 */
export function useAnnouncer(): { message: string; announce: (text: string) => void } {
  const [said, setSaid] = useState({ text: "", count: 0 });
  const announce = useCallback((text: string) => setSaid((old) => ({ text, count: old.count + 1 })), []);
  return { message: said.text === "" ? "" : `${said.text}${said.count % 2 === 0 ? " " : ""}`, announce };
}

/**
 * A polite live region (`role="status"`), heard by screen readers and hidden on screen. Draw it once in the
 * view, from the start (a live region added with its text is not always announced).
 */
export function LiveRegion({ message }: { message: string }) {
  return (
    <div role="status" aria-live="polite" className="eh-visually-hidden">
      {message}
    </div>
  );
}
