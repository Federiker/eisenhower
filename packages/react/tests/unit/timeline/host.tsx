import type { Timeline as TimelineValue } from "@eisenhower/model";
import { useState } from "react";

import { Timeline, TimelineEditor, type TimelineProps } from "../../../src";

/** The timeline the host holds now, after every change the view reported. */
export const held: { value: TimelineValue | null } = { value: null };

/** A host that keeps the timeline in its state, as an app would. */
export function Host({
  initial,
  editor = false,
  ...props
}: Omit<TimelineProps, "value"> & { initial: TimelineValue; editor?: boolean }) {
  const [value, setValue] = useState(initial);
  held.value = value;
  const View = editor ? TimelineEditor : Timeline;
  return (
    <View
      {...props}
      value={value}
      onChange={(next) => {
        props.onChange?.(next);
        setValue(next);
      }}
    />
  );
}

/** Lets the view's timers run (the focus after a dialog or a deletion is given in one). */
export const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));
