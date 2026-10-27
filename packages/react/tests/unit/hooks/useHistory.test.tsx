import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HISTORY_LIMIT, useHistory } from "../../../src";

describe("useHistory", () => {
  it("starts with the value and nothing to undo or redo", () => {
    const { result } = renderHook(() => useHistory({ cards: 0 }));
    expect(result.current.value).toEqual({ cards: 0 });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("undoes and redoes each change, and drops what was undone at the next change", () => {
    const { result } = renderHook(() => useHistory("a"));
    act(() => result.current.set("b"));
    act(() => result.current.set("c"));
    expect(result.current.value).toBe("c");
    act(() => result.current.undo());
    expect(result.current.value).toBe("b");
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.value).toBe("a");
    expect(result.current.canUndo).toBe(false);
    // Nothing more to undo: nothing changes.
    act(() => result.current.undo());
    expect(result.current.value).toBe("a");
    act(() => result.current.redo());
    expect(result.current.value).toBe("b");
    act(() => result.current.set("d"));
    expect(result.current.canRedo).toBe(false);
    act(() => result.current.redo());
    expect(result.current.value).toBe("d");
    act(() => result.current.undo());
    expect(result.current.value).toBe("b");
  });

  it("takes the same value as no step", () => {
    const value = { cards: 1 };
    const { result } = renderHook(() => useHistory(value));
    const before = result.current;
    act(() => result.current.set(value));
    expect(result.current).toBe(before);
    expect(result.current.canUndo).toBe(false);
  });

  it("keeps up to its limit of steps, dropping the oldest", () => {
    const { result } = renderHook(() => useHistory(0, { limit: 3 }));
    for (const value of [1, 2, 3, 4, 5]) act(() => result.current.set(value));
    for (let step = 0; step < 5; step++) act(() => result.current.undo());
    expect(result.current.value).toBe(2);
    expect(HISTORY_LIMIT).toBe(100);
    const none = renderHook(() => useHistory(0, { limit: 0 })).result;
    act(() => none.current.set(1));
    expect(none.current.value).toBe(1);
    expect(none.current.canUndo).toBe(false);
  });

  it("starts again from a value reset", () => {
    const { result } = renderHook(() => useHistory("a"));
    act(() => result.current.set("b"));
    act(() => result.current.undo());
    act(() => result.current.reset("loaded"));
    expect(result.current.value).toBe("loaded");
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
