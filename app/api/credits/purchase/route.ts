import { ApiError, apiErrors, parseJson, withApi } from "@/lib/api";
import { claimTxHash, releaseTxHash } from "@/lib/usedTx";
import { addCredit } from "@/lib/credits";
import { PRICE_PER_QUERY, computeBundleAmount, isValidQueryCount } from "@/lib/pricing";
import { RpcError } from "@/lib/arcRpc";
import { rpcCall } from "@/lib/arcRpc";
import { ERC20_TRANSFER_TOPIC, PAYMENT_RECEIVER, USDC_ADDRESS } from "@/lib/arcConfig";
import { purchaseBody } from "@/lib/schemas";

const USDC_CONTRACT = USDC_ADDRESS;
const RECEIVER = PAYMENT_RECEIVER;
const TRANSFER_TOPIC = ERC20_TRANSFER_TOPIC;
// A payment can be verified up to 7 days after it was mined, so a purchase whose
// confirmation was lost (slow receipt, closed tab) can still be credited.
const MAX_TX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Claims used to expire after an hour, so for transactions mined before this
// release there is no record of which were already credited. Crediting those
// again would pay twice, so only transactions mined after this moment are
// eligible. (Release time + margin; payments lost before it go to support.)
const RECOVERY_WINDOW_START_MS = Date.parse("2026-10-09T17:00:00Z");

type Reason = "not_found" | "failed" | "no_transfer" | "wrong_recipient" | "wrong_amount" | "wrong_sender" | "too_old" | "already_used";

// `retryable` tells the client whether waiting and asking again can help
// (the transaction may simply not be visible yet).
class PaymentVerificationError extends Error {
  constructor(message: string, readonly reason: Reason, readonly retryable = false) {
    super(message);
  }
}

function topicToAddress(topic: string): string {
  return "0x" + topic.slice(-40);
}

// Verifies txHash is a real, mined, exact USDC transfer from walletAddress (the
// session-verified address, never a client-supplied one) to RECEIVER, mined
// inside the recovery window, then atomically marks it credited. When
// `requestedQueries` is omitted (payment recovery) the credit count is derived
// from the amount paid. Returns the number of queries to credit.
async function verifyPurchase(txHash: string, walletAddress: string, requestedQueries: number | undefined): Promise<number> {
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
  if (Date.now() - blockTimeMs > MAX_TX_AGE_MS || blockTimeMs < RECOVERY_WINDOW_START_MS) {
    throw new PaymentVerificationError("This transaction is outside the 7-day recovery window. Contact support.", "too_old");
  }

  const claimed = await claimTxHash(txHash, { wallet: walletAddress.toLowerCase(), credits: queries, at: new Date().toISOString() });
  if (!claimed) {
    throw new PaymentVerificationError("This payment has already been credited.", "already_used");
  }
  return queries;
}

export const POST = withApi(
  { name: "credits-purchase", auth: "required", limits: [{ limit: 10, windowSec: 60 }] },
  async ({ req, session, log }) => {
    const walletAddress = session!.sub;
    const { txHash, queries: requestedQueries } = await parseJson(req, purchaseBody);

    // The expected charge is derived on the server: from the requested bundle
    // size, or (recovery, no `queries`) from the amount actually paid. The client
    // never supplies the amount itself.
    let queries: number;
    try {
      queries = await verifyPurchase(txHash, walletAddress, requestedQueries);
    } catch (err) {
      if (err instanceof PaymentVerificationError) {
        log.warn("credit purchase rejected", { reason: err.reason });
        const status = err.reason === "already_used" ? 409 : 402;
        throw new ApiError(status, "payment_invalid", err.message, { extra: { reason: err.reason, retryable: err.retryable } });
      }
      if (err instanceof RpcError) {
        // The node is unreachable: nothing was claimed, so asking again is safe.
        log.error("credit purchase verification could not reach the RPC", { err });
        throw new ApiError(503, "upstream_unavailable", "Could not reach Arc right now. Your payment is safe; try again shortly.", {
          extra: { reason: "rpc_unavailable", retryable: true },
        });
      }
      log.error("credit purchase verification error", { err });
      throw apiErrors.internal("Payment verification failed.");
    }

    // verifyPurchase() already claimed txHash (atomic NX) to block concurrent
    // double-spends of the same transaction. If crediting then fails, release
    // that claim rather than leaving the payer with a burned, uncreditable
    // txHash and no way to retry the same on-chain payment.
    let newTotal: number;
    try {
      newTotal = await addCredit(walletAddress, queries);
    } catch (err) {
      log.error("addCredit failed after claiming txHash, releasing claim", { err });
      await releaseTxHash(txHash).catch((releaseErr) => {
        log.error("failed to release txHash after addCredit failure", { err: releaseErr });
      });
      throw new ApiError(500, "internal", "Payment verified but crediting failed. Please retry with the same transaction.", {
        extra: { reason: "credit_failed", retryable: true },
      });
    }

    return { ok: true, credits: newTotal, added: queries, txHash };
  }
);
