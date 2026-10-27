import { done, idSchema, MAX_ID_LENGTH, newId, refused, uniqueIds } from "../../src";

describe("ids", () => {
  it("makes UUIDs that pass the schema", () => {
    const id = newId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(idSchema.safeParse(id).success).toBe(true);
    expect(newId()).not.toBe(id);
  });

  it("takes a host's own ids, never an empty or huge one", () => {
    expect(idSchema.safeParse("beat-1").success).toBe(true);
    expect(idSchema.safeParse("").success).toBe(false);
    expect(idSchema.safeParse("x".repeat(MAX_ID_LENGTH + 1)).success).toBe(false);
  });

  it("tells when ids repeat", () => {
    expect(uniqueIds([{ id: "a" }, { id: "b" }])).toBe(true);
    expect(uniqueIds([{ id: "a" }, { id: "a" }])).toBe(false);
  });
});

describe("results", () => {
  it("carries a value or a reason", () => {
    expect(done(3)).toEqual({ ok: true, value: 3 });
    expect(refused("blank")).toEqual({ ok: false, reason: "blank" });
  });
});
