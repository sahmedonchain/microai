import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { exportCreditBalances, toCsv, usdcFromCredits } from "@/lib/creditsExport";

const A = "0x" + "a".repeat(40);
const B = "0x" + "b".repeat(40);

function fakeRedis(data: Record<string, unknown>) {
  const calls: string[] = [];
  const keys = Object.keys(data);
  return {
    calls,
    scan: async (cursor: string | number) => {
      calls.push("scan");
      // two pages to exercise the cursor loop
      return String(cursor) === "0" ? ["1", keys.slice(0, 2)] : ["0", keys.slice(2)];
    },
    get: async (k: string) => {
      calls.push("get");
      return data[k] ?? null;
    },
  };
}

describe("usdcFromCredits", () => {
  it("is exact: 1 credit = 0.001 USDC", () => {
    expect(usdcFromCredits(1)).toBe("0.001000");
    expect(usdcFromCredits(1000)).toBe("1.000000");
    expect(usdcFromCredits(12345)).toBe("12.345000");
    expect(usdcFromCredits(0)).toBe("0.000000");
  });
});

describe("exportCreditBalances", () => {
  const data = {
    [`microai:credit:${A}`]: 250,
    [`microai:credit:${B.toUpperCase().replace("0X", "0x")}`]: 40,
    "microai:credit:not-an-address": 99,
    [`microai:credit:0x${"c".repeat(40)}`]: 0,
    [`microai:credit:0x${"d".repeat(40)}`]: "12",
    [`microai:credit:0x${"e".repeat(40)}`]: -5,
  };

  it("lists positive balances largest first, skips everything else, and totals exactly", async () => {
    const r = await exportCreditBalances(fakeRedis(data) as never);
    expect(r.rows).toEqual([
      { address: A, credits: 250, usdc: "0.250000" },
      { address: B, credits: 40, usdc: "0.040000" },
    ]);
    expect(r.scanned).toBe(6);
    expect(r.skipped).toBe(4);
    expect(r.totalCredits).toBe(290);
    expect(r.totalUsdc).toBe("0.290000");
  });

  it("only scans and gets: it never writes", async () => {
    const redis = fakeRedis(data);
    await exportCreditBalances(redis as never);
    expect(new Set(redis.calls)).toEqual(new Set(["scan", "get"]));
  });

  it("writes plain CSV with a totals row", async () => {
    const csv = toCsv(await exportCreditBalances(fakeRedis(data) as never));
    expect(csv).toBe(`address,credits,usdc_to_refund\n${A},250,0.250000\n${B},40,0.040000\nTOTAL,290,0.290000\n`);
  });

  it("an empty store gives a header and a zero total", async () => {
    expect(toCsv(await exportCreditBalances(fakeRedis({}) as never))).toBe("address,credits,usdc_to_refund\nTOTAL,0,0.000000\n");
  });
});

describe("the script and library stay read-only", () => {
  it("use no write, delete, expire or payment calls", () => {
    const src = readFileSync("lib/creditsExport.ts", "utf8") + readFileSync("scripts/export-credit-balances.ts", "utf8");
    expect(src).not.toMatch(/\.(set|del|incr|decr|expire|persist|eval|hset|sadd|lpush|rpush)\(|sendTransaction|privateKey|Wallet\(/);
  });
  it("refuses to overwrite an existing output file", () => {
    expect(readFileSync("scripts/export-credit-balances.ts", "utf8")).toMatch(/flag: "wx"/);
  });
});
