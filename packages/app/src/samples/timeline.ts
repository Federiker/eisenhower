import type { Timeline, TimelineDate } from "@eisenhower/model";

/** A year (astronomical: 1 BCE is 0), optionally with a month and a day; `approximate` is drawn "c.". */
const date = (year: number, month: number | null = null, day: number | null = null, approximate = false) =>
  ({ year, month, day, approximate }) satisfies TimelineDate;
const about = (year: number) => date(year, null, null, true);

/**
 * An invented Dates timeline: a few landmarks of the history of science, in three lanes, from Hippocrates to
 * Dalton. BCE years are astronomical (`-239` is 240 BCE); the ancient ones are approximate.
 */
export function datesSample(): Timeline {
  return {
    kind: "dates",
    steps: [],
    categories: [
      { id: "cat-sky", name: "Astronomy", colour: 4, line: "solid" },
      { id: "cat-body", name: "Medicine", colour: 5, line: "dashed" },
      { id: "cat-matter", name: "Physics and chemistry", colour: 2, line: "dotted" },
    ],
    entries: [
      {
        id: "e-aristarchus",
        title: "Aristarchus puts the Sun at the centre",
        categoryId: "cat-sky",
        start: about(-269),
        end: null,
        summary: "A heliocentric model, set aside for eighteen centuries.",
      },
      {
        id: "e-eratosthenes",
        title: "Eratosthenes measures the Earth",
        categoryId: "cat-sky",
        start: about(-239),
        end: null,
        summary: "Shadows at Syene and Alexandria give the circumference.",
      },
      {
        id: "e-ptolemy",
        title: "Ptolemy's Almagest",
        categoryId: "cat-sky",
        start: about(150),
        end: null,
        summary: "The geocentric system that held until Copernicus.",
      },
      {
        id: "e-copernicus",
        title: "De revolutionibus",
        categoryId: "cat-sky",
        start: date(1543, 5),
        end: null,
        summary: "Copernicus's book, printed in the year he died.",
      },
      {
        id: "e-kepler",
        title: "Kepler's laws",
        categoryId: "cat-sky",
        start: date(1609),
        end: date(1619),
        summary: "From the New Astronomy to the Harmony of the World.",
      },
      {
        id: "e-galileo",
        title: "Galileo sees Jupiter's moons",
        categoryId: "cat-sky",
        start: date(1610, 1, 7),
        end: null,
        summary: "Four points of light that move with the planet.",
      },
      {
        id: "e-hippocrates",
        title: "The Hippocratic writings",
        categoryId: "cat-body",
        start: about(-429),
        end: about(-329),
        summary: "Illness explained without the gods.",
      },
      {
        id: "e-galen",
        title: "Galen in Rome",
        categoryId: "cat-body",
        start: about(162),
        end: null,
        summary: "Anatomy from apes and pigs, taught for a thousand years.",
      },
      {
        id: "e-vesalius",
        title: "Vesalius's Fabrica",
        categoryId: "cat-body",
        start: date(1543),
        end: null,
        summary: "Human anatomy drawn from dissection.",
      },
      {
        id: "e-harvey",
        title: "Harvey: the blood circulates",
        categoryId: "cat-body",
        start: date(1628),
        end: null,
        summary: "De motu cordis.",
      },
      {
        id: "e-jenner",
        title: "Jenner's first vaccination",
        categoryId: "cat-body",
        start: date(1796, 5, 14),
        end: null,
        summary: "Cowpox against smallpox.",
      },
      {
        id: "e-archimedes",
        title: "Archimedes on floating bodies",
        categoryId: "cat-matter",
        start: about(-249),
        end: null,
        summary: "Buoyancy, and a crown that was not all gold.",
      },
      {
        id: "e-newton",
        title: "Newton's Principia",
        categoryId: "cat-matter",
        start: date(1687, 7, 5),
        end: null,
        summary: "Motion and gravitation in one system.",
      },
      {
        id: "e-lavoisier",
        title: "Lavoisier's Traité",
        categoryId: "cat-matter",
        start: date(1789),
        end: null,
        summary: "Elements named, and mass conserved.",
      },
      {
        id: "e-dalton",
        title: "Dalton's atoms",
        categoryId: "cat-matter",
        start: date(1803),
        end: date(1808),
        summary: "Each element its own atom, with its own weight.",
      },
    ],
  };
}

/** An invented Sequence timeline: the chapters of a story about a lighthouse, with its people as lanes. */
export function sequenceSample(): Timeline {
  const step = (id: string) => ({ step: id });
  return {
    kind: "sequence",
    steps: [
      { id: "s-1", name: "Arrival" },
      { id: "s-2", name: "The first storm" },
      { id: "s-3", name: "The wreck" },
      { id: "s-4", name: "The inquiry" },
      { id: "s-5", name: "Spring" },
    ],
    categories: [
      { id: "c-keeper", name: "The keeper", colour: 0, line: "solid" },
      { id: "c-girl", name: "Wren", colour: 1, line: "dashed" },
      { id: "c-inspector", name: "The inspector", colour: 6, line: "dotted" },
    ],
    entries: [
      {
        id: "q-lamp",
        title: "Learns the lamp",
        categoryId: "c-keeper",
        start: step("s-1"),
        end: step("s-2"),
        summary: "Oil, wicks and the clockwork that turns the lens.",
      },
      {
        id: "q-log",
        title: "Hides a page of the log",
        categoryId: "c-keeper",
        start: step("s-3"),
        end: null,
        summary: "The night the light went out.",
      },
      {
        id: "q-boat",
        title: "Rows out alone",
        categoryId: "c-girl",
        start: step("s-2"),
        end: null,
        summary: "Against her father's word.",
      },
      {
        id: "q-survivor",
        title: "Finds the survivor",
        categoryId: "c-girl",
        start: step("s-3"),
        end: step("s-4"),
        summary: "A sailor who will not give his name.",
      },
      {
        id: "q-questions",
        title: "Asks about the missing page",
        categoryId: "c-inspector",
        start: step("s-4"),
        end: null,
        summary: "Every log has its pages numbered.",
      },
      {
        id: "q-leaves",
        title: "Leaves on the supply boat",
        categoryId: "c-inspector",
        start: step("s-5"),
        end: null,
        summary: "With a verdict nobody expected.",
      },
    ],
  };
}
