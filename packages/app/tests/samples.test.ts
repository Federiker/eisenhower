import {
  boardDocument,
  type DocumentKind,
  ganttDocument,
  isOverdue,
  lateTasks,
  parseDocument,
  QUADRANTS,
  quadrantOf,
  serialiseDocument,
  timelineDocument,
  todoDocument,
} from "@eisenhower/model";
import { describe, expect, it } from "vitest";

import { boardSample } from "../src/samples/board";
import { ganttSample } from "../src/samples/gantt";
import { datesSample, sequenceSample } from "../src/samples/timeline";
import { todoSample } from "../src/samples/todo";

const TODAY = "2026-10-27";

function roundTrips<T>(kind: DocumentKind<T>, data: T) {
  expect(parseDocument(kind, serialiseDocument(kind, data))).toEqual(data);
}

describe("the samples", () => {
  it("are valid documents of their views, and read back as they were written", () => {
    roundTrips(boardDocument, boardSample());
    roundTrips(timelineDocument, datesSample());
    roundTrips(timelineDocument, sequenceSample());
    roundTrips(ganttDocument, ganttSample(TODAY));
    roundTrips(todoDocument, todoSample(TODAY));
  });

  it("show what each view does: no loose card, BCE and approximate dates, one conflict, every quadrant", () => {
    expect(boardSample().cards.every((card) => card.columnId !== null)).toBe(true);
    const dates = datesSample().entries.flatMap((entry) => [entry.start, entry.end]);
    expect(dates.some((date) => date && "year" in date && date.year <= 0)).toBe(true);
    expect(dates.some((date) => date && "year" in date && date.approximate)).toBe(true);
    expect(lateTasks(ganttSample(TODAY))).toEqual(new Set(["t-press"]));
    const items = todoSample(TODAY).items;
    expect(new Set(items.map(quadrantOf))).toEqual(new Set(QUADRANTS));
    expect(items.filter((item) => isOverdue(item, TODAY)).map((item) => item.id)).toEqual(["i-tax", "i-parcel"]);
  });
});
