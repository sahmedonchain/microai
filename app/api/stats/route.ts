import { NextResponse } from "next/server";

const RECEIVER = "0x78C144A76614A8674285129810555C8bCa78f044";
const USDC_CONTRACT = "0x3600000000000000000000000000000000000000";
const RECENT_LIMIT = 10;
const FETCH_TIMEOUT_MS = 5000;

interface RawTransfer {
  transaction_hash?: string;
  tx_hash?: string;
  hash?: string;
  timestamp?: string;
  from: { hash: string };
  to: { hash: string };
  total: { value: string; decimals: string };
  token: { address_hash: string };
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

// In-memory cache (per serverless instance). Explorer API is sometimes
// unreachable (bot-protection challenge) — when that happens we serve the
// last successful payload instead of zeroing the page out.
let cache: { data: StatsPayload; timestamp: number } | null = null;

async function fetchWithTimeout(url: string, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  try {
    const res = await fetchWithTimeout(
      `https://explorer.arc.io/api/v2/addresses/${RECEIVER}/token-transfers?token=${USDC_CONTRACT}`,
      FETCH_TIMEOUT_MS
    );

    if (!res.ok) throw new Error(`Explorer API returned ${res.status}`);

    const data = await res.json();
    const transfers: RawTransfer[] = data.items || [];

    const wallets = new Set<string>();
    let totalVolume = 0;
    let totalQuestions = 0;
    const recentTransactions: RecentTransaction[] = [];

    transfers.forEach((tx) => {
      // Only count incoming USDC payments.
      if (
        tx.to?.hash?.toLowerCase() === RECEIVER.toLowerCase() &&
        tx.from?.hash?.toLowerCase() !== RECEIVER.toLowerCase() &&
        tx.token?.address_hash?.toLowerCase() === USDC_CONTRACT.toLowerCase()
      ) {
        wallets.add(tx.from.hash.toLowerCase());
        const value = parseFloat(tx.total.value) / Math.pow(10, parseInt(tx.total.decimals));
        totalVolume += value;
        totalQuestions++;

        if (recentTransactions.length < RECENT_LIMIT) {
          recentTransactions.push({
            hash: tx.transaction_hash || tx.tx_hash || tx.hash || "",
            from: tx.from.hash,
            amount: value.toFixed(4),
            timestamp: tx.timestamp || null,
          });
        }
      }
    });

    const payload: StatsPayload = {
      totalQuestions,
      totalVolume: totalVolume.toFixed(4),
      uniqueWallets: wallets.size,
      totalTransactions: totalQuestions,
      recentTransactions,
    };
    cache = { data: payload, timestamp: Date.now() };

    return NextResponse.json({ ...payload, stale: false, cachedAt: null, unavailable: false });
  } catch {
    // Explorer API is down or timed out. Serve the last known good payload
    // if we have one, rather than zeroing the page out.
    if (cache) {
      return NextResponse.json({ ...cache.data, stale: true, cachedAt: cache.timestamp, unavailable: false });
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
    });
  }
}
