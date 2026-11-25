import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

/** How tall the probe is at the views' own text size: the factor is its height over this. */
const PROBE = 100;

/**
 * The text size the views are drawn at, as a factor of their own (the host's `--eh-scale`), for drawings laid
 * out in pixels that must grow with their text. It is measured from a hidden probe `calc(100px *
 * var(--eh-scale))` high, which the caller puts in its tree, and followed as the host changes it; 1 where it
 * cannot be measured (no layout, as in tests without a browser).
 */
export function useTextScale(): { text: number; probe: ReactNode } {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [text, setText] = useState(1);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => {
      const height = element.offsetHeight;
      if (height > 0) setText(height / PROBE);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const probe = (
    <span className="eh-text-probe-holder" aria-hidden="true">
      <span ref={ref} className="eh-text-probe" />
    </span>
  );
  return { text, probe };
}
