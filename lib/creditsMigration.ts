import type { Redis } from "@upstash/redis";

// One-off, idempotent migration for the removal of the 30-day credit expiry:
// finds credit balances that still carry a TTL and removes it. Values are
// never read-modified or written; only PERSIST is issued, and only with apply.
export interface PersistReport {
  scanned: number;
  withExpiry: number;
  alreadyPermanent: number;
  creditsAtRisk: number; // sum of balances that still had an expiry
  soonestExpirySeconds: number | null;
  persisted: number;
}

type RedisLike = Pick<Redis, "scan" | "ttl" | "get" | "persist">;

export async function persistLegacyCredits(redis: RedisLike, opts: { apply: boolean }): Promise<PersistReport> {
  const report: PersistReport = { scanned: 0, withExpiry: 0, alreadyPermanent: 0, creditsAtRisk: 0, soonestExpirySeconds: null, persisted: 0 };
  let cursor = "0";
  do {
    const [next, keys] = (await redis.scan(cursor, { match: "microai:credit:*", count: 200 })) as [string, string[]];
    cursor = String(next);
    for (const key of keys) {
      report.scanned++;
      const ttl = await redis.ttl(key);
      if (ttl < 0) {
        report.alreadyPermanent++;
        continue;
      }
      report.withExpiry++;
      const value = await redis.get<number>(key);
      if (typeof value === "number" && value > 0) report.creditsAtRisk += value;
      report.soonestExpirySeconds = report.soonestExpirySeconds === null ? ttl : Math.min(report.soonestExpirySeconds, ttl);
      if (opts.apply) {
        await redis.persist(key);
        report.persisted++;
      }
    }
  } while (cursor !== "0");
  return report;
}
