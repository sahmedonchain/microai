import { ARC_MAINNET, ERC20_TRANSFER_TOPIC, PAYMENT_RECEIVER, USDC_ADDRESS } from "./arcConfig";
import { rpcCall } from "./arcRpc";
import { getRedis } from "./redis";

export { getRedis };
export const RECEIVER = PAYMENT_RECEIVER;
export const USDC_CONTRACT = USDC_ADDRESS;
export const ARC_RPC = ARC_MAINNET.rpcUrl;

// Arc Mainnet launched 2026-09-16. Block 21239147 is the block at
// 2026-09-17T00:00:00Z (one day of margin), found via binary search over
// eth_getBlockByNumber timestamps. RECEIVER_ADDRESS cannot have received any
// USDC transfer before this block, so scanning starts here instead of at
// chain genesis (block 0) — cuts the range from 23M+ blocks to ~2.3M.
export const SCAN_FLOOR_BLOCK = 21239147;

export const CHUNK_SIZE = 9000; // eth_getLogs range cap on Arc RPC is ~10000 blocks
export const CHUNK_DELAY_MS = 250; // spacing between eth_getLogs calls to avoid 429
export const RPC_TIMEOUT_MS = 5000;

export const TRANSFER_TOPIC = ERC20_TRANSFER_TOPIC;
export const RECEIVER_TOPIC = "0x" + "0".repeat(24) + RECEIVER.slice(2).toLowerCase();

export const STATE_KEY = "microai:stats:scanstate";
export const LOCK_KEY = "microai:stats:scanlock";
export const LOCK_TTL_SECONDS = 5;

export interface RecentTransaction {
  hash: string;
  from: string;
  amount: string;
  timestamp: string | null;
  blockNumber: number;
}

// Everything persisted in Redis. totalVolumeRaw is a bigint serialized as a
// string (JSON has no bigint). wallets is deduped in-process before writes.
export interface ScanState {
  totalVolumeRaw: string;
  totalTransactions: number;
  wallets: string[];
  recentTransactions: RecentTransaction[];
  lastScannedBlock: number;
  updatedAt: number;
}

interface RawLog {
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
}

export function emptyState(): ScanState {
  return {
    totalVolumeRaw: "0",
    totalTransactions: 0,
    wallets: [],
    recentTransactions: [],
    lastScannedBlock: SCAN_FLOOR_BLOCK - 1,
    updatedAt: 0,
  };
}

export async function loadState(): Promise<ScanState> {
  const raw = await getRedis().get<ScanState>(STATE_KEY);
  return raw ?? emptyState();
}

export async function saveState(state: ScanState): Promise<void> {
  await getRedis().set(STATE_KEY, state);
}

// Non-blocking: returns true if this call acquired the lock.
export async function acquireLock(): Promise<boolean> {
  const result = await getRedis().set(LOCK_KEY, "1", { nx: true, ex: LOCK_TTL_SECONDS });
  return result === "OK";
}

export async function releaseLock(): Promise<void> {
  await getRedis().del(LOCK_KEY);
}

export async function rpc(method: string, params: unknown[]): Promise<unknown> {
  return rpcCall(method, params, { timeoutMs: RPC_TIMEOUT_MS });
}

export async function getCurrentBlock(): Promise<number> {
  const hex = (await rpc("eth_blockNumber", [])) as string;
  return parseInt(hex, 16);
}

export async function getTransferLogs(fromBlock: number, toBlock: number): Promise<RawLog[]> {
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

interface DecodedTransfer {
  from: string;
  value: bigint;
  blockNumber: number;
  hash: string;
}

function decodeLog(log: RawLog): DecodedTransfer {
  return {
    from: "0x" + log.topics[1].slice(-40),
    value: BigInt(log.data),
    blockNumber: parseInt(log.blockNumber, 16),
    hash: log.transactionHash,
  };
}

// Merges newly-fetched logs into a ScanState in place and returns it.
// recentTransactions is kept as the 10 highest-block-number transfers seen
// so far, newest first.
export function mergeLogs(state: ScanState, logs: RawLog[]): ScanState {
  const decoded = logs.map(decodeLog);
  if (decoded.length === 0) return state;

  const walletSet = new Set(state.wallets);
  let volumeRaw = BigInt(state.totalVolumeRaw);

  const candidates: RecentTransaction[] = [...state.recentTransactions];

  for (const tx of decoded) {
    volumeRaw += tx.value;
    state.totalTransactions++;
    walletSet.add(tx.from.toLowerCase());
    candidates.push({
      hash: tx.hash,
      from: tx.from,
      amount: (Number(tx.value) / 1e6).toFixed(4),
      timestamp: null,
      blockNumber: tx.blockNumber,
    });
  }

  candidates.sort((a, b) => b.blockNumber - a.blockNumber);
  state.recentTransactions = candidates.slice(0, 10);
  state.totalVolumeRaw = volumeRaw.toString();
  state.wallets = Array.from(walletSet);
  return state;
}

// Fills missing timestamps on recentTransactions via the tx receipt + block.
export async function hydrateTimestamps(state: ScanState): Promise<void> {
  const missing = state.recentTransactions.filter((tx) => tx.timestamp === null);
  if (missing.length === 0) return;

  await Promise.all(
    missing.map(async (tx) => {
      try {
        const receipt = (await rpc("eth_getTransactionReceipt", [tx.hash])) as { blockNumber?: string } | null;
        if (!receipt?.blockNumber) return;
        const block = (await rpc("eth_getBlockByNumber", [receipt.blockNumber, false])) as { timestamp?: string } | null;
        if (!block?.timestamp) return;
        tx.timestamp = new Date(parseInt(block.timestamp, 16) * 1000).toISOString();
      } catch {
        /* leave unresolved — next scan retries */
      }
    })
  );
}

export function toPublicPayload(state: ScanState) {
  return {
    totalQuestions: state.totalTransactions,
    totalVolume: (Number(BigInt(state.totalVolumeRaw)) / 1e6).toFixed(4),
    uniqueWallets: state.wallets.length,
    totalTransactions: state.totalTransactions,
    recentTransactions: state.recentTransactions.map(({ hash, from, amount, timestamp }) => ({ hash, from, amount, timestamp })),
  };
}
