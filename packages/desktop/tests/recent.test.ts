import { describe, expect, it } from "vitest";

import {
  addRecent,
  MAX_RECENT,
  pruneRecent,
  RECENT_KEY,
  type RecentDocument,
  readRecent,
  removeRecent,
  writeRecent,
} from "../src/recent";

const entry = (n: number): RecentDocument => ({
  path: `/plans/plan-${n}.json`,
  name: `plan-${n}.json`,
  kind: "board",
  opened: `2026-11-0${(n % 9) + 1}T10:00:00.000Z`,
});

/** A `localStorage` stand-in holding the list. */
function keeper(initial: string | null = null) {
  let value = initial;
  return {
    getItem: (key: string) => (key === RECENT_KEY ? value : null),
    setItem: (key: string, next: string) => {
      if (key === RECENT_KEY) value = next;
    },
  };
}

describe("the recent documents", () => {
  it("puts the latest first, once, and keeps twenty", () => {
    let list: RecentDocument[] = [];
    for (let n = 0; n < 25; n += 1) list = addRecent(list, entry(n));
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0]).toEqual(entry(24));
    list = addRecent(list, { ...entry(10), kind: "gantt" });
    expect(list[0]).toEqual({ ...entry(10), kind: "gantt" });
    expect(list.filter((one) => one.path === entry(10).path)).toHaveLength(1);
    expect(list).toHaveLength(MAX_RECENT);
  });

  it("takes one off the list", () => {
    expect(removeRecent([entry(1), entry(2)], entry(1).path)).toEqual([entry(2)]);
  });

  it("drops the files that are gone, and keeps one it cannot check", async () => {
    const list = [entry(1), entry(2), entry(3)];
    const kept = await pruneRecent(list, async (path) => {
      if (path === entry(3).path) throw new Error("no permission");
      return path !== entry(2).path;
    });
    expect(kept).toEqual([entry(1), entry(3)]);
    expect(await pruneRecent(list, async () => true)).toBe(list);
  });

  it("is kept as JSON and read back", () => {
    const storage = keeper();
    expect(readRecent(storage)).toEqual({ list: [], unreadable: false });
    expect(writeRecent(storage, [entry(1)])).toBe(true);
    expect(readRecent(storage)).toEqual({ list: [entry(1)], unreadable: false });
  });

  it("says when what is kept cannot be read", () => {
    expect(readRecent(keeper("{"))).toEqual({ list: [], unreadable: true });
    expect(readRecent(keeper(JSON.stringify([{ path: "" }])))).toEqual({ list: [], unreadable: true });
    const refusing = {
      getItem: () => {
        throw new Error("denied");
      },
    };
    expect(readRecent(refusing)).toEqual({ list: [], unreadable: true });
  });

  it("says when it cannot be kept", () => {
    const full = {
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(writeRecent(full, [entry(1)])).toBe(false);
  });
});
