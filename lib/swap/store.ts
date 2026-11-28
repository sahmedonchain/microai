import { randomBytes } from "node:crypto";
import { getRedis } from "@/lib/redis";
import { SWAP_DAILY_MAX_UNITS } from "./config";
import type { SwapToken } from "./config";

// Swap records in Redis. Only non-sensitive metadata: public wallet address,
// tokens, amounts, hashes, status. No keys, no raw service answers.

export type SwapStatus = "QUOTED" | "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "UNKNOWN";

export interface SwapRecord {
  v: 1;
  id: string;
  wallet: string;
  network: "mainnet";
  from: SwapToken;
  to: SwapToken;
  /** 6-decimal units, as decimal strings. */
  amountIn: string;
  expectedOut: string;
  minOut: string;
  feeUnits: string;
  feeToken: "input" | "output";
  feeMode: { percentageBps: number } | { amount: string }; // "amount" only in old records
  slippageBps: number;
  /** Fee recipient this quote is bound to (public address). */
  feeRecipient: string;
  providerFeeUnits: string;
  gasUsd: string | null;
  route: string;
  status: SwapStatus;
  createdAt: string;
  expiresAt: string;
  confirmedAt?: string;
  txHash?: string;
  actualOut?: string;
  error?: string;
}

const TTL = 90 * 86_400;
const rec = (id: string) => `microai:swap:q:${id}`;
const list = (w: string) => `microai:swaps:${w}`;
const txk = (h: string) => `microai:swap:tx:${h.toLowerCase()}`;
const day = (w: string) => `microai:swap:day:${w}:${new Date().toISOString().slice(0, 10)}`;

export const newSwapId = () => randomBytes(16).toString("base64url");
export const isSwapId = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9_-]{22}$/.test(s);

function parse(raw: unknown): SwapRecord | null {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v && typeof v === "object" && (v as { v?: unknown }).v === 1 ? (v as SwapRecord) : null;
}

export async function saveSwap(r: SwapRecord): Promise<void> {
  const redis = getRedis();
  await redis.set(rec(r.id), r, { ex: TTL });
  await redis.zadd(list(r.wallet), { score: Date.parse(r.createdAt), member: r.id });
}
export async function loadSwap(id: string): Promise<SwapRecord | null> {
  return isSwapId(id) ? parse(await getRedis().get(rec(id))) : null;
}
export async function listSwaps(wallet: string, max = 50): Promise<SwapRecord[]> {
  const ids = ((await getRedis().zrange(list(wallet), 0, -1)) as string[]).filter(isSwapId).reverse().slice(0, max);
  return (await Promise.all(ids.map(loadSwap))).filter((r): r is SwapRecord => r !== null);
}

/** One swap per transaction hash. False when the hash is already recorded. */
export async function claimTx(hash: string, id: string): Promise<boolean> {
  return Boolean(await getRedis().set(txk(hash), id, { nx: true, ex: TTL }));
}
export async function swapIdForTx(hash: string): Promise<string | null> {
  const v = await getRedis().get<string>(txk(hash));
  return typeof v === "string" ? v : null;
}

/** Adds to today's total for the wallet. Returns false (and adds nothing) when it would pass the daily cap. */
export async function reserveDaily(wallet: string, units: bigint): Promise<boolean> {
  const redis = getRedis();
  const key = day(wallet);
  const total = BigInt(await redis.incrby(key, Number(units)));
  if (total === units) await redis.expire(key, 2 * 86_400);
  if (total > SWAP_DAILY_MAX_UNITS) {
    await redis.incrby(key, -Number(units));
    return false;
  }
  return true;
}
export async function usedToday(wallet: string): Promise<bigint> {
  const v = await getRedis().get<number>(day(wallet));
  return BigInt(typeof v === "number" ? v : 0);
}
export async function releaseDaily(wallet: string, units: bigint): Promise<void> {
  await getRedis().incrby(day(wallet), -Number(units));
}

// Public activity feed: only completed swaps, newest first. Used by the stats page.
const FEED = "microai:swaps:feed";
const COUNT = "microai:swaps:count";
// Called once, when a swap moves from pending to success.
export async function recordCompleted(r: SwapRecord): Promise<void> {
  const redis = getRedis();
  await redis.zadd(FEED, { score: Date.parse(r.confirmedAt ?? r.createdAt), member: r.id });
  await redis.incr(COUNT);
}
export async function recentCompleted(max = 10): Promise<{ total: number; swaps: SwapRecord[] }> {
  const redis = getRedis();
  const [all, total] = await Promise.all([redis.zrange(FEED, 0, -1) as Promise<string[]>, redis.get<number>(COUNT)]);
  const ids = all.filter(isSwapId).reverse().slice(0, max);
  const swaps = (await Promise.all(ids.map(loadSwap))).filter((r): r is SwapRecord => r !== null && r.status === "SUCCESS");
  return { total: typeof total === "number" ? total : swaps.length, swaps };
}
