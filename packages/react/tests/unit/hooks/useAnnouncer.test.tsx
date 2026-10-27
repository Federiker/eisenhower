import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LiveRegion, useAnnouncer } from "../../../src";

let announce: (text: string) => void = () => {};

function View() {
  const announcer = useAnnouncer();
  announce = announcer.announce;
  return <LiveRegion message={announcer.message} />;
}

describe("useAnnouncer", () => {
  it("speaks politely in a hidden status region, empty at first", () => {
    render(<View />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveClass("eh-visually-hidden");
    expect(region).toBeEmptyDOMElement();
  });

  it("announces each move, the same text again too", () => {
    render(<View />);
    act(() => announce("Draft: moved to Doing, 2 of 3"));
    const first = screen.getByRole("status").textContent;
    expect(first?.trim()).toBe("Draft: moved to Doing, 2 of 3");
    act(() => announce("Draft: moved to Doing, 2 of 3"));
    const second = screen.getByRole("status").textContent;
    expect(second?.trim()).toBe("Draft: moved to Doing, 2 of 3");
    expect(second).not.toBe(first);
  });
});
