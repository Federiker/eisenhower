import { sortedEntries, type TimelineEntry } from "@eisenhower/model";

import { Button } from "../controls/Button";
import { placeBelow } from "../controls/ContextMenu";
import { Notice } from "../controls/Notice";
import { actionOf, shortcutsIn } from "../keyboard/shortcuts";
import { useTimelineView } from "./context";
import { formatPoint } from "./format";
import { CategorySwatch } from "./labels";

const KEYS = shortcutsIn("timeline");

/**
 * The drawing in a narrow space (jerome's): the entries grouped under the step or date they start at, in
 * time order, each with its category's swatch and, for a span, where it ends. An entry opens with a click
 * or Enter; its menu opens with a right-click or the Menu key, and Delete asks to delete it.
 */
export function TimelineNarrowList() {
  const view = useTimelineView();
  const { timeline, showCe, words, selectedId, readOnly } = view;
  const categories = new Map(timeline.categories.map((category) => [category.id, category]));
  const groups: { label: string; entries: TimelineEntry[] }[] = [];
  for (const entry of sortedEntries(timeline)) {
    const label = formatPoint(entry.start, timeline, showCe, words);
    const last = groups.at(-1);
    if (last && last.label === label) last.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  }
  return (
    <div className="eh-timeline-narrow" data-area="narrow">
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h4>{group.label}</h4>
          <ul>
            {group.entries.map((entry) => {
              const category = categories.get(entry.categoryId);
              return (
                <li key={entry.id}>
                  {category && <CategorySwatch category={category} />}
                  <Button
                    variant="quiet"
                    className="eh-timeline-entry-link"
                    data-entry={entry.id}
                    aria-current={selectedId === entry.id ? "true" : undefined}
                    onClick={(event) => view.openEntry(entry.id, event.currentTarget)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      view.openMenu(entry.id, { left: event.clientX, top: event.clientY }, event.currentTarget);
                    }}
                    onKeyDown={(event) => {
                      const action = actionOf(event.nativeEvent, KEYS);
                      if (action === "menu") {
                        event.preventDefault();
                        view.openMenu(entry.id, placeBelow(event.currentTarget), event.currentTarget);
                      } else if (action === "delete" && !readOnly) {
                        event.preventDefault();
                        view.askDelete(entry.id, event.currentTarget);
                      }
                    }}
                  >
                    {entry.title}
                  </Button>
                  {category && <Notice as="span">{category.name}</Notice>}
                  {entry.end && (
                    <Notice as="span">
                      {words.t("timeline.spanTo", { end: formatPoint(entry.end, timeline, showCe, words) })}
                    </Notice>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
