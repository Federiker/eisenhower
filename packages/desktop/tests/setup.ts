import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// The test DOM has no top layer: a modal <dialog> is shown by its open attribute, its focus and inertness
// left to the end-to-end tests.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
  this.querySelector<HTMLElement>("[autofocus], input, button")?.focus();
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
