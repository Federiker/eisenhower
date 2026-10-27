import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ContextMenu, EisenhowerProvider, useLocale, useTranslate, ViewRoot } from "../../../src";

function Probe() {
  const t = useTranslate();
  return (
    <p>
      {t("common.cancel")} · {t("common.save")} · {useLocale()}
    </p>
  );
}

const probe = () => screen.getByText(/·/);

describe("EisenhowerProvider", () => {
  it("draws its content in the themed root, following the system unless a theme is chosen", () => {
    const { rerender } = render(
      <EisenhowerProvider className="host" style={{ height: 10 }}>
        <Probe />
      </EisenhowerProvider>,
    );
    const root = probe().parentElement!;
    expect(root).toHaveClass("eh-root", "eh-provider", "host");
    expect(root).not.toHaveAttribute("data-theme");
    expect(root.style.height).toBe("10px");
    expect(probe()).toHaveTextContent("Cancel · Save · en-GB");
    rerender(
      <EisenhowerProvider theme="dark">
        <Probe />
      </EisenhowerProvider>,
    );
    expect(probe().parentElement).toHaveAttribute("data-theme", "dark");
  });

  it("gives its strings, translator and locale to the controls inside it", () => {
    render(
      <EisenhowerProvider strings={{ "common.menuNothing": "Rien à faire." }} locale="fr-FR">
        <ContextMenu label="Menu" items={[]} place={{ left: 0, top: 0 }} onChoose={() => {}} onClose={() => {}} />
        <Probe />
      </EisenhowerProvider>,
    );
    expect(screen.getByText("Rien à faire.")).toBeInTheDocument();
    expect(probe()).toHaveTextContent("fr-FR");
  });

  it("lets an inner provider's settings win, key by key", () => {
    render(
      <EisenhowerProvider strings={{ "common.cancel": "Outer cancel", "common.save": "Outer save" }} theme="dark">
        <EisenhowerProvider strings={{ "common.save": "Inner save" }} locale="en-US">
          <Probe />
        </EisenhowerProvider>
      </EisenhowerProvider>,
    );
    expect(probe()).toHaveTextContent("Outer cancel · Inner save · en-US");
    expect(probe().parentElement).toHaveAttribute("data-theme", "dark");
  });
});

describe("ViewRoot", () => {
  it("is a themed root of its own when used alone, with its own settings", () => {
    render(
      <ViewRoot className="eh-board" theme="light" strings={{ "common.cancel": "Stop" }} locale="en-AU">
        <Probe />
      </ViewRoot>,
    );
    const root = probe().parentElement!;
    expect(root).toHaveClass("eh-root", "eh-view", "eh-board");
    expect(root).toHaveAttribute("data-theme", "light");
    expect(probe()).toHaveTextContent("Stop · Save · en-AU");
  });

  it("takes the provider's theme inside one, and its own props win over the provider's", () => {
    const { rerender } = render(
      <EisenhowerProvider locale="fr-FR" theme="dark" strings={{ "common.save": "Enregistrer" }}>
        <ViewRoot strings={{ "common.cancel": "Annuler" }}>
          <Probe />
        </ViewRoot>
      </EisenhowerProvider>,
    );
    const view = probe().parentElement!;
    expect(view).toHaveClass("eh-view");
    expect(view).not.toHaveClass("eh-root");
    expect(view).not.toHaveAttribute("data-theme");
    expect(probe()).toHaveTextContent("Annuler · Enregistrer · fr-FR");
    rerender(
      <EisenhowerProvider theme="dark">
        <ViewRoot theme="system">
          <Probe />
        </ViewRoot>
      </EisenhowerProvider>,
    );
    // Its own theme makes it a root again; the system's theme needs no attribute.
    expect(probe().parentElement).toHaveClass("eh-root");
    expect(probe().parentElement).not.toHaveAttribute("data-theme");
  });

  it("asks the provider's translator only for the keys its own strings leave", () => {
    const shout = (key: string) => key.toUpperCase();
    render(
      <EisenhowerProvider t={shout}>
        <ViewRoot strings={{ "common.cancel": "Cancel this" }}>
          <Probe />
        </ViewRoot>
      </EisenhowerProvider>,
    );
    expect(probe()).toHaveTextContent("Cancel this · COMMON.SAVE · en-GB");
  });

  it("uses its own translator over the provider's", () => {
    render(
      <EisenhowerProvider t={() => "outer"}>
        <ViewRoot t={() => "inner"}>
          <Probe />
        </ViewRoot>
      </EisenhowerProvider>,
    );
    expect(probe()).toHaveTextContent("inner · inner · en-GB");
  });
});
