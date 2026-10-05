import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

// AchSwap's GitHub org is private (no public repo for the core app), so
// Build Status tracks it via on-chain proof instead: real contract code on
// Arc Mainnet plus recent log activity, split into "swap" and "liquidity"
// per AchSwap's own description of which contracts take direct user txs.
// Addresses are hardcoded from AchSwap's own docs
// (https://docs.achswap.app/technical/contract-addresses/, re-verified
// Oct 5 2026) -- never user-supplied, never guessed.
const ARC_RPC = "https://rpc.mainnet.arc.io";
const ARC_CHAIN_ID_HEX = "0x13b2"; // 5042
const FETCH_TIMEOUT_MS = 5000;

type ContractRole = "swap" | "liquidity" | "infra";

interface TrackedContract {
  name: string;
  address: string;
  role: ContractRole;
}

// Swap: AchRouteExecutor (the entry point users actually call) plus its two
// "native" execution adapters, per AchSwap's docs.
// Liquidity: V3 NonfungiblePositionManager + V2 Router.
// Everything else is factory/router/helper infra -- code presence only,
// never reported as "no activity" since they aren't meant to see direct
// user traffic.
const CONTRACTS: TrackedContract[] = [
  { name: "V2 Factory", address: "0xb0C2B0acb9c13079dDd871eDaF43Aabf6e88C530", role: "infra" },
  { name: "V2 Router", address: "0x52FE40c00530db2e43d01652f903870571A14AFD", role: "liquidity" },
  { name: "V3 Factory", address: "0xaE54BF4C8078BaAAf7e17f8e01659Ea470a989FC", role: "infra" },
  { name: "V3 SwapRouter", address: "0xEA0129203FBB99ebEea3f78B2d05b924f17FB556", role: "infra" },
  { name: "V3 NonfungiblePositionManager", address: "0x96366824D9240209cD236F5396054255ad1f5AA2", role: "liquidity" },
  { name: "AchRouteExecutor", address: "0x1B844738455b8060D12839331b35893526E9d314", role: "swap" },
  { name: "AchSponsoredExecutorV3", address: "0x5D5B486D032Da0B9d02651375CEe1107D40bef0b", role: "infra" },
  { name: "AchNativeAliasAdapter", address: "0x42fc88372cf10aec294Cc5B18B4E8dfE992E9621", role: "swap" },
  { name: "AchArcNativeUsdcAdapter", address: "0x097d6546db9fba2F908A88eE30FC870eb55fde90", role: "swap" },
];

const SWAP_ADDRESSES = CONTRACTS.filter((c) => c.role === "swap").map((c) => c.address);
const LIQUIDITY_ADDRESSES = CONTRACTS.filter((c) => c.role === "liquidity").map((c) => c.address);

// Bounded backward scan for "latest activity": up to 8 chunks of 9000
// blocks (Arc's eth_getLogs range cap, same constant lib/statsScan.ts
// uses) = roughly 72,000 blocks, ~10 hours at Arc's ~0.5s block time.
// Empirically both swap and liquidity activity were found inside this
// window. If nothing turns up, we report null rather than keep scanning
// indefinitely or estimating a number.
const CHUNK_SIZE = 9000;
const MAX_CHUNKS = 8;
const CHUNK_DELAY_MS = 250;

// Human-readable version of MAX_CHUNKS * CHUNK_SIZE at Arc's ~0.5s block
// time, for the UI to state the scan window honestly instead of implying
// "no activity ever" when nothing turns up.
export const SCAN_WINDOW_LABEL = "~10h";

const CACHE_KEY = "microai:achswap:onchain";
const CACHE_TTL_SECONDS = 12 * 60; // 12 min, within the requested 10-15 min window

interface ContractStatus {
  name: string;
  address: string;
  role: ContractRole;
  hasCode: boolean;
}

interface ActivityResult {
  lastActivityAt: string | null;
  lastActivityTxHash: string | null;
  lastActivityAddress: string | null;
}

export interface AchSwapOnchainPayload {
  chainIdOk: boolean;
  contracts: ContractStatus[];
  verifiedCount: number;
  totalCount: number;
  swap: ActivityResult;
  liquidity: ActivityResult;
  unavailable: boolean;
}

let redisClient: Redis | null = null;
function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redisClient;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetchWithTimeout(ARC_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.result;
}

interface RawLog {
  blockNumber: string;
  transactionHash: string;
  address: string;
}

async function scanForActivity(currentBlock: number, addresses: string[]): Promise<ActivityResult> {
  for (let i = 0; i < MAX_CHUNKS; i++) {
    const toBlock = currentBlock - i * CHUNK_SIZE;
    const fromBlock = toBlock - CHUNK_SIZE;
    if (i > 0) await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));

    const logs = (await rpcCall("eth_getLogs", [
      { fromBlock: `0x${fromBlock.toString(16)}`, toBlock: `0x${toBlock.toString(16)}`, address: addresses },
    ])) as RawLog[];

    if (logs.length > 0) {
      const latest = logs.reduce((a, b) => (parseInt(b.blockNumber, 16) > parseInt(a.blockNumber, 16) ? b : a));
      const block = (await rpcCall("eth_getBlockByNumber", [latest.blockNumber, false])) as { timestamp: string };
      return {
        lastActivityAt: new Date(parseInt(block.timestamp, 16) * 1000).toISOString(),
        lastActivityTxHash: latest.transactionHash,
        lastActivityAddress: latest.address,
      };
    }
  }
  return { lastActivityAt: null, lastActivityTxHash: null, lastActivityAddress: null };
}

async function fetchOnchainData(): Promise<AchSwapOnchainPayload> {
  const chainId = (await rpcCall("eth_chainId", [])) as string;
  const chainIdOk = chainId?.toLowerCase() === ARC_CHAIN_ID_HEX;

  const codeResults = await Promise.all(
    CONTRACTS.map(async (c) => {
      try {
        const code = (await rpcCall("eth_getCode", [c.address, "latest"])) as string;
        return { name: c.name, address: c.address, role: c.role, hasCode: !!code && code !== "0x" };
      } catch {
        return { name: c.name, address: c.address, role: c.role, hasCode: false };
      }
    })
  );
  const verifiedCount = codeResults.filter((c) => c.hasCode).length;

  let swap: ActivityResult = { lastActivityAt: null, lastActivityTxHash: null, lastActivityAddress: null };
  let liquidity: ActivityResult = { lastActivityAt: null, lastActivityTxHash: null, lastActivityAddress: null };
  try {
    const currentBlock = parseInt((await rpcCall("eth_blockNumber", [])) as string, 16);
    swap = await scanForActivity(currentBlock, SWAP_ADDRESSES);
    await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
    liquidity = await scanForActivity(currentBlock, LIQUIDITY_ADDRESSES);
  } catch {
    // Scan failed partway through -- leave results null rather than report
    // a partial/unreliable value.
  }

  return {
    chainIdOk,
    contracts: codeResults,
    verifiedCount,
    totalCount: CONTRACTS.length,
    swap,
    liquidity,
    unavailable: false,
  };
}

export async function GET() {
  try {
    const cached = await getRedis().get<AchSwapOnchainPayload>(CACHE_KEY);
    if (cached) return NextResponse.json(cached);
  } catch {
    /* Redis unreachable -- fall through to a live fetch */
  }

  try {
    const payload = await fetchOnchainData();
    try {
      await getRedis().set(CACHE_KEY, payload, { ex: CACHE_TTL_SECONDS });
    } catch {
      /* cache write failure shouldn't block returning the value to this request */
    }
    return NextResponse.json(payload);
  } catch (err) {
    console.error("AchSwap on-chain fetch error:", err);
    return NextResponse.json({
      chainIdOk: false,
      contracts: [],
      verifiedCount: 0,
      totalCount: CONTRACTS.length,
      swap: { lastActivityAt: null, lastActivityTxHash: null, lastActivityAddress: null },
      liquidity: { lastActivityAt: null, lastActivityTxHash: null, lastActivityAddress: null },
      unavailable: true,
    } satisfies AchSwapOnchainPayload);
  }
}
