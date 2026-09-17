import { NextResponse } from "next/server";

const RECEIVER = "0x78C144A76614A8674285129810555C8bCa78f044";
const USDC_CONTRACT = "0x3600000000000000000000000000000000000000";
const RECENT_LIMIT = 10;

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

export async function GET() {
  try {
    const res = await fetch(
      `https://explorer.arc.io/api/v2/addresses/${RECEIVER}/token-transfers?token=${USDC_CONTRACT}`,
      { cache: "no-store" }
    );

    if (!res.ok) throw new Error("API failed");

    const data = await res.json();
    const transfers: RawTransfer[] = data.items || [];

    const wallets = new Set<string>();
    let totalVolume = 0;
    let totalQuestions = 0;
    const recentTransactions: RecentTransaction[] = [];

    transfers.forEach((tx) => {
      // শুধু incoming USDC payments count করো
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

    return NextResponse.json({
      totalQuestions,
      totalVolume: totalVolume.toFixed(4),
      uniqueWallets: wallets.size,
      totalTransactions: totalQuestions,
      recentTransactions,
    });
  } catch {
    return NextResponse.json({
      totalQuestions: 0,
      totalVolume: "0.0000",
      uniqueWallets: 0,
      totalTransactions: 0,
      recentTransactions: [],
    });
  }
}