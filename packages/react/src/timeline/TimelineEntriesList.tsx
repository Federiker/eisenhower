import { sortedEntries } from "@eisenhower/model";

import { Button } from "../controls/Button";
import { placeBelow } from "../controls/ContextMenu";
import { Notice } from "../controls/Notice";
import { actionOf, shortcutsIn } from "../keyboard/shortcuts";
import { useTimelineView } from "./context";
import { formatWhen } from "./format";
import { CategorySwatch } from "./labels";

const KEYS = shortcutsIn("timeline");

/**
 * A timeline's entries as a table in time order (jerome's): when, title, category and summary. Choosing a
 * title opens the entry; a right-click on a row, or the Menu key on its title, opens its menu, and Delete
 * asks to delete it.
 */
export function TimelineEntriesList() {
  const view = useTimelineView();
  const { timeline, showCe, words, selectedId, readOnly } = view;
  const { t } = words;
  const entries = sortedEntries(timeline);
  const categories = new Map(timeline.categories.map((category) => [category.id, category]));
  return (
    <section className="eh-timeline-entries" aria-label={t("timeline.entries")} data-area="entries">
      <h3>{t("timeline.entries")}</h3>
      {entries.length === 0 ? (
        <Notice>{t("timeline.entriesEmpty")}</Notice>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">{t("timeline.when")}</th>
              <th scope="col">{t("timeline.entry.title")}</th>
              <th scope="col">{t("timeline.entry.category")}</th>
              <th scope="col">{t("timeline.entry.summary")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const category = categories.get(entry.categoryId);
              return (
                <tr
                  key={entry.id}
                  data-selected={selectedId === entry.id ? "true" : undefined}
                  onContextMenu={(event) => {
                    if (readOnly) return;
                    event.preventDefault();
                    const title = event.currentTarget.querySelector<HTMLElement>("[data-entry]");
                    view.openMenu(entry.id, { left: event.clientX, top: event.clientY }, title ?? event.currentTarget);
                  }}
                >
                  <td>{formatWhen(entry, timeline, showCe, words)}</td>
                  <td>
                    <Button
                      variant="quiet"
                      className="eh-timeline-entry-link"
                      data-entry={entry.id}
                      aria-current={selectedId === entry.id ? "true" : undefined}
                      onClick={(event) => view.openEntry(entry.id, event.currentTarget)}
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
                  </td>
                  <td>
                    {category && (
                      <span className="eh-timeline-category">
                        <CategorySwatch category={category} />
                        {category.name}
                      </span>
                    )}
                  </td>
                  <td>{entry.summary}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {entries.length > 0 && !readOnly && <Notice>{t("timeline.entriesHelp")}</Notice>}
    </section>
  );
}
