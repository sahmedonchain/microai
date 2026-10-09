import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { getCredit } from "@/lib/credits";
import { checkRateLimit } from "@/lib/rateLimit";
import { explorerFetch } from "@/lib/arcExplorer";

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

  // Ask the Explorer for USDC only, so older payments are not pushed off the
  // first page by other token activity. The filter below stays as a guard.
  const res = await explorerFetch<{ items?: ExplorerTransfer[] }>(
    `/addresses/${walletAddress}/token-transfers?type=ERC-20&token=${USDC_CONTRACT}`
  );
  if (!res.ok) {
    return NextResponse.json({ error: "Arc Explorer is unreachable right now. Try again in a moment." }, { status: 502 });
  }
  const items = Array.isArray(res.data?.items) ? res.data.items : [];

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
