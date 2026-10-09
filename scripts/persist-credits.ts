// Removes the legacy 30-day expiry from every prepaid credit balance.
//
//   pnpm tsx --env-file=.env.local scripts/persist-credits.ts           # dry run, writes nothing
//   pnpm tsx --env-file=.env.local scripts/persist-credits.ts --apply   # PERSIST each key
//
// Balances are never changed. Safe to re-run.
import { getRedis } from "../lib/redis";
import { persistLegacyCredits } from "../lib/creditsMigration";

(async () => {
  const apply = process.argv.includes("--apply");
  const report = await persistLegacyCredits(getRedis(), { apply });
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...report }, null, 2));
})().catch((err) => {
  console.error("persist-credits failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
