import {
  type DateDraft,
  deleteEntry,
  draftOf,
  type EntryDraft,
  type EntryPreset,
  entryFromDraft,
  newDraft,
  type PointDraft,
  putEntry,
  type Timeline,
} from "@eisenhower/model";
import { useEffect, useRef, useState } from "react";

import { Button } from "../controls/Button";
import { InlineQuestion } from "../controls/InlineQuestion";
import { Notice } from "../controls/Notice";
import { TreeDialog } from "../controls/TreeDialog";
import { useTimelineView } from "./context";
import { type DateWords, monthNames } from "./format";
import { ENTRY_PROBLEM_LABELS, PROBLEM_LABELS } from "./labels";

/** Where an entry is or a span starts or ends: a step, or a date typed in fields (a day once there is a month). */
function PointFields({
  legend,
  value,
  timeline,
  words,
  onChange,
}: {
  legend: string;
  value: PointDraft;
  timeline: Timeline;
  words: DateWords;
  onChange: (value: PointDraft) => void;
}) {
  const { t } = words;
  if ("step" in value) {
    return (
      <label className="eh-timeline-field">
        {legend}
        <select className="eh-field" value={value.step} onChange={(event) => onChange({ step: event.target.value })}>
          {!timeline.steps.some((step) => step.id === value.step) && (
            <option value="">{t("timeline.entry.chooseStep")}</option>
          )}
          {timeline.steps.map((step) => (
            <option key={step.id} value={step.id}>
              {step.name}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const edit = (change: Partial<DateDraft>) => onChange({ ...value, ...change });
  return (
    <fieldset className="eh-timeline-date">
      <legend>{legend}</legend>
      <label>
        {t("timeline.entry.year")}
        <input
          className="eh-field"
          inputMode="numeric"
          size={8}
          value={value.year}
          onChange={(event) => edit({ year: event.target.value })}
        />
      </label>
      <label>
        {t("timeline.entry.era")}
        <select
          className="eh-field"
          value={value.bce ? "bce" : "ce"}
          onChange={(event) => edit({ bce: event.target.value === "bce" })}
        >
          <option value="ce">{t("timeline.entry.ce")}</option>
          <option value="bce">{t("timeline.entry.bce")}</option>
        </select>
      </label>
      <label>
        {t("timeline.entry.month")}
        <select
          className="eh-field"
          value={value.month}
          onChange={(event) => edit({ month: event.target.value, day: event.target.value === "" ? "" : value.day })}
        >
          <option value="">{t("timeline.entry.noMonth")}</option>
          {monthNames(words.locale).map((month, index) => (
            <option key={month} value={String(index + 1)}>
              {month}
            </option>
          ))}
        </select>
      </label>
      {value.month !== "" && (
        <label>
          {t("timeline.entry.day")}
          <input
            className="eh-field"
            inputMode="numeric"
            size={3}
            value={value.day}
            onChange={(event) => edit({ day: event.target.value })}
          />
        </label>
      )}
      <label>
        <input
          type="checkbox"
          className="eh-checkbox"
          checked={value.approximate}
          onChange={(event) => edit({ approximate: event.target.checked })}
        />
        {t("timeline.entry.approximate")}
      </label>
    </fieldset>
  );
}

/**
 * An entry in a modal dialog (jerome's): its title, category, where it is (or the two ends of its span) and a
 * one-line summary. Changes are kept only on Save, which lists every reason it cannot save, else reports the
 * timeline with the entry and closes. Cancel or Escape discards them, asking first when something changed.
 * A saved entry can be deleted from here, after asking. Read only, the fields cannot be changed and Close
 * closes.
 */
export function TimelineEntryDialog({
  entryId,
  preset = null,
  onClose,
}: {
  /** The entry, which need not be saved yet. */
  entryId: string;
  /** Where a new entry was begun on the drawing. */
  preset?: EntryPreset | null;
  /** Closes the dialog: `saved` is the entry's id once it is in the timeline, null when it is not (any more). */
  onClose: (saved: string | null) => void;
}) {
  const view = useTimelineView();
  const { timeline, readOnly, words } = view;
  const { t } = words;
  const saved = timeline.entries.find((entry) => entry.id === entryId) ?? null;
  const [initial] = useState<EntryDraft>(() => (saved ? draftOf(saved) : newDraft(timeline, preset)));
  const [draft, setDraft] = useState<EntryDraft>(initial);
  // Reasons are shown once Save was tried, and follow the fields from then on.
  const [tried, setTried] = useState(false);
  const [asking, setAsking] = useState<"discard" | "delete" | null>(null);
  const titleInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleInput.current?.focus();
  }, []);

  const result = entryFromDraft(draft, entryId, timeline);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const title = saved ? saved.title : t("timeline.newEntry");

  function save() {
    if (readOnly) {
      onClose(saved ? entryId : null);
      return;
    }
    // An unchanged saved entry has nothing to save; a new one is checked and made even when left as it opened.
    if (!dirty && saved) {
      onClose(entryId);
      return;
    }
    setTried(true);
    if (!("entry" in result)) return;
    const entry = result.entry;
    if (view.change((current) => putEntry(current, entry))) onClose(entryId);
  }

  function cancel() {
    if (dirty && !readOnly) setAsking("discard");
    else onClose(saved ? entryId : null);
  }

  function remove() {
    if (view.change((current) => deleteEntry(current, entryId))) onClose(null);
  }

  /** Closes the question and goes back to the title. */
  function backToTitle() {
    setAsking(null);
    titleInput.current?.focus();
  }

  const edit = (change: Partial<EntryDraft>) => {
    setAsking((old) => (old === "discard" ? null : old));
    setDraft((old) => ({ ...old, ...change }));
  };
  const problems = tried && "problems" in result ? result.problems : [];

  return (
    <TreeDialog
      label={title}
      className="eh-timeline-entry-dialog"
      onCancel={cancel}
      onEscape={() => {
        if (asking) backToTitle();
        else cancel();
      }}
      onSubmit={save}
    >
      <h3>{title}</h3>
      <fieldset className="eh-group eh-timeline-entry-fields" disabled={readOnly}>
        <label className="eh-timeline-field">
          {t("timeline.entry.title")}
          <input
            className="eh-field"
            ref={titleInput}
            value={draft.title}
            onChange={(event) => edit({ title: event.target.value })}
          />
        </label>
        <label className="eh-timeline-field">
          {t("timeline.entry.category")}
          <select
            className="eh-field"
            value={draft.categoryId}
            onChange={(event) => edit({ categoryId: event.target.value })}
          >
            {timeline.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <PointFields
          legend={t(draft.span ? "timeline.entry.from" : "timeline.entry.at")}
          value={draft.start}
          timeline={timeline}
          words={words}
          onChange={(start) => edit({ start })}
        />
        <label className="eh-timeline-span">
          <input
            type="checkbox"
            className="eh-checkbox"
            checked={draft.span}
            onChange={(event) =>
              edit({ span: event.target.checked, end: event.target.checked ? draft.end : draft.start })
            }
          />
          {t("timeline.entry.span")}
        </label>
        {draft.span && (
          <PointFields
            legend={t("timeline.entry.to")}
            value={draft.end}
            timeline={timeline}
            words={words}
            onChange={(end) => edit({ end })}
          />
        )}
        <label className="eh-timeline-field">
          {t("timeline.entry.summary")}
          <input
            className="eh-field"
            value={draft.summary}
            onChange={(event) => edit({ summary: event.target.value })}
          />
        </label>
      </fieldset>
      {problems.map((problem) => (
        <Notice tone="problem" key={problem}>
          {t(ENTRY_PROBLEM_LABELS[problem])}
        </Notice>
      ))}
      {view.problem && <Notice tone="problem">{t(PROBLEM_LABELS[view.problem])}</Notice>}
      {asking === "discard" && (
        <InlineQuestion
          label={t("timeline.entry.discardChanges")}
          question={t("timeline.entry.discardChanges")}
          actions={
            <>
              <Button autoFocus onClick={() => onClose(saved ? entryId : null)}>
                {t("timeline.entry.discard")}
              </Button>
              <Button onClick={backToTitle}>{t("timeline.entry.keepEditing")}</Button>
            </>
          }
        />
      )}
      {asking === "delete" && saved && (
        <InlineQuestion
          label={t("timeline.deleteEntry")}
          question={t("timeline.deleteEntryNamed", { name: saved.title })}
          actions={
            <>
              <Button autoFocus onClick={remove}>
                {t("timeline.confirmDeleteEntry")}
              </Button>
              <Button onClick={backToTitle}>{t("common.cancel")}</Button>
            </>
          }
        />
      )}
      <div className="eh-dialog-actions">
        {saved && !readOnly && (
          <Button variant="danger" className="eh-timeline-entry-delete" onClick={() => setAsking("delete")}>
            {t("timeline.deleteEntry")}
          </Button>
        )}
        {readOnly ? (
          <Button type="submit" variant="primary">
            {t("timeline.entry.close")}
          </Button>
        ) : (
          <>
            <Button type="submit" variant="primary">
              {t("common.save")}
            </Button>
            <Button onClick={cancel}>{t("common.cancel")}</Button>
          </>
        )}
      </div>
    </TreeDialog>
  );
}
