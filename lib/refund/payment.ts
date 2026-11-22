import { USDC_ADDRESS, ARC_NETWORKS, type ArcNetworkId } from "@/lib/arcConfig";
import { fetchReceipt, readTransfers, type ReceiptFetcher } from "@/lib/verify/txVerify";
import type { PaymentRecord } from "./types";

export class PaymentReadError extends Error {
  constructor(message: string, readonly kind: "not_found" | "invalid") {
    super(message);
  }
}

/**
 * Reads a finished USDC payment from the chain: who paid, who was paid, how much.
 * The payee is named by the caller; what counts is that the receipt really shows
 * USDC moving to it. Throws PaymentReadError when there is no such payment.
 */
export async function readPayment(
  network: ArcNetworkId,
  txHash: string,
  payee: string,
  fetcher: ReceiptFetcher = fetchReceipt
): Promise<PaymentRecord> {
  const receipt = await fetcher(txHash, network);
  const where = ARC_NETWORKS[network].name;
  if (!receipt || typeof receipt.blockNumber !== "string") throw new PaymentReadError(`No committed transaction with this hash on ${where}.`, "not_found");
  if (typeof receipt.transactionHash === "string" && receipt.transactionHash.toLowerCase() !== txHash.toLowerCase()) throw new PaymentReadError("The node returned a different transaction.", "invalid");
  if (receipt.status !== "0x1") throw new PaymentReadError("That transaction failed on chain, so no payment was made.", "invalid");

  const to = payee.toLowerCase();
  const paid = readTransfers(receipt).filter((t) => t.token === USDC_ADDRESS.toLowerCase() && t.to === to);
  if (paid.length === 0) throw new PaymentReadError("This transaction has no USDC transfer to that recipient.", "invalid");
  const payers = new Set(paid.map((t) => t.from));
  if (payers.size !== 1) throw new PaymentReadError("The recipient was paid by more than one wallet in this transaction, so it cannot be tied to one buyer.", "invalid");
  const amount = paid.reduce((s, t) => s + t.value, BigInt(0));
  return { network, txHash: txHash.toLowerCase(), payer: [...payers][0], payee: to, asset: USDC_ADDRESS.toLowerCase(), amount: amount.toString(), blockNumber: parseInt(receipt.blockNumber, 16) };
}

/** Total USDC the receipt shows moving from `from` to `to`. */
export function usdcMoved(receipt: Awaited<ReturnType<ReceiptFetcher>>, from: string, to: string): bigint {
  if (!receipt || receipt.status !== "0x1") return BigInt(0);
  return readTransfers(receipt)
    .filter((t) => t.token === USDC_ADDRESS.toLowerCase() && t.from === from.toLowerCase() && t.to === to.toLowerCase())
    .reduce((s, t) => s + t.value, BigInt(0));
}
