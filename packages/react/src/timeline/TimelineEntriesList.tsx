import { sortedEntries, type TimelineCategory, type TimelineEntry } from "@eisenhower/model";
import { useState } from "react";

import { Button } from "../controls/Button";
import { placeBelow } from "../controls/ContextMenu";
import { Notice } from "../controls/Notice";
import { actionOf, shortcutsIn } from "../keyboard/shortcuts";
import { type TimelineView, useTimelineView } from "./context";
import { formatWhen } from "./format";
import { CategorySwatch } from "./labels";

const KEYS = shortcutsIn("timeline");
/** The table's columns: when, title and summary (a group's heading names the category). */
const COLUMNS = 3;

/**
 * A timeline's entries as a table (jerome's), grouped by category in the categories' order, each group in time
 * order: when, title and summary. A group's heading folds and unfolds its rows, for the view only (never
 * stored); categories without entries are left out. Choosing a title opens the entry; a right-click on a row,
 * or the Menu key on its title, opens its menu, and Delete asks to delete it.
 */
export function TimelineEntriesList() {
  const view = useTimelineView();
  const { timeline, words, readOnly } = view;
  const { t } = words;
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set());
  const entries = sortedEntries(timeline);
  const groups = timeline.categories
    .map((category) => ({ category, entries: entries.filter((entry) => entry.categoryId === category.id) }))
    .filter((group) => group.entries.length > 0);

  function toggle(id: string) {
    setFolded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

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
              <th scope="col">{t("timeline.entry.summary")}</th>
            </tr>
          </thead>
          {groups.map((group) => (
            <EntriesGroup
              key={group.category.id}
              category={group.category}
              entries={group.entries}
              folded={folded.has(group.category.id)}
              onToggle={() => toggle(group.category.id)}
              view={view}
            />
          ))}
        </table>
      )}
      {entries.length > 0 && !readOnly && <Notice>{t("timeline.entriesHelp")}</Notice>}
    </section>
  );
}

/** A category's rows: its heading, which folds and unfolds them, then its entries unless folded. */
function EntriesGroup({
  category,
  entries,
  folded,
  onToggle,
  view,
}: {
  category: TimelineCategory;
  entries: TimelineEntry[];
  folded: boolean;
  onToggle: () => void;
  view: TimelineView;
}) {
  const { t } = view.words;
  const count = entries.length;
  return (
    <tbody>
      <tr className="eh-timeline-entries-group">
        <th scope="rowgroup" colSpan={COLUMNS}>
          <button
            type="button"
            className="eh-timeline-entries-toggle"
            aria-expanded={!folded}
            aria-label={t("timeline.entriesGroup", { name: category.name, count })}
            onClick={onToggle}
          >
            <span className="eh-timeline-chevron" aria-hidden="true">
              {folded ? "▸" : "▾"}
            </span>
            <span className="eh-timeline-category">
              <CategorySwatch category={category} />
              {category.name}
            </span>
            <span className="eh-timeline-entries-count">{t("timeline.entriesCount", { count })}</span>
          </button>
        </th>
      </tr>
      {!folded && entries.map((entry) => <EntryRow key={entry.id} entry={entry} view={view} />)}
    </tbody>
  );
}

/** An entry's row: when, its title (a button that opens it) and its summary. */
function EntryRow({ entry, view }: { entry: TimelineEntry; view: TimelineView }) {
  const { timeline, showCe, words, selectedId, readOnly } = view;
  const selected = selectedId === entry.id;
  return (
    <tr
      data-selected={selected ? "true" : undefined}
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
          aria-current={selected ? "true" : undefined}
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
      <td>{entry.summary}</td>
    </tr>
  );
}
