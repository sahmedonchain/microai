import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { claimTxHash } from "@/lib/usedTx";
import { addCredit } from "@/lib/credits";
import { isValidQueryCount, computeBundleAmount } from "@/lib/pricing";

const ARC_RPC = "https://rpc.mainnet.arc.io";
const USDC_CONTRACT = "0x3600000000000000000000000000000000000000";
const RECEIVER = "0x9a318CD2BC533B5B2e96F7f5b499738732492b15";

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const MAX_TX_AGE_MS = 10 * 60 * 1000;

class PaymentVerificationError extends Error {}

function topicToAddress(topic: string): string {
  return "0x" + topic.slice(-40);
}

async function rpcCall(method: string, params: unknown[]) {
  const res = await fetch(ARC_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.result;
}

// Verifies txHash is a real, recent, exact transfer of `expectedAmount` USDC
// units from walletAddress (the session-verified address, never a
// client-supplied one) to RECEIVER, then atomically marks it spent.
async function verifyPurchase(txHash: string, walletAddress: string, expectedAmount: number): Promise<void> {
  const receipt = await rpcCall("eth_getTransactionReceipt", [txHash]);
  if (!receipt) {
    throw new PaymentVerificationError("Transaction not found on Arc MAINNET.");
  }
  if (receipt.status !== "0x1") {
    throw new PaymentVerificationError("Transaction did not succeed.");
  }

  const logs = (receipt.logs || []) as { address?: string; topics?: string[]; data?: string }[];
  const transferLog = logs.find(
    (log) =>
      log.address?.toLowerCase() === USDC_CONTRACT.toLowerCase() &&
      log.topics?.[0]?.toLowerCase() === TRANSFER_TOPIC &&
      log.topics?.length === 3
  );
  if (!transferLog || !transferLog.topics || !transferLog.data) {
    throw new PaymentVerificationError("No USDC transfer found in transaction.");
  }

  const from = topicToAddress(transferLog.topics[1]);
  const to = topicToAddress(transferLog.topics[2]);
  const value = BigInt(transferLog.data);

  if (to.toLowerCase() !== RECEIVER.toLowerCase()) {
    throw new PaymentVerificationError("Transfer recipient does not match.");
  }
  if (value !== BigInt(expectedAmount)) {
    throw new PaymentVerificationError("Transfer amount does not match the requested query count.");
  }
  if (from.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new PaymentVerificationError("Transfer sender does not match your session wallet.");
  }

  const block = await rpcCall("eth_getBlockByNumber", [receipt.blockNumber, false]);
  const blockTimeMs = parseInt(block.timestamp, 16) * 1000;
  if (Date.now() - blockTimeMs > MAX_TX_AGE_MS) {
    throw new PaymentVerificationError("Transaction is too old.");
  }

  const claimed = await claimTxHash(txHash);
  if (!claimed) {
    throw new PaymentVerificationError("Transaction has already been used.");
  }
}

export async function POST(req: Request) {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    const session = token ? verifySessionToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: "session_required" }, { status: 401 });
    }
    const walletAddress = session.sub;

    const { txHash, queries } = await req.json();

    if (typeof txHash !== "string" || !TX_HASH_RE.test(txHash)) {
      return NextResponse.json({ error: "Invalid or missing transaction hash." }, { status: 400 });
    }
    if (!isValidQueryCount(queries)) {
      return NextResponse.json({ error: "queries must be an integer between 1 and 1000." }, { status: 400 });
    }

    // The expected charge is always computed here from the fixed per-query
    // price — the client's `queries` value is only ever used to derive what
    // amount we require on-chain, never trusted as the amount itself.
    const expectedAmount = computeBundleAmount(queries);

    try {
      await verifyPurchase(txHash, walletAddress, expectedAmount);
    } catch (err) {
      const message = err instanceof PaymentVerificationError ? err.message : "Payment verification failed.";
      console.error("Credit purchase verification error:", err);
      return NextResponse.json({ error: message }, { status: 402 });
    }

    const newTotal = await addCredit(walletAddress, queries);
    return NextResponse.json({ ok: true, credit: newTotal, txHash });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error occurred." }, { status: 500 });
  }
}
