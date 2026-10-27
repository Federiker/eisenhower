import {
  deleteEntry,
  type EditResult,
  type EntryPreset,
  newId,
  type Problem,
  type Timeline as TimelineValue,
} from "@eisenhower/model";
import { useMemo, useRef, useState } from "react";

import { Button } from "../controls/Button";
import { ContextMenu, type MenuPlace } from "../controls/ContextMenu";
import { InlineQuestion } from "../controls/InlineQuestion";
import { Notice } from "../controls/Notice";
import { classNames } from "../controls/classNames";
import { LiveRegion, useAnnouncer } from "../hooks/useAnnouncer";
import { useLocale, useTranslate } from "../strings/translate";
import { type EisenhowerSettings, ViewRoot } from "../theme/EisenhowerProvider";
import { type TimelineView, TimelineViewProvider } from "./context";
import { hasBce } from "./format";
import { PROBLEM_LABELS } from "./labels";
import { TimelineCategoriesList } from "./TimelineCategoriesList";
import { TimelineDrawing } from "./TimelineDrawing";
import { TimelineEntriesList } from "./TimelineEntriesList";
import { TimelineEntryDialog } from "./TimelineEntryDialog";
import { TimelineStepsList } from "./TimelineStepsList";

/**
 * The props of `<Timeline>` and `<TimelineEditor>` (decisions 6 to 8 and 16): the timeline (`value`) and
 * every change to it as the whole new timeline (`onChange`), made by `@eisenhower/model`'s edit operations;
 * `readOnly` turns editing off. With `onOpenEntry`, opening an entry (or starting a new one) asks the host,
 * which edits it in its own way, instead of the built-in dialog. The zoom is the view's own unless the host
 * controls it (`zoom` with `onZoomChange`); nothing is kept anywhere else. The strings, translator, locale and
 * theme are the host's, as for every view.
 */
export type TimelineProps = EisenhowerSettings & {
  value: TimelineValue;
  onChange?: (next: TimelineValue) => void;
  readOnly?: boolean;
  /**
   * Opens an entry in the host's own editor instead of the built-in dialog: an entry of the timeline, or a
   * new one (an id from `newId()` not yet in it) with `preset`, where it was begun on the drawing, or null.
   */
  onOpenEntry?: (id: string, preset: EntryPreset | null) => void;
  /** The entry shown as chosen (the host's own editor's); by default the one in the dialog. */
  selectedId?: string | null;
  /** The drawing's zoom, 1 (fitted to its width) or more, when the host keeps it. */
  zoom?: number;
  /** The zoom to start at when the view keeps it (default 1). */
  defaultZoom?: number;
  /** Every change of zoom (the buttons, Ctrl+wheel, the keys), so the host may keep or remember it. */
  onZoomChange?: (zoom: number) => void;
  className?: string;
};

type BodyProps = Omit<TimelineProps, keyof EisenhowerSettings | "className"> & { editor: boolean };

/** Finds an entry's button, in an area first. */
function entryButton(root: HTMLElement | null, id: string, area: string | null): HTMLElement | null {
  const all = [...(root?.querySelectorAll<HTMLElement>("[data-entry]") ?? [])].filter(
    (button) => button.dataset.entry === id,
  );
  return all.find((button) => button.closest<HTMLElement>("[data-area]")?.dataset.area === area) ?? all[0] ?? null;
}

const areaOf = (element: HTMLElement | null) => element?.closest<HTMLElement>("[data-area]")?.dataset.area ?? null;

function TimelineBody({
  value,
  onChange,
  readOnly = false,
  onOpenEntry,
  selectedId,
  zoom: zoomProp,
  defaultZoom = 1,
  onZoomChange,
  editor,
}: BodyProps) {
  const t = useTranslate();
  const locale = useLocale();
  const { message, announce } = useAnnouncer();
  const root = useRef<HTMLDivElement>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [dialog, setDialog] = useState<{ id: string; preset: EntryPreset | null; area: string | null } | null>(null);
  const [menu, setMenu] = useState<{ id: string; place: MenuPlace; from: HTMLElement } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; from: HTMLElement | null } | null>(null);
  const [ownZoom, setOwnZoom] = useState(defaultZoom);
  const zoom = zoomProp ?? ownZoom;

  /** Gives the focus to an entry once the view has drawn the change (or to New entry when it is gone). */
  function focusLater(id: string | null, area: string | null, onlyIfLost = false) {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (onlyIfLost && active && active !== document.body) return;
      const target =
        (id && entryButton(root.current, id, area)) || root.current?.querySelector<HTMLElement>("[data-new-entry]");
      target?.focus();
    }, 0);
  }

  const words = useMemo(() => ({ t, locale }), [t, locale]);
  const view: TimelineView = {
    timeline: value,
    readOnly,
    words,
    showCe: hasBce(value),
    selectedId: selectedId !== undefined ? selectedId : (dialog?.id ?? null),
    problem,
    change(edit: (timeline: TimelineValue) => EditResult<TimelineValue>) {
      if (readOnly) return false;
      const result = edit(value);
      if (!result.ok) {
        setProblem(result.reason);
        return false;
      }
      setProblem(null);
      onChange?.(result.value);
      return true;
    },
    openEntry(id, from) {
      setMenu(null);
      setDeleting(null);
      if (onOpenEntry) onOpenEntry(id, null);
      else {
        setProblem(null);
        setDialog({ id, preset: null, area: areaOf(from) });
      }
    },
    newEntry(from, preset = null) {
      if (readOnly) return;
      setDeleting(null);
      const id = newId();
      if (onOpenEntry) onOpenEntry(id, preset);
      else {
        setProblem(null);
        setDialog({ id, preset, area: areaOf(from) });
      }
    },
    openMenu(id, place, from) {
      if (!readOnly) setMenu({ id, place, from });
    },
    askDelete(id, from) {
      if (!readOnly) setDeleting({ id, from });
    },
    announce,
    zoom,
    setZoom(next) {
      if (zoomProp === undefined) setOwnZoom(next);
      onZoomChange?.(next);
    },
  };

  const menuEntry = menu ? value.entries.find((entry) => entry.id === menu.id) : undefined;
  const deletingEntry = deleting ? value.entries.find((entry) => entry.id === deleting.id) : undefined;

  function cancelDelete() {
    const from = deleting?.from;
    setDeleting(null);
    from?.focus();
  }

  function confirmDelete(id: string) {
    const from = deleting?.from ?? null;
    const area = areaOf(from);
    // The entry next to it in the same part takes the focus: the one after, or else the one before.
    const around = [...(from?.closest("[data-area]")?.querySelectorAll<HTMLElement>("[data-entry]") ?? [])];
    const at = from ? around.indexOf(from) : -1;
    const next = (around[at + 1] ?? around[at - 1])?.dataset.entry ?? null;
    if (!view.change((current) => deleteEntry(current, id))) return;
    setDeleting(null);
    focusLater(at < 0 ? null : next, area);
  }

  function closeDialog(saved: string | null) {
    const area = dialog?.area ?? "drawing";
    setDialog(null);
    // A saved entry's title takes the focus (a new one's too); otherwise the opener, when it is still there.
    if (saved) focusLater(saved, area);
    else focusLater(null, area, true);
  }

  return (
    <TimelineViewProvider value={view}>
      <div ref={root} className="eh-timeline-body">
        <TimelineDrawing />
        {deletingEntry && (
          <InlineQuestion
            label={t("timeline.deleteEntry")}
            question={t("timeline.deleteEntryNamed", { name: deletingEntry.title })}
            onEscape={cancelDelete}
            actions={
              <>
                <Button autoFocus onClick={() => confirmDelete(deletingEntry.id)}>
                  {t("timeline.confirmDeleteEntry")}
                </Button>
                <Button onClick={cancelDelete}>{t("common.cancel")}</Button>
              </>
            }
          />
        )}
        {!dialog && problem && <Notice tone="problem">{t(PROBLEM_LABELS[problem])}</Notice>}
        {editor && (
          <>
            <TimelineEntriesList />
            {value.kind === "sequence" && <TimelineStepsList />}
            <TimelineCategoriesList />
          </>
        )}
        {dialog && (
          <TimelineEntryDialog key={dialog.id} entryId={dialog.id} preset={dialog.preset} onClose={closeDialog} />
        )}
        {menu && menuEntry && (
          <ContextMenu<"edit" | "delete">
            label={t("timeline.entryMenu", { name: menuEntry.title })}
            items={[
              { id: "edit", label: t("common.edit") },
              { id: "delete", label: t("common.delete"), separated: true },
            ]}
            place={menu.place}
            onClose={() => {
              setMenu(null);
              menu.from.focus();
            }}
            onChoose={(action) => {
              setMenu(null);
              menu.from.focus();
              if (action === "edit") view.openEntry(menuEntry.id, menu.from);
              else view.askDelete(menuEntry.id, menu.from);
            }}
          />
        )}
        <LiveRegion message={message} />
      </div>
    </TimelineViewProvider>
  );
}

/**
 * A timeline drawn (decision 16, jerome's drawing): its lanes, entries and axis, zoomed with its buttons, the
 * keys or Ctrl+wheel, a list in a narrow space; entries open in a dialog (or the host's editor), have a menu
 * (Edit, Delete), and move with Alt and an arrow or with the pointer (along the axis, between lanes, or a span's
 * ends). New entry, or a double-click on a lane, starts one. Steps
 * and categories are edited in `<TimelineEditor>`, or by the host.
 */
export function Timeline({ strings, t, locale, theme, className, ...props }: TimelineProps) {
  return (
    <ViewRoot strings={strings} t={t} locale={locale} theme={theme} className={classNames("eh-timeline", className)}>
      <TimelineBody {...props} editor={false} />
    </ViewRoot>
  );
}

/**
 * A timeline with everything to edit it (jerome's timeline page): the drawing of `<Timeline>`, then its
 * entries as a table in time order, its steps (a Sequence) and its categories, each list reordered by
 * dragging, Alt+↑ ↓ or its menu.
 */
export function TimelineEditor({ strings, t, locale, theme, className, ...props }: TimelineProps) {
  return (
    <ViewRoot
      strings={strings}
      t={t}
      locale={locale}
      theme={theme}
      className={classNames("eh-timeline eh-timeline-editor", className)}
    >
      <TimelineBody {...props} editor />
    </ViewRoot>
  );
}
