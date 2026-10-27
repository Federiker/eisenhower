import { type KeyboardEvent, useRef } from "react";

export type TabSpec<T extends string> = { id: T; label: string };

/**
 * A tab list (WAI-ARIA's tabs pattern, activated as the focus moves): the selected tab is the one Tab stop,
 * ← and → move to the tab before or after (wrapping), Home and End to the first and last. The tab with id
 * `x` is `tab-x` and controls the panel `panel-x`. These keys are the app's, not the views'.
 */
export function Tabs<T extends string>({
  label,
  tabs,
  selected,
  onSelect,
}: {
  label: string;
  tabs: readonly TabSpec<T>[];
  selected: T;
  onSelect: (id: T) => void;
}) {
  const list = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === selected);
    const moves: Record<string, number> = {
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      Home: 0,
      End: tabs.length - 1,
    };
    const to = moves[event.key];
    if (to === undefined || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const next = tabs[(to + tabs.length) % tabs.length];
    if (!next) return;
    onSelect(next.id);
    list.current?.querySelector<HTMLElement>(`#tab-${next.id}`)?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className="app-tabs" ref={list} onKeyDown={onKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`tab-${tab.id}`}
          aria-selected={tab.id === selected}
          aria-controls={`panel-${tab.id}`}
          tabIndex={tab.id === selected ? 0 : -1}
          className="app-tab"
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
