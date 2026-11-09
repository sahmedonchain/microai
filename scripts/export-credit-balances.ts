// Read-only: lists every remaining credit balance and what it is worth in USDC.
//
//   pnpm tsx --env-file=.env.local scripts/export-credit-balances.ts                 # CSV to stdout
//   pnpm tsx --env-file=.env.local scripts/export-credit-balances.ts --out refunds.csv
//
// It only reads (SCAN and GET). It changes nothing and sends no payment. Keep the
// CSV private: it links wallet addresses to balances. 1 credit = 0.001 USDC.
import { writeFileSync } from "node:fs";
import { getRedis } from "../lib/redis";
import { exportCreditBalances, toCsv } from "../lib/creditsExport";

(async () => {
  const i = process.argv.indexOf("--out");
  const out = i >= 0 ? process.argv[i + 1] : undefined;
  if (i >= 0 && !out) throw new Error("--out needs a file name");
  const result = await exportCreditBalances(getRedis());
  const csv = toCsv(result);
  if (out) writeFileSync(out, csv, { flag: "wx", mode: 0o600 }); // never overwrites an existing file
  else process.stdout.write(csv);
  console.error(`scanned ${result.scanned}, with balance ${result.rows.length}, skipped ${result.skipped}, total ${result.totalCredits} credits = ${result.totalUsdc} USDC`);
})().catch((err) => {
  console.error("export-credit-balances failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
