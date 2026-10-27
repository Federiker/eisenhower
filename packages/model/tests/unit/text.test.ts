import { characterCount, freeName, MAX_NAME_LENGTH, nameFits, nameProblem, oneLineFits } from "../../src";

describe("names and one-line texts", () => {
  it("counts characters, not UTF-16 units", () => {
    expect(characterCount("😀a")).toBe(2);
    expect(nameFits("😀".repeat(MAX_NAME_LENGTH))).toBe(true);
    expect(nameFits("😀".repeat(MAX_NAME_LENGTH + 1))).toBe(false);
  });

  it("says why a name cannot be used", () => {
    expect(nameProblem("  ")).toBe("blank");
    expect(nameProblem("a".repeat(MAX_NAME_LENGTH + 1))).toBe("tooLong");
    expect(nameProblem(` ${"a".repeat(MAX_NAME_LENGTH)} `)).toBeNull();
    expect(nameProblem("abc", 2)).toBe("tooLong");
  });

  it("keeps a summary to one line", () => {
    expect(oneLineFits("")).toBe(true);
    expect(oneLineFits("one\ntwo")).toBe(false);
    expect(oneLineFits("one\rtwo")).toBe(false);
    expect(oneLineFits("abc", 2)).toBe(false);
  });

  it("finds a free name for a new item, ignoring case", () => {
    expect(freeName([], "New column")).toBe("New column");
    expect(freeName([{ name: "new column" }, { name: "New column 2" }], "New column")).toBe("New column 3");
  });
});
