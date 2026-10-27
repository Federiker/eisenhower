import { describe, expect, it } from "vitest";
import { EisenhowerPluginError, pluginErrorCodes, toPluginError } from "../src/errors";

describe("toPluginError", () => {
  it("keeps the plugin's code and parameters", () => {
    const error = toPluginError({ code: "read_failed", params: { path: "plan.json", detail: "denied" } });
    expect(error).toBeInstanceOf(EisenhowerPluginError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("EisenhowerPluginError");
    expect(error.code).toBe("read_failed");
    expect(error.params).toEqual({ path: "plan.json", detail: "denied" });
    expect(error.message).toBe('read_failed {"path":"plan.json","detail":"denied"}');
  });

  it("gives a code without parameters empty ones", () => {
    const error = toPluginError({ code: "internal" });
    expect(error.params).toEqual({});
    expect(error.message).toBe("internal");
  });

  it("makes anything else an unknown error that keeps its text", () => {
    expect(toPluginError("eisenhower.read_document not allowed")).toMatchObject({
      code: "unknown",
      params: { detail: "eisenhower.read_document not allowed" },
    });
    expect(toPluginError(new Error("broken"))).toMatchObject({ code: "unknown", params: { detail: "broken" } });
    expect(toPluginError({ code: "something_new", params: {} })).toMatchObject({
      code: "unknown",
      params: { detail: '{"code":"something_new","params":{}}' },
    });
  });

  it("passes its own errors through", () => {
    const error = new EisenhowerPluginError("internal");
    expect(toPluginError(error)).toBe(error);
  });

  it("lists every code the plugin sends, once", () => {
    expect(pluginErrorCodes).toEqual([
      "read_failed",
      "not_text",
      "write_failed",
      "changed_on_disk",
      "invalid_request",
      "internal",
    ]);
  });
});
