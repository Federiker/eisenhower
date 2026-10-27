import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createTranslate, enGB, type Strings, useLocale, useTranslate } from "../../../src";

describe("createTranslate", () => {
  it("gives the UK English message, with its placeholders filled", () => {
    const t = createTranslate();
    expect(t("common.cancel")).toBe("Cancel");
    expect(t("common.moveTitleNamed", { name: "Draft" })).toBe("Move to: Draft");
    // A placeholder without a value stays as it is written.
    expect(t("common.moveTitleNamed")).toBe("Move to: {name}");
  });

  it("formats numbers in the locale and picks a plural form", () => {
    const plural = { one: "{count} card", other: "{count} cards" };
    const strings = { "common.moveTitleNamed": plural } as Partial<Strings>;
    expect(createTranslate({ strings })("common.moveTitleNamed", { count: 1 })).toBe("1 card");
    expect(createTranslate({ strings })("common.moveTitleNamed", { count: 1200 })).toBe("1,200 cards");
    expect(createTranslate({ strings, locale: "de-DE" })("common.moveTitleNamed", { count: 1200 })).toBe("1.200 cards");
    // Without `count`, the first number picks the form; without any number, "other".
    const many = { "common.cancel": { one: "One {n}", other: "{n} of them" } } as Partial<Strings>;
    expect(createTranslate({ strings: many })("common.cancel", { n: 1 })).toBe("One 1");
    expect(createTranslate({ strings: many })("common.cancel")).toBe("{n} of them");
    // A category the message does not have falls back to "other".
    const few = { "common.cancel": { other: "{count} left" } } as Partial<Strings>;
    expect(createTranslate({ strings: few })("common.cancel", { count: 1 })).toBe("1 left");
  });

  it("takes the host's strings over its own, and the host's translator over both", () => {
    const strings = { "common.cancel": "Never mind" };
    expect(createTranslate({ strings })("common.cancel")).toBe("Never mind");
    const t = createTranslate({
      strings,
      t: (key, values) => (key === "common.delete" ? `Supprimer ${values?.name ?? ""}`.trim() : key),
    });
    expect(t("common.delete", { name: "x" })).toBe("Supprimer x");
    // The key itself, or nothing, falls back to the messages.
    expect(t("common.cancel")).toBe("Never mind");
    expect(createTranslate({ t: () => "" })("common.save")).toBe("Save");
  });

  it("has a message for every key, each one non-empty", () => {
    for (const message of Object.values(enGB)) expect(message).not.toBe("");
  });
});

function Probe() {
  const t = useTranslate();
  return (
    <p>
      {t("common.save")} {useLocale()}
    </p>
  );
}

describe("useTranslate and useLocale", () => {
  it("give UK English outside any provider", () => {
    render(<Probe />);
    expect(screen.getByText("Save en-GB")).toBeInTheDocument();
  });
});
