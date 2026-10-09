import { ApiError, apiErrors, parseJson, withApi } from "@/lib/api";
import { claimTxHash, releaseTxHash } from "@/lib/usedTx";
import { addCredit } from "@/lib/credits";
import { computeBundleAmount } from "@/lib/pricing";
import { rpcCall } from "@/lib/arcRpc";
import { ERC20_TRANSFER_TOPIC, PAYMENT_RECEIVER, USDC_ADDRESS } from "@/lib/arcConfig";
import { purchaseBody } from "@/lib/schemas";

const USDC_CONTRACT = USDC_ADDRESS;
const RECEIVER = PAYMENT_RECEIVER;
const TRANSFER_TOPIC = ERC20_TRANSFER_TOPIC;
const MAX_TX_AGE_MS = 10 * 60 * 1000;

class PaymentVerificationError extends Error {}

function topicToAddress(topic: string): string {
  return "0x" + topic.slice(-40);
}

// Verifies txHash is a real, recent, exact transfer of `expectedAmount` USDC
// units from walletAddress (the session-verified address, never a
// client-supplied one) to RECEIVER, then atomically marks it spent.
async function verifyPurchase(txHash: string, walletAddress: string, expectedAmount: number): Promise<void> {
  const receipt = await rpcCall<{ status?: string; logs?: unknown[]; blockNumber: string } | null>("eth_getTransactionReceipt", [txHash]);
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

  const block = await rpcCall<{ timestamp: string }>("eth_getBlockByNumber", [receipt.blockNumber, false]);
  const blockTimeMs = parseInt(block.timestamp, 16) * 1000;
  if (Date.now() - blockTimeMs > MAX_TX_AGE_MS) {
    throw new PaymentVerificationError("Transaction is too old.");
  }

  const claimed = await claimTxHash(txHash);
  if (!claimed) {
    throw new PaymentVerificationError("Transaction has already been used.");
  }
}

export const POST = withApi(
  { name: "credits-purchase", auth: "required", limits: [{ limit: 10, windowSec: 60 }] },
  async ({ req, session, log }) => {
    const walletAddress = session!.sub;
    const { txHash, queries } = await parseJson(req, purchaseBody);

    // The expected charge is always computed here from the fixed per-query
    // price — the client's `queries` value is only ever used to derive what
    // amount we require on-chain, never trusted as the amount itself.
    const expectedAmount = computeBundleAmount(queries);

    try {
      await verifyPurchase(txHash, walletAddress, expectedAmount);
    } catch (err) {
      const message = err instanceof PaymentVerificationError ? err.message : "Payment verification failed.";
      log.error("credit purchase verification error", { err });
      throw new ApiError(402, "payment_invalid", message);
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
      throw apiErrors.internal("Payment verified but crediting failed. Please retry with the same transaction.");
    }

    return { ok: true, credits: newTotal, txHash };
  }
);
