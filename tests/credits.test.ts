import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeFakeRedis } from "./helpers/fakeRedis";

// MOCK: Redis is an in-memory fake (see tests/helpers/fakeRedis.ts).
let redis = makeFakeRedis();
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));

import { addCredit, getCredit, spendCredit, creditKey } from "@/lib/credits";
import { persistLegacyCredits } from "@/lib/creditsMigration";

const W = "0x4fD87e600D703c0c05C01096B8b3451192E54F29";
const THIRTY_DAYS = 30 * 24 * 3600;

beforeEach(() => {
  redis = makeFakeRedis();
});

describe("credits never expire", () => {
  it("a new purchase creates a balance with no TTL", async () => {
    expect(await addCredit(W, 10)).toBe(10);
    expect(await redis.ttl(creditKey(W))).toBe(-1);
  });

  it("a top-up removes a legacy 30-day TTL and keeps the balance", async () => {
    await redis.set(creditKey(W), 40, { ex: THIRTY_DAYS });
    expect(await addCredit(W, 10)).toBe(50);
    expect(await redis.ttl(creditKey(W))).toBe(-1);
  });

  it("reading a legacy balance makes it permanent without changing it", async () => {
    await redis.set(creditKey(W), 165, { ex: 1000 });
    expect(await getCredit(W)).toBe(165);
    expect(await redis.ttl(creditKey(W))).toBe(-1);
    expect(await redis.get(creditKey(W))).toBe(165);
  });

  it("spending a credit from a legacy balance makes it permanent", async () => {
    await redis.set(creditKey(W), 3, { ex: 1000 });
    expect(await spendCredit(W)).toBe(2);
    expect(await redis.ttl(creditKey(W))).toBe(-1);
  });

  it("an unknown wallet has 0 credits and nothing is written", async () => {
    expect(await getCredit(W)).toBe(0);
    expect(redis.keys()).toEqual([]);
  });
});

describe("spending", () => {
  it("returns the remaining balance, and null (without going negative) when empty", async () => {
    await redis.set(creditKey(W), 1);
    expect(await spendCredit(W)).toBe(0);
    expect(await spendCredit(W)).toBeNull();
    expect(await redis.get(creditKey(W))).toBe(0);
  });

  it("five concurrent spends against a balance of 3 succeed exactly 3 times", async () => {
    await redis.set(creditKey(W), 3);
    const results = await Promise.all(Array.from({ length: 5 }, () => spendCredit(W)));
    expect(results.filter((r) => r !== null)).toHaveLength(3);
    expect(await redis.get(creditKey(W))).toBe(0);
  });
});

describe("persistLegacyCredits migration", () => {
  async function seed() {
    await redis.set("microai:credit:0xaaa", 10, { ex: 500 }); // legacy, expiring
    await redis.set("microai:credit:0xbbb", 7, { ex: 100_000 }); // legacy, expiring
    await redis.set("microai:credit:0xccc", 99); // already permanent
    await redis.set("microai:usedtx:0xdef", "1", { ex: 3600 }); // unrelated key, must be untouched
  }

  it("dry run reports the risk and writes nothing", async () => {
    await seed();
    const report = await persistLegacyCredits(redis as never, { apply: false });
    expect(report).toMatchObject({ scanned: 3, withExpiry: 2, alreadyPermanent: 1, creditsAtRisk: 17, persisted: 0 });
    expect(report.soonestExpirySeconds).toBeLessThanOrEqual(500);
    expect(await redis.ttl("microai:credit:0xaaa")).toBeGreaterThan(0);
  });

  it("apply removes the expiry from credit keys only, keeps every balance, and is idempotent", async () => {
    await seed();
    const first = await persistLegacyCredits(redis as never, { apply: true });
    expect(first.persisted).toBe(2);
    for (const [k, v] of [["microai:credit:0xaaa", 10], ["microai:credit:0xbbb", 7], ["microai:credit:0xccc", 99]] as const) {
      expect(await redis.ttl(k)).toBe(-1);
      expect(await redis.get(k)).toBe(v);
    }
    expect(await redis.ttl("microai:usedtx:0xdef")).toBeGreaterThan(0);
    const second = await persistLegacyCredits(redis as never, { apply: true });
    expect(second).toMatchObject({ withExpiry: 0, persisted: 0, alreadyPermanent: 3 });
  });

  it("pages through more keys than one scan batch", async () => {
    for (let i = 0; i < 450; i++) await redis.set(`microai:credit:0x${i}`, 1, { ex: 100 });
    const report = await persistLegacyCredits(redis as never, { apply: true });
    expect(report).toMatchObject({ scanned: 450, persisted: 450 });
  });
});
