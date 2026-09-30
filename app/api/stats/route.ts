import { NextResponse } from "next/server";
import { after } from "next/server";
import {
  CHUNK_DELAY_MS,
  CHUNK_SIZE,
  acquireLock,
  getCurrentBlock,
  getTransferLogs,
  hydrateTimestamps,
  loadState,
  mergeLogs,
  releaseLock,
  saveState,
  toPublicPayload,
  type ScanState,
} from "@/lib/statsScan";

// Blocks a single request may scan synchronously before it must respond —
// keeps the fast path fast even if the catch-up gap is briefly large.
const SYNC_CATCHUP_BUDGET_MS = 3500;

async function scanRange(state: ScanState, fromBlock: number, toBlock: number, deadline: number) {
  let cursor = fromBlock;
  let first = true;
  while (cursor <= toBlock) {
    if (Date.now() > deadline) break;
    if (!first) await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
    first = false;
    const chunkTo = Math.min(cursor + CHUNK_SIZE - 1, toBlock);
    const logs = await getTransferLogs(cursor, chunkTo);
    mergeLogs(state, logs);
    state.lastScannedBlock = chunkTo;
    cursor = chunkTo + 1;
  }
}

// Continues a large catch-up in the background after the response has
// already been sent (used only for the rare case of a big gap after
// extended downtime). Re-acquires the lock itself so it never overlaps a
// concurrent request's own catch-up.
async function backgroundCatchUp(fromBlock: number, toBlock: number) {
  if (!(await acquireLock())) return;
  try {
    const state = await loadState();
    if (state.lastScannedBlock >= toBlock) return; // already caught up
    await scanRange(state, Math.max(fromBlock, state.lastScannedBlock + 1), toBlock, Date.now() + 60_000);
    await hydrateTimestamps(state);
    state.updatedAt = Date.now();
    await saveState(state);
  } finally {
    await releaseLock();
  }
}

export async function GET() {
  try {
    const [state, currentBlock] = await Promise.all([loadState(), getCurrentBlock()]);
    const gap = currentBlock - state.lastScannedBlock;

    if (gap <= 0) {
      // Already fully caught up — instant Redis-only response.
      return NextResponse.json({ ...toPublicPayload(state), stale: false, cachedAt: null, unavailable: false, catchingUp: false });
    }

    const lockAcquired = await acquireLock();
    if (!lockAcquired) {
      // Another request is scanning right now — serve last known totals
      // instantly rather than waiting or double-scanning.
      return NextResponse.json({ ...toPublicPayload(state), stale: true, cachedAt: state.updatedAt || null, unavailable: false, catchingUp: true });
    }

    try {
      const deadline = Date.now() + SYNC_CATCHUP_BUDGET_MS;
      await scanRange(state, state.lastScannedBlock + 1, currentBlock, deadline);
      await hydrateTimestamps(state);
      state.updatedAt = Date.now();
      await saveState(state);

      const caughtUp = state.lastScannedBlock >= currentBlock;
      if (!caughtUp) {
        // Large gap (e.g. after downtime) — didn't fit the sync budget.
        // Respond now with the best totals scanned so far, finish the rest
        // in the background so the next request is instant again.
        const remainingFrom = state.lastScannedBlock + 1;
        after(() => backgroundCatchUp(remainingFrom, currentBlock));
      }

      return NextResponse.json({
        ...toPublicPayload(state),
        stale: false,
        cachedAt: null,
        unavailable: false,
        catchingUp: !caughtUp,
      });
    } finally {
      await releaseLock();
    }
  } catch {
    // RPC or Redis hiccup — fall back to whatever was last persisted rather
    // than blanking the page. If Redis itself is unreachable there's
    // nothing to fall back to.
    try {
      const state = await loadState();
      const hasData = state.updatedAt > 0 || state.totalTransactions > 0;
      return NextResponse.json({
        ...toPublicPayload(state),
        stale: hasData,
        cachedAt: hasData ? state.updatedAt : null,
        unavailable: !hasData,
        catchingUp: false,
      });
    } catch {
      return NextResponse.json({
        totalQuestions: 0,
        totalVolume: "0.0000",
        uniqueWallets: 0,
        totalTransactions: 0,
        recentTransactions: [],
        stale: false,
        cachedAt: null,
        unavailable: true,
        catchingUp: false,
      });
    }
  }
}
