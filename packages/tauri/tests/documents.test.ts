import { describe, expect, it } from "vitest";
import { EisenhowerPluginError, readDocument, writeDocument } from "../src/index";
import { mockPlugin } from "./plugin";

const HASH = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("readDocument", () => {
  it("answers the text and its hash", async () => {
    const calls = mockPlugin(() => ({ text: "{}\n", hash: HASH }));
    expect(await readDocument("C:\\Plans\\plan.json")).toEqual({ text: "{}\n", hash: HASH });
    expect(calls).toEqual([{ command: "plugin:eisenhower|read_document", args: { path: "C:\\Plans\\plan.json" } }]);
  });

  it("answers null when there is no file", async () => {
    mockPlugin(() => null);
    expect(await readDocument("missing.json")).toBeNull();
  });

  it("refuses an answer that is not a text and a hash", async () => {
    for (const wrong of [undefined, "text", [], { text: "{}" }, { text: 1, hash: HASH }, { text: "", hash: "Z" }]) {
      mockPlugin(() => wrong);
      await expect(readDocument("plan.json")).rejects.toMatchObject({
        code: "invalid_response",
        params: { command: "read_document" },
      });
    }
  });

  it("passes the plugin's error on with its code and parameters", async () => {
    mockPlugin(() => {
      throw { code: "not_text", params: { path: "picture.json" } };
    });
    const error = await readDocument("picture.json").catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(EisenhowerPluginError);
    expect(error).toMatchObject({ code: "not_text", params: { path: "picture.json" } });
  });
});

describe("writeDocument", () => {
  it("sends the path, the text and the hash", async () => {
    const calls = mockPlugin(() => HASH);
    const hash = await writeDocument({ path: "C:\\Plans\\Größe.json", text: "{}\n", expectedHash: "a".repeat(64) });
    expect(hash).toBe(HASH);
    expect(calls).toEqual([
      {
        command: "plugin:eisenhower|write_document",
        args: { path: "C:\\Plans\\Größe.json", text: "{}\n", expectedHash: "a".repeat(64) },
      },
    ]);
  });

  it("leaves the hash out for a new file", async () => {
    const calls = mockPlugin(() => HASH);
    await writeDocument({ path: "new.json", text: "" });
    expect(calls[0]?.args).toEqual({ path: "new.json", text: "" });
  });

  it("reports a file changed on disk", async () => {
    mockPlugin(() =>
      Promise.reject({
        code: "changed_on_disk",
        params: { path: "plan.json", expectedHash: "a", actualHash: null },
      }),
    );
    await expect(writeDocument({ path: "plan.json", text: "{}", expectedHash: "a" })).rejects.toMatchObject({
      code: "changed_on_disk",
      params: { expectedHash: "a", actualHash: null },
    });
  });

  it("refuses an answer that is not a hash", async () => {
    mockPlugin(() => "done");
    await expect(writeDocument({ path: "plan.json", text: "{}" })).rejects.toMatchObject({
      code: "invalid_response",
      params: { command: "write_document" },
    });
  });
});
