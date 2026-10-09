import { describe, it, expect } from "vitest";
import { makeFakeRedis } from "./helpers/fakeRedis";

// MOCK-based: exercises the in-memory Redis fake used by the other suites.
describe("fake redis helper (mock)", () => {
  it("honours nx, ttl and persist", async () => {
    const r = makeFakeRedis();
    expect(await r.set("a", 1, { nx: true, ex: 100 })).toBe("OK");
    expect(await r.set("a", 2, { nx: true })).toBeNull();
    expect(await r.ttl("a")).toBeGreaterThan(0);
    await r.persist("a");
    expect(await r.ttl("a")).toBe(-1);
    expect(await r.getdel("a")).toBe(1);
    expect(await r.get("a")).toBeNull();
  });
});
