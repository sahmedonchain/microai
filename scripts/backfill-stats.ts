// One-time full backfill: scans SCAN_FLOOR_BLOCK -> current chain head for
// USDC transfers to RECEIVER and writes the fully converged totals to
// Redis, so the very first visitor after deploy sees complete data.
//
// Run: npm run backfill-stats

import {
  CHUNK_DELAY_MS,
  CHUNK_SIZE,
  SCAN_FLOOR_BLOCK,
  acquireLock,
  emptyState,
  getCurrentBlock,
  getTransferLogs,
  hydrateTimestamps,
  mergeLogs,
  releaseLock,
  saveState,
} from "../lib/statsScan";

// Sustained runs of hundreds of chunks can hit Arc RPC's rate limit even
// with spacing between calls (a per-minute window, not just a burst cap).
// Retry with backoff instead of aborting the whole backfill on one 429.
async function getTransferLogsWithRetry(from: number, to: number, maxAttempts = 6) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await getTransferLogs(from, to);
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      const backoffMs = Math.min(2000 * attempt, 15000);
      console.log(`  chunk ${from}-${to} failed (attempt ${attempt}/${maxAttempts}: ${err instanceof Error ? err.message : err}) — retrying in ${backoffMs}ms`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw new Error("unreachable");
}

async function main() {
  const started = Date.now();

  if (!(await acquireLock())) {
    console.error("Could not acquire scan lock — another scan is in progress. Aborting.");
    process.exit(1);
  }

  try {
    const currentBlock = await getCurrentBlock();
    const totalBlocks = currentBlock - SCAN_FLOOR_BLOCK + 1;
    const totalChunks = Math.ceil(totalBlocks / CHUNK_SIZE);
    console.log(`Backfilling blocks ${SCAN_FLOOR_BLOCK} -> ${currentBlock} (${totalBlocks.toLocaleString()} blocks, ${totalChunks} chunks)`);

    const state = emptyState();
    let cursor = SCAN_FLOOR_BLOCK;
    let chunkIndex = 0;

    while (cursor <= currentBlock) {
      const chunkTo = Math.min(cursor + CHUNK_SIZE - 1, currentBlock);
      const logs = await getTransferLogsWithRetry(cursor, chunkTo);
      mergeLogs(state, logs);
      state.lastScannedBlock = chunkTo;
      cursor = chunkTo + 1;
      chunkIndex++;

      if (chunkIndex % 20 === 0 || cursor > currentBlock) {
        const pct = (((chunkIndex) / totalChunks) * 100).toFixed(1);
        console.log(`  chunk ${chunkIndex}/${totalChunks} (${pct}%) — block ${chunkTo} — ${state.totalTransactions} transfers so far`);
      }

      if (cursor <= currentBlock) await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
    }

    console.log("Hydrating timestamps for the 10 most recent transfers...");
    await hydrateTimestamps(state);
    state.updatedAt = Date.now();

    await saveState(state);

    const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);
    console.log("");
    console.log("Backfill complete.");
    console.log(`  Blocks scanned:      ${totalBlocks.toLocaleString()} (${SCAN_FLOOR_BLOCK} -> ${currentBlock})`);
    console.log(`  Total transfers:     ${state.totalTransactions}`);
    console.log(`  Total USDC received: ${(Number(BigInt(state.totalVolumeRaw)) / 1e6).toFixed(4)}`);
    console.log(`  Unique wallets:      ${state.wallets.length}`);
    console.log(`  Time taken:          ${elapsedSec}s`);
  } finally {
    await releaseLock();
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
