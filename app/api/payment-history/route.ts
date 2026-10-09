import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { getCredit } from "@/lib/credits";
import { checkRateLimit } from "@/lib/rateLimit";

const ARC_EXPLORER_API = "https://explorer.arc.io/api/v2";
const USDC_CONTRACT = "0x3600000000000000000000000000000000000000";

const RATE_LIMIT = 20; // requests
const RATE_WINDOW_MS = 60_000; // per minute, per wallet

interface ExplorerTransfer {
  tx_hash?: string;
  transaction_hash?: string;
  from?: { hash?: string };
  to?: { hash?: string };
  total?: { value?: string };
  timestamp?: string;
  token?: { address?: string; address_hash?: string };
}

export async function POST() {
  let walletAddress: string;
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    const session = token ? verifySessionToken(token) : null;
    if (!session) {
      return NextResponse.json({ error: "session_required" }, { status: 401 });
    }
    walletAddress = session.sub;
  } catch (err) {
    console.error("Payment history session error:", err);
    return NextResponse.json({ error: "Session check failed. Please try again later." }, { status: 500 });
  }

  if (!checkRateLimit(`payment-history:${walletAddress}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests. Please slow down and try again shortly." }, { status: 429 });
  }

  let items: ExplorerTransfer[];
  try {
    const res = await fetch(`${ARC_EXPLORER_API}/addresses/${walletAddress}/token-transfers?limit=50`, { cache: "no-store" });
    if (!res.ok) throw new Error(`explorer ${res.status}`);
    const data = await res.json();
    items = Array.isArray(data?.items) ? data.items : [];
  } catch (err) {
    console.error("Payment history explorer error:", err);
    return NextResponse.json({ error: "Failed to fetch payment history. Arc Explorer may be temporarily unavailable." }, { status: 502 });
  }

  const receipts = items
    .filter((t) => (t.token?.address ?? t.token?.address_hash ?? "").toLowerCase() === USDC_CONTRACT)
    .map((t) => {
      const txHash = t.tx_hash ?? t.transaction_hash ?? "";
      return {
        txHash,
        from: t.from?.hash ?? "",
        to: t.to?.hash ?? "",
        amount: (Number(t.total?.value ?? 0) / 1e6).toFixed(3) + " USDC",
        timestamp: t.timestamp ?? "",
        explorerUrl: "https://explorer.arc.io/tx/" + txHash,
      };
    });

  const creditBalance = await getCredit(walletAddress);

  return NextResponse.json({ receipts, creditBalance, walletAddress });
}
