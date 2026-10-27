import { useCallback, useMemo, useReducer } from "react";

/** How many steps `useHistory` keeps to undo, unless told otherwise. */
export const HISTORY_LIMIT = 100;

export type History<T> = {
  /** The value now. */
  value: T;
  /** Makes `next` the value, to be undone; the steps undone before are dropped. The same value is no step. */
  set: (next: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Makes `value` the value with nothing to undo or redo (such as a document just loaded). */
  reset: (value: T) => void;
};

type State<T> = { past: readonly T[]; present: T; future: readonly T[] };

type Action<T> =
  | { type: "set"; next: T; limit: number }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; value: T };

function reduce<T>(state: State<T>, action: Action<T>): State<T> {
  switch (action.type) {
    case "set":
      if (Object.is(action.next, state.present)) return state;
      return {
        past: action.limit > 0 ? [...state.past, state.present].slice(-action.limit) : [],
        present: action.next,
        future: [],
      };
    case "undo": {
      const previous = state.past.at(-1);
      if (state.past.length === 0) return state;
      return { past: state.past.slice(0, -1), present: previous as T, future: [state.present, ...state.future] };
    }
    case "redo": {
      const next = state.future[0];
      if (state.future.length === 0) return state;
      return { past: [...state.past, state.present], present: next as T, future: state.future.slice(1) };
    }
    case "reset":
      return { past: [], present: action.value, future: [] };
  }
}

/**
 * Undo and redo for a host that wants them (decision 7): the views are controlled, so a host keeps the
 * value here, gives `value` to the view and `set` as its `onChange`. Up to `limit` steps (100 by default)
 * are kept to undo; the oldest go first.
 */
export function useHistory<T>(initial: T, { limit = HISTORY_LIMIT }: { limit?: number } = {}): History<T> {
  const [state, dispatch] = useReducer(reduce<T>, { past: [], present: initial, future: [] });
  const set = useCallback((next: T) => dispatch({ type: "set", next, limit }), [limit]);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  const reset = useCallback((value: T) => dispatch({ type: "reset", value }), []);
  return useMemo(
    () => ({
      value: state.present,
      set,
      undo,
      redo,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      reset,
    }),
    [state, set, undo, redo, reset],
  );
}
