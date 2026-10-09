import { PRICE_PER_QUERY, computeBundleAmount, isValidQueryCount } from "@/lib/pricing";
import { rpcCall } from "@/lib/arcRpc";
import { ERC20_TRANSFER_TOPIC, PAYMENT_RECEIVER, USDC_ADDRESS } from "@/lib/arcConfig";

const USDC_CONTRACT = USDC_ADDRESS;
const RECEIVER = PAYMENT_RECEIVER;
const TRANSFER_TOPIC = ERC20_TRANSFER_TOPIC;
// A payment can be verified up to 7 days after it was mined, so a purchase whose
// confirmation was lost (slow receipt, closed tab) can still be credited.
const MAX_TX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Before the 7-day window shipped (deployed 2026-10-09T16:22Z) credited payments
// left a claim that expired after one hour, so for older transactions there is no
// record of which were already credited, and crediting them again would pay twice.
// Only transactions mined at or after this moment are eligible. It sits 22 minutes
// before the deploy: a scan of the claim keys at 16:47Z found none, and every claim
// written in the previous hour would still have been there, so no transaction mined
// since 16:00Z was credited by the old code. Payments mined earlier go to support.
export const RECOVERY_WINDOW_START_MS = Date.parse("2026-10-09T16:00:00Z");

export type Reason =
  | "not_found"
  | "failed"
  | "no_transfer"
  | "wrong_recipient"
  | "wrong_amount"
  | "wrong_sender"
  | "too_old"
  | "before_recovery"
  | "already_used";

// `retryable` tells the client whether waiting and asking again can help
// (the transaction may simply not be visible yet).
export class PaymentVerificationError extends Error {
  constructor(message: string, readonly reason: Reason, readonly retryable = false) {
    super(message);
  }
}

function topicToAddress(topic: string): string {
  return "0x" + topic.slice(-40);
}

// Verifies txHash is a real, mined, exact USDC transfer from walletAddress (the
// session-verified address, never a client-supplied one) to RECEIVER, mined
// inside the recovery window. Read-only: it does not claim or credit anything. When
// `requestedQueries` is omitted (payment recovery) the credit count is derived
// from the amount paid. Returns the number of queries to credit.
export async function checkPurchaseTx(txHash: string, walletAddress: string, requestedQueries: number | undefined): Promise<number> {
  const receipt = await rpcCall<{ status?: string; logs?: unknown[]; blockNumber: string } | null>("eth_getTransactionReceipt", [txHash]);
  if (!receipt) {
    throw new PaymentVerificationError("Transaction not found on Arc Mainnet yet.", "not_found", true);
  }
  if (receipt.status !== "0x1") {
    throw new PaymentVerificationError("Transaction did not succeed.", "failed");
  }

  const logs = (receipt.logs || []) as { address?: string; topics?: string[]; data?: string }[];
  const transferLog = logs.find(
    (log) =>
      log.address?.toLowerCase() === USDC_CONTRACT.toLowerCase() &&
      log.topics?.[0]?.toLowerCase() === TRANSFER_TOPIC &&
      log.topics?.length === 3
  );
  if (!transferLog || !transferLog.topics || !transferLog.data) {
    throw new PaymentVerificationError("No USDC transfer found in transaction.", "no_transfer");
  }

  const from = topicToAddress(transferLog.topics[1]);
  const to = topicToAddress(transferLog.topics[2]);
  const value = BigInt(transferLog.data);

  if (to.toLowerCase() !== RECEIVER.toLowerCase()) {
    throw new PaymentVerificationError("Transfer recipient does not match.", "wrong_recipient");
  }
  if (from.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new PaymentVerificationError("Transfer sender does not match your session wallet.", "wrong_sender");
  }

  let queries: number;
  if (requestedQueries === undefined) {
    const units = Number(value);
    queries = units / PRICE_PER_QUERY;
    if (!Number.isInteger(queries) || !isValidQueryCount(queries)) {
      throw new PaymentVerificationError("Transfer amount is not a valid credit bundle.", "wrong_amount");
    }
  } else {
    queries = requestedQueries;
    if (value !== BigInt(computeBundleAmount(queries))) {
      throw new PaymentVerificationError("Transfer amount does not match the requested query count.", "wrong_amount");
    }
  }

  const block = await rpcCall<{ timestamp: string }>("eth_getBlockByNumber", [receipt.blockNumber, false]);
  const blockTimeMs = parseInt(block.timestamp, 16) * 1000;
  if (Date.now() - blockTimeMs > MAX_TX_AGE_MS) {
    throw new PaymentVerificationError("This transaction is outside the 7-day recovery window. Contact support.", "too_old");
  }
  if (blockTimeMs < RECOVERY_WINDOW_START_MS) {
    // Held, not rejected: the client keeps the saved payment so it can be retried or recovered.
    throw new PaymentVerificationError("This payment was made before our recovery system went live. Contact support.", "before_recovery");
  }

  return queries;
}

