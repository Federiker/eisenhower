import {
  addCategory,
  addStep,
  checkedTimeline,
  deleteCategory,
  deleteStep,
  type EditResult,
  entriesAtStep,
  entriesInCategory,
  isValidTimeline,
  MAX_TIMELINE_CATEGORIES,
  MAX_TIMELINE_STEPS,
  moveCategory,
  moveStep,
  nextLook,
  renameStep,
  type Timeline,
  updateCategory,
} from "../../../src";
import { acts, dated, entry, id, step } from "./fixtures";

/** The new timeline, which must still be valid. */
const ok = (result: EditResult<Timeline>): Timeline => {
  if (!result.ok) throw new Error(result.reason);
  expect(isValidTimeline(result.value)).toBe(true);
  return result.value;
};

// Copied from jerome's timeline-edit.test.ts, made generic.
describe("steps", () => {
  it("are added, renamed and reordered, with names that differ", () => {
    const added = ok(addStep(acts(), id(4), "  Epilogue "));
    expect(added.steps.at(-1)).toEqual({ id: id(4), name: "Epilogue" });
    expect(addStep(acts(), id(4), "act 1")).toEqual({ ok: false, reason: "duplicate" });
    expect(addStep(acts(), id(4), " ")).toEqual({ ok: false, reason: "blank" });
    expect(addStep(acts(), id(4), "a".repeat(121))).toEqual({ ok: false, reason: "tooLong" });
    expect(addStep(dated(), id(4), "Act 1")).toEqual({ ok: false, reason: "invalid" });
    const full = {
      ...acts(),
      steps: Array.from({ length: MAX_TIMELINE_STEPS }, (_, n) => ({ id: `s${n}`, name: `S${n}` })),
    };
    expect(addStep(full, id(4), "One more")).toEqual({ ok: false, reason: "limit" });
    expect(ok(renameStep(acts(), id(2), "Interval")).steps[1]!.name).toBe("Interval");
    expect(ok(renameStep(acts(), id(2), "act 2")).steps[1]!.name).toBe("act 2");
    expect(renameStep(acts(), id(2), "Act 1")).toEqual({ ok: false, reason: "duplicate" });
    expect(renameStep(acts(), id(9), "Act 9")).toEqual({ ok: false, reason: "missing" });
    expect(ok(moveStep(acts(), id(3), 0)).steps.map((each) => each.name)).toEqual(["Act 3", "Act 1", "Act 2"]);
    expect(ok(moveStep(acts(), id(1), 99)).steps.map((each) => each.name)).toEqual(["Act 2", "Act 3", "Act 1"]);
    expect(moveStep(acts(), id(9), 0)).toEqual({ ok: false, reason: "missing" });
  });

  it("are not moved so that a span would end before it starts", () => {
    const spanning = acts([entry(20, step(1), step(2))]);
    expect(moveStep(spanning, id(1), 2)).toEqual({ ok: false, reason: "order" });
    expect(moveStep(spanning, id(3), 0).ok).toBe(true);
  });

  it("take their entries to the step before or after, or with them, when deleted", () => {
    const timeline = acts([
      entry(20, step(2)),
      entry(21, step(1), step(2)),
      entry(22, step(2), step(3)),
      entry(23, step(3)),
    ]);
    expect(entriesAtStep(timeline, id(2))).toBe(3);
    const before = ok(deleteStep(timeline, id(2), "before"));
    expect(before.steps.map((each) => each.name)).toEqual(["Act 1", "Act 3"]);
    expect(before.entries.map((each) => [each.start, each.end])).toEqual([
      [step(1), null],
      [step(1), null],
      [step(1), step(3)],
      [step(3), null],
    ]);
    const after = ok(deleteStep(timeline, id(2), "after"));
    expect(after.entries.map((each) => [each.start, each.end])).toEqual([
      [step(3), null],
      [step(1), step(3)],
      [step(3), null],
      [step(3), null],
    ]);
    expect(ok(deleteStep(timeline, id(2), "delete")).entries.map((each) => each.id)).toEqual([id(23)]);
    expect(deleteStep(timeline, id(1), "before")).toEqual({ ok: false, reason: "missing" });
    expect(deleteStep(timeline, id(9), "delete")).toEqual({ ok: false, reason: "missing" });
  });
});

describe("categories", () => {
  it("take the next free colour, then dashed and dotted lines", () => {
    expect(nextLook(acts().categories)).toEqual({ colour: 2, line: "solid" });
    const eight = Array.from({ length: 8 }, (_, colour) => ({
      id: id(30 + colour),
      name: `C${colour}`,
      colour,
      line: "solid" as const,
    }));
    expect(nextLook(eight)).toEqual({ colour: 0, line: "dashed" });
    const all = (["solid", "dashed", "dotted"] as const).flatMap((line) =>
      eight.map((one) => ({ ...one, id: `${line}${one.id}`, line })),
    );
    expect(nextLook(all)).toEqual({ colour: 0, line: "solid" });
    expect(ok(addCategory(acts(), id(12), "Crew")).categories.at(-1)).toEqual({
      id: id(12),
      name: "Crew",
      colour: 2,
      line: "solid",
    });
    expect(addCategory(acts(), id(12), "harbour")).toEqual({ ok: false, reason: "duplicate" });
    const full = {
      ...acts(),
      categories: Array.from({ length: MAX_TIMELINE_CATEGORIES }, (_, n) => ({
        id: `c${n}`,
        name: `C${n}`,
        colour: 0,
        line: "solid" as const,
      })),
    };
    expect(addCategory(full, id(12), "One more")).toEqual({ ok: false, reason: "limit" });
  });

  it("are renamed, recoloured and reordered", () => {
    const recoloured = ok(updateCategory(acts(), { id: id(11), name: " Quay ", colour: 5, line: "dotted" }));
    expect(recoloured.categories[1]).toEqual({ id: id(11), name: "Quay", colour: 5, line: "dotted" });
    expect(updateCategory(acts(), { id: id(11), name: "Ships", colour: 5, line: "dotted" })).toEqual({
      ok: false,
      reason: "duplicate",
    });
    expect(updateCategory(acts(), { id: id(19), name: "Quay", colour: 5, line: "dotted" })).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(updateCategory(acts(), { id: id(11), name: "Quay", colour: 9, line: "dotted" })).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(ok(moveCategory(acts(), id(11), 0)).categories.map((each) => each.name)).toEqual(["Harbour", "Ships"]);
    expect(moveCategory(acts(), id(19), 0)).toEqual({ ok: false, reason: "missing" });
  });

  it("move their entries to another category, or take them along, when deleted", () => {
    const timeline = acts([entry(20, step(1)), entry(21, step(2), null, id(11))]);
    expect(entriesInCategory(timeline, id(10))).toBe(1);
    const moved = ok(deleteCategory(timeline, id(10), id(11)));
    expect(moved.categories.map((each) => each.name)).toEqual(["Harbour"]);
    expect(moved.entries.map((each) => each.categoryId)).toEqual([id(11), id(11)]);
    expect(ok(deleteCategory(timeline, id(10), null)).entries.map((each) => each.id)).toEqual([id(21)]);
    expect(deleteCategory(timeline, id(10), id(10))).toEqual({ ok: false, reason: "missing" });
    expect(deleteCategory(timeline, id(10), id(19))).toEqual({ ok: false, reason: "missing" });
    expect(deleteCategory(timeline, id(19), null)).toEqual({ ok: false, reason: "missing" });
  });
});

describe("a checked timeline", () => {
  it("is refused when it would not be valid", () => {
    expect(checkedTimeline(acts([entry(20, step(9))]))).toEqual({ ok: false, reason: "invalid" });
    expect(checkedTimeline(acts())).toEqual({ ok: true, value: acts() });
  });
});
