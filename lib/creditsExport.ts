import type { Redis } from "@upstash/redis";

// Read-only export of the retired credit balances, to work out refunds.
//
// It only ever calls SCAN and GET. It never writes, deletes or changes a TTL, and
// it sends no payment: paying anyone back stays a manual decision by the owner.
// 1 credit = 0.001 USDC = 1,000 units of the 6-decimal USDC interface.

export const MICRO_USDC_PER_CREDIT = 1000;
const KEY_PREFIX = "microai:credit:";
const ADDRESS = /^0x[0-9a-f]{40}$/;

export interface CreditRow {
  address: string;
  credits: number;
  usdc: string; // exact decimal string, 6 places
}

export interface CreditExport {
  rows: CreditRow[];
  scanned: number;
  skipped: number; // keys that were not a valid address or did not hold a positive whole number
  totalCredits: number;
  totalUsdc: string;
}

type RedisLike = Pick<Redis, "scan" | "get">;

// Integer maths only (credits are whole numbers), so the decimal string is exact.
export function usdcFromCredits(credits: number): string {
  const units = credits * MICRO_USDC_PER_CREDIT;
  const whole = Math.floor(units / 1_000_000);
  const frac = String(units % 1_000_000).padStart(6, "0");
  return `${whole}.${frac}`;
}

export async function exportCreditBalances(redis: RedisLike): Promise<CreditExport> {
  const rows: CreditRow[] = [];
  let scanned = 0;
  let skipped = 0;
  let total = 0;
  let cursor = "0";
  do {
    const [next, keys] = (await redis.scan(cursor, { match: `${KEY_PREFIX}*`, count: 200 })) as [string, string[]];
    cursor = String(next);
    for (const key of keys) {
      scanned++;
      const address = key.slice(KEY_PREFIX.length).toLowerCase();
      const value = await redis.get<number>(key);
      if (!ADDRESS.test(address) || typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0 || !Number.isSafeInteger(total + value)) {
        skipped++;
        continue;
      }
      rows.push({ address, credits: value, usdc: usdcFromCredits(value) });
      total += value;
    }
  } while (cursor !== "0");
  rows.sort((a, b) => b.credits - a.credits || a.address.localeCompare(b.address));
  return { rows, scanned, skipped, totalCredits: total, totalUsdc: usdcFromCredits(total) };
}

// Every field is a validated address or a number, so nothing needs quoting; the
// header and rows are plain, with a final line of totals as a comment-free row.
export function toCsv(result: CreditExport): string {
  const lines = ["address,credits,usdc_to_refund", ...result.rows.map((r) => `${r.address},${r.credits},${r.usdc}`), `TOTAL,${result.totalCredits},${result.totalUsdc}`];
  return lines.join("\n") + "\n";
}
