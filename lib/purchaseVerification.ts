import { PRICE_PER_QUERY, computeBundleAmount, isValidQueryCount } from "@/lib/pricing";
import { rpcCall } from "@/lib/arcRpc";
import { ARC_MAINNET, ERC20_TRANSFER_TOPIC, PAYMENT_RECEIVER, USDC_ADDRESS } from "@/lib/arcConfig";
import { createLogger } from "@/lib/logger";

const log = createLogger({ lib: "purchaseVerification" });

const USDC_CONTRACT = USDC_ADDRESS.toLowerCase();
const RECEIVER = PAYMENT_RECEIVER.toLowerCase();
const TRANSFER_TOPIC = ERC20_TRANSFER_TOPIC;

// A payment can be verified up to 7 days after it was mined, so a purchase whose
// confirmation was lost (slow receipt, closed tab) can still be credited.
const MAX_TX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Payments are recoverable from this moment on; earlier ones are handled by support.
export const RECOVERY_WINDOW_START_MS = Date.parse("2026-10-09T16:00:00Z");

export type Reason =
  | "not_found"
  | "failed"
  | "no_transfer"
  | "wrong_recipient"
  | "wrong_amount"
  | "wrong_sender"
  | "wrong_chain"
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

// --- chain check -------------------------------------------------------------
// Every verification confirms that the RPC really is Arc Mainnet. The answer is
// cached for a minute so a burst of purchases costs one extra call, not one each.
const CHAIN_CHECK_TTL_MS = 60_000;
let chainConfirmedAt = 0;

export function resetChainCheckCache() {
  chainConfirmedAt = 0;
}

async function assertArcMainnet(): Promise<void> {
  if (Date.now() - chainConfirmedAt < CHAIN_CHECK_TTL_MS) return;
  const chainId = await rpcCall<string>("eth_chainId", []);
  if (typeof chainId !== "string" || chainId.toLowerCase() !== ARC_MAINNET.chainIdHex) {
    log.error("RPC returned an unexpected chain id", { expected: ARC_MAINNET.chainIdHex, got: String(chainId) });
    // Nothing is claimed or credited. The user's payment is untouched and can be retried.
    throw new PaymentVerificationError("Could not confirm the Arc Mainnet network right now. Try again shortly.", "wrong_chain", true);
  }
  chainConfirmedAt = Date.now();
}

// --- receipt -----------------------------------------------------------------
interface ReceiptLog {
  address?: string;
  topics?: string[];
  data?: string;
  logIndex?: string;
}

interface Receipt {
  status?: string;
  logs?: ReceiptLog[];
  blockNumber: string;
}

function topicToAddress(topic: string): string {
  return ("0x" + topic.slice(-40)).toLowerCase();
}

export interface VerifiedPurchase {
  queries: number;
  units: bigint; // total USDC (6-decimal units) credited
  logIndexes: number[]; // which Transfer logs were counted
}

// Verifies that txHash is a successful transaction on Arc Mainnet that paid
// USDC from walletAddress (the session-verified address, never a client-supplied
// one) to the MicroAI wallet, mined inside the recovery window. Every USDC
// Transfer log in the receipt is examined; those from this wallet to our
// wallet are summed, so a batched transaction with other transfers works.
// Read-only: it does not claim or credit anything. When `requestedQueries` is
// omitted (payment recovery) the credit count is derived from the amount paid.
export async function checkPurchaseTx(txHash: string, walletAddress: string, requestedQueries: number | undefined): Promise<VerifiedPurchase> {
  await assertArcMainnet();

  const receipt = await rpcCall<Receipt | null>("eth_getTransactionReceipt", [txHash]);
  if (!receipt) {
    throw new PaymentVerificationError("Transaction not found on Arc Mainnet yet.", "not_found", true);
  }
  if (receipt.status !== "0x1") {
    throw new PaymentVerificationError("Transaction did not succeed.", "failed");
  }

  const wallet = walletAddress.toLowerCase();
  const transfers = (receipt.logs ?? [])
    .map((l, i) => ({ l, index: l.logIndex !== undefined ? parseInt(l.logIndex, 16) : i }))
    .filter(
      ({ l }) =>
        l.address?.toLowerCase() === USDC_CONTRACT &&
        l.topics?.length === 3 &&
        l.topics[0].toLowerCase() === TRANSFER_TOPIC &&
        typeof l.data === "string" &&
        l.data.length > 2
    )
    .map(({ l, index }) => ({ index, from: topicToAddress(l.topics![1]), to: topicToAddress(l.topics![2]), value: BigInt(l.data!) }));

  if (transfers.length === 0) {
    throw new PaymentVerificationError("No USDC transfer found in transaction.", "no_transfer");
  }
  const toUs = transfers.filter((t) => t.to === RECEIVER);
  if (toUs.length === 0) {
    throw new PaymentVerificationError("Transfer recipient does not match.", "wrong_recipient");
  }
  const matching = toUs.filter((t) => t.from === wallet);
  if (matching.length === 0) {
    throw new PaymentVerificationError("Transfer sender does not match your session wallet.", "wrong_sender");
  }

  const units = matching.reduce((sum, t) => sum + t.value, BigInt(0));
  let queries: number;
  if (requestedQueries === undefined) {
    queries = Number(units) / PRICE_PER_QUERY;
    if (!Number.isInteger(queries) || !isValidQueryCount(queries)) {
      throw new PaymentVerificationError("Transfer amount is not a valid credit bundle.", "wrong_amount");
    }
  } else {
    queries = requestedQueries;
    if (units !== BigInt(computeBundleAmount(queries))) {
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

  return { queries, units, logIndexes: matching.map((t) => t.index) };
}
