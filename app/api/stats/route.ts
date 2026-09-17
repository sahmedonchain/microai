import { NextResponse } from "next/server";

const RECEIVER = "0x78C144A76614A8674285129810555C8bCa78f044";

export async function GET() {
  try {
    const res = await fetch(
      `https://explorer.arc.io/api/v2/addresses/${RECEIVER}/token-transfers?type=ERC-20`,
      { cache: "no-store" }
    );

    if (!res.ok) throw new Error("API failed");

    const data = await res.json();
    const transfers = data.items || [];

    const wallets = new Set<string>();
    let totalVolume = 0;
    let totalQuestions = 0;

    transfers.forEach((tx: {
      from: { hash: string };
      to: { hash: string };
      total: { value: string; decimals: string };
      token: { address_hash: string };
    }) => {
      // শুধু incoming USDC payments count করো
      if (
        tx.to?.hash?.toLowerCase() === RECEIVER.toLowerCase() &&
        tx.from?.hash?.toLowerCase() !== RECEIVER.toLowerCase() &&
        tx.token?.address_hash === "0x3600000000000000000000000000000000000000"
      ) {
        wallets.add(tx.from.hash.toLowerCase());
        const value = parseFloat(tx.total.value) / Math.pow(10, parseInt(tx.total.decimals));
        totalVolume += value;
        totalQuestions++;
      }
    });

    return NextResponse.json({
      totalQuestions,
      totalVolume: totalVolume.toFixed(4),
      uniqueWallets: wallets.size,
      totalTransactions: totalQuestions,
    });
  } catch {
    return NextResponse.json({
      totalQuestions: 0,
      totalVolume: "0.0000",
      uniqueWallets: 0,
      totalTransactions: 0,
    });
  }
}