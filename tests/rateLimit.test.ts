import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeFakeRedis } from "./helpers/fakeRedis";

// MOCK: Redis is replaced by an in-memory fake (see tests/helpers/fakeRedis.ts).
let redis = makeFakeRedis();
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));

import { consume, getClientIp, resetMemoryLimiter } from "@/lib/rateLimit";

beforeEach(() => {
  redis = makeFakeRedis();
  resetMemoryLimiter();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-09T12:00:00Z"));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

describe("Redis sliding-window limiter (fake Redis)", () => {
  it("allows up to the limit and then blocks with a Retry-After", async () => {
    for (let i = 0; i < 3; i++) expect((await consume("k", 3, 60_000)).ok).toBe(true);
    const blocked = await consume("k", 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("slides: frees capacity as old requests leave the window", async () => {
    await consume("k", 2, 60_000);
    vi.advanceTimersByTime(30_000);
    await consume("k", 2, 60_000);
    expect((await consume("k", 2, 60_000)).ok).toBe(false);
    vi.advanceTimersByTime(31_000); // first request is now 61s old
    expect((await consume("k", 2, 60_000)).ok).toBe(true);
    expect((await consume("k", 2, 60_000)).ok).toBe(false);
  });

  it("reports the wait until the oldest request expires", async () => {
    await consume("k", 1, 60_000);
    vi.advanceTimersByTime(20_000);
    expect((await consume("k", 1, 60_000)).retryAfterSec).toBe(40);
  });

  it("does not let rejected requests extend the penalty", async () => {
    await consume("k", 1, 10_000);
    for (let i = 0; i < 5; i++) await consume("k", 1, 10_000);
    vi.advanceTimersByTime(10_001);
    expect((await consume("k", 1, 10_000)).ok).toBe(true);
  });

  it("keeps keys independent", async () => {
    await consume("a", 1, 60_000);
    expect((await consume("a", 1, 60_000)).ok).toBe(false);
    expect((await consume("b", 1, 60_000)).ok).toBe(true);
  });

  it("is shared state: a second 'instance' sees the same counts", async () => {
    await consume("k", 1, 60_000);
    vi.resetModules();
    const again = await import("@/lib/rateLimit");
    expect((await again.consume("k", 1, 60_000)).ok).toBe(false);
  });

  it("falls back to a per-instance window when Redis throws", async () => {
    redis.multi = () => { throw new Error("redis down"); };
    expect((await consume("k", 1, 60_000)).ok).toBe(true);
    const blocked = await consume("k", 1, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
  });
});

describe("getClientIp", () => {
  it("uses the first x-forwarded-for entry, then x-real-ip", () => {
    expect(getClientIp(new Request("http://x", { headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" } }))).toBe("1.1.1.1");
    expect(getClientIp(new Request("http://x", { headers: { "x-real-ip": "3.3.3.3" } }))).toBe("3.3.3.3");
    expect(getClientIp(new Request("http://x"))).toBe("unknown");
  });
});
