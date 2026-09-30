import { NextResponse } from "next/server";

const RECEIVER = "0x78C144A76614A8674285129810555C8bCa78f044";
const USDC_CONTRACT = "0x3600000000000000000000000000000000000000";
const ARC_RPC = "https://rpc.mainnet.arc.io";
const RECENT_LIMIT = 10;
const CHUNK_SIZE = 9000; // eth_getLogs range cap on Arc RPC is ~10000 blocks
const MAX_CHUNKS_PER_REQUEST = 2; // Arc RPC 429s on bursts — scan converges over repeated polls
const CHUNK_DELAY_MS = 250; // spacing between eth_getLogs calls to avoid 429
const FETCH_TIMEOUT_MS = 5000;
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const RECEIVER_TOPIC = "0x" + "0".repeat(24) + RECEIVER.slice(2).toLowerCase();

interface RawLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
}

interface RecentTransaction {
  hash: string;
  from: string;
  amount: string;
  timestamp: string | null;
}

interface StatsPayload {
  totalQuestions: number;
  totalVolume: string;
  uniqueWallets: number;
  totalTransactions: number;
  recentTransactions: RecentTransaction[];
}

// Cumulative index built by scanning the USDC Transfer event log backward
// from the chain tip, CHUNK_SIZE blocks at a time. Arc RPC caps eth_getLogs
// to a ~10k block range per call, and the chain has tens of millions of
// blocks, so a single request can't scan everything — this converges over
// repeated polls (the page already refreshes every 10-30s) while always
// serving the best totals known so far immediately.
interface ScanState {
  totalVolumeRaw: bigint;
  totalTransactions: number;
  wallets: Set<string>;
  recentTransactions: RecentTransaction[];
  blockTimestamps: Map<string, string>;
  newestScannedBlock: number | null; // top of the range already covered
  oldestScannedBlock: number | null; // bottom of the range already covered
  complete: boolean; // reached genesis
}

let scan: ScanState = {
  totalVolumeRaw: BigInt(0),
  totalTransactions: 0,
  wallets: new Set(),
  recentTransactions: [],
  blockTimestamps: new Map(),
  newestScannedBlock: null,
  oldestScannedBlock: null,
  complete: false,
};

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(ARC_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`RPC ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || "RPC error");
    return data.result;
  } finally {
    clearTimeout(timer);
  }
}

async function getTransferLogs(fromBlock: number, toBlock: number): Promise<RawLog[]> {
  const result = await rpc("eth_getLogs", [
    {
      address: USDC_CONTRACT,
      topics: [TRANSFER_TOPIC, null, RECEIVER_TOPIC],
      fromBlock: "0x" + fromBlock.toString(16),
      toBlock: "0x" + toBlock.toString(16),
    },
  ]);
  return (result as RawLog[]) || [];
}

function decodeLog(log: RawLog): { from: string; value: bigint; blockNumber: number } {
  const from = "0x" + log.topics[1].slice(-40);
  const value = BigInt(log.data);
  return { from, value, blockNumber: parseInt(log.blockNumber, 16) };
}

function mergeLogsIntoScan(logs: RawLog[], prepend: boolean) {
  const decoded = logs.map((l) => ({ ...decodeLog(l), hash: l.transactionHash }));
  for (const tx of decoded) {
    scan.totalVolumeRaw += tx.value;
    scan.totalTransactions++;
    scan.wallets.add(tx.from.toLowerCase());
  }

  const asRecent: RecentTransaction[] = decoded.map((tx) => ({
    hash: tx.hash,
    from: tx.from,
    amount: (Number(tx.value) / 1e6).toFixed(4),
    timestamp: scan.blockTimestamps.get(tx.blockNumber.toString()) || null,
  }));

  scan.recentTransactions = prepend
    ? [...asRecent.reverse(), ...scan.recentTransactions].slice(0, RECENT_LIMIT)
    : [...scan.recentTransactions, ...asRecent.reverse()].slice(0, RECENT_LIMIT);
}

// Fills in block timestamps for whatever is currently in recentTransactions
// and still missing one, so the feed shows real "time ago" values without
// fetching a block per historical transfer during bulk scanning.
async function hydrateTimestamps() {
  const missing = scan.recentTransactions.filter((tx) => tx.timestamp === null);
  if (missing.length === 0) return;

  await Promise.all(
    missing.slice(0, RECENT_LIMIT).map(async (tx) => {
      try {
        // find the block number back out of the hash isn't possible directly;
        // re-derive via the tx receipt instead.
        const receipt = (await rpc("eth_getTransactionReceipt", [tx.hash])) as { blockNumber?: string } | null;
        if (!receipt?.blockNumber) return;
        const block = (await rpc("eth_getBlockByNumber", [receipt.blockNumber, false])) as { timestamp?: string } | null;
        if (!block?.timestamp) return;
        const iso = new Date(parseInt(block.timestamp, 16) * 1000).toISOString();
        scan.blockTimestamps.set(parseInt(receipt.blockNumber, 16).toString(), iso);
        tx.timestamp = iso;
      } catch {
        /* leave unresolved — next poll retries */
      }
    })
  );
}

export async function GET() {
  try {
    const currentHex = (await rpc("eth_blockNumber", [])) as string;
    const currentBlock = parseInt(currentHex, 16);

    // First run: index the newest chunk immediately so the page has data.
    if (scan.newestScannedBlock === null) {
      const from = Math.max(0, currentBlock - CHUNK_SIZE + 1);
      const logs = await getTransferLogs(from, currentBlock);
      mergeLogsIntoScan(logs, false);
      scan.newestScannedBlock = currentBlock;
      scan.oldestScannedBlock = from;
      scan.complete = from === 0;
    } else {
      // Catch up any new blocks produced since the last poll.
      if (currentBlock > scan.newestScannedBlock) {
        const from = scan.newestScannedBlock + 1;
        const logs = await getTransferLogs(from, currentBlock);
        mergeLogsIntoScan(logs, true);
        scan.newestScannedBlock = currentBlock;
      }

      // Extend the historical index further back, a couple of chunks per
      // request, until genesis is reached. Isolated in its own try/catch:
      // a rate-limit here (deep-history backfill) must never blank out the
      // fresh totals/catch-up already computed above for this response.
      let chunksDone = 0;
      while (!scan.complete && chunksDone < MAX_CHUNKS_PER_REQUEST && scan.oldestScannedBlock !== null) {
        const to = scan.oldestScannedBlock - 1;
        if (to < 0) {
          scan.complete = true;
          break;
        }
        const from = Math.max(0, to - CHUNK_SIZE + 1);
        try {
          if (chunksDone > 0) await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
          const logs = await getTransferLogs(from, to);
          mergeLogsIntoScan(logs, false);
          scan.oldestScannedBlock = from;
          if (from === 0) scan.complete = true;
        } catch {
          break; // rate-limited or transient — resume from here next poll
        }
        chunksDone++;
      }
    }

    await hydrateTimestamps();

    const payload: StatsPayload = {
      totalQuestions: scan.totalTransactions,
      totalVolume: (Number(scan.totalVolumeRaw) / 1e6).toFixed(4),
      uniqueWallets: scan.wallets.size,
      totalTransactions: scan.totalTransactions,
      recentTransactions: scan.recentTransactions,
    };

    return NextResponse.json({
      ...payload,
      stale: false,
      cachedAt: null,
      unavailable: false,
      indexComplete: scan.complete,
    });
  } catch {
    // RPC hiccup — serve whatever has been indexed so far rather than
    // blanking the page; only report unavailable if nothing has ever loaded.
    if (scan.newestScannedBlock !== null) {
      return NextResponse.json({
        totalQuestions: scan.totalTransactions,
        totalVolume: (Number(scan.totalVolumeRaw) / 1e6).toFixed(4),
        uniqueWallets: scan.wallets.size,
        totalTransactions: scan.totalTransactions,
        recentTransactions: scan.recentTransactions,
        stale: true,
        cachedAt: Date.now(),
        unavailable: false,
        indexComplete: scan.complete,
      });
    }
    return NextResponse.json({
      totalQuestions: 0,
      totalVolume: "0.0000",
      uniqueWallets: 0,
      totalTransactions: 0,
      recentTransactions: [],
      stale: false,
      cachedAt: null,
      unavailable: true,
      indexComplete: false,
    });
  }
}
