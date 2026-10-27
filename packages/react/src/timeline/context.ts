import type { EditResult, EntryPreset, Problem, Timeline } from "@eisenhower/model";
import { createContext, useContext } from "react";

import type { MenuPlace } from "../controls/ContextMenu";
import type { DateWords } from "./format";

/**
 * What the parts of a timeline view share: the timeline, how its dates are written, and the actions that
 * open, change and delete its entries, kept by `<Timeline>` and `<TimelineEditor>`.
 */
export type TimelineView = {
  timeline: Timeline;
  readOnly: boolean;
  words: DateWords;
  /** Whether CE is written beside dates, because some are BCE. */
  showCe: boolean;
  /** The entry shown as chosen: the host's `selectedId`, or the entry in the dialog. */
  selectedId: string | null;
  /** Applies one edit to the timeline and reports it (`onChange`); false, with the problem shown, when refused. */
  change: (edit: (timeline: Timeline) => EditResult<Timeline>) => boolean;
  /** Why the last change was refused. */
  problem: Problem | null;
  /** Opens an entry (the host's editor or the dialog); `from` gets the focus back. */
  openEntry: (id: string, from: HTMLElement | null) => void;
  /** Starts a new entry, where it was begun on the drawing when `preset` is given. */
  newEntry: (from: HTMLElement | null, preset?: EntryPreset | null) => void;
  /** Opens an entry's menu (Edit, Delete); the focus comes back to `from` when it closes. */
  openMenu: (id: string, place: MenuPlace, from: HTMLElement) => void;
  /** Asks whether to delete an entry; the focus comes back to `from` if it is kept. */
  askDelete: (id: string, from: HTMLElement | null) => void;
  /** Says something in the view's polite live region. */
  announce: (text: string) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
};

const TimelineContext = createContext<TimelineView | null>(null);

export const TimelineViewProvider = TimelineContext.Provider;

/** The view the part is drawn in. */
export function useTimelineView(): TimelineView {
  const view = useContext(TimelineContext);
  if (!view) throw new Error("A timeline's part is drawn inside <Timeline> or <TimelineEditor>.");
  return view;
}
