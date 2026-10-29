import { ARC_ADDRESSES, type AddressEntry } from "@/lib/arcAddresses";
import { ARC_NETWORKS, ERC20_TRANSFER_TOPIC, type ArcNetworkId } from "@/lib/arcConfig";
import { rpcCall } from "@/lib/arcRpc";
import { formatUnits } from "./checks";
import type { Finding } from "./types";

// Checks, from the transaction receipt, whether a payment really reached the
// recipient the endpoint asked for, in the amount and token it asked for. Arc
// has deterministic finality, so a receipt in a committed block is final.

export interface ExpectedPayment {
  network: ArcNetworkId;
  /** Lower-case addresses. */
  asset: string;
  payTo: string;
  /** Smallest units of the asset. */
  amount: bigint;
}

interface ReceiptLog {
  address?: string;
  topics?: string[];
  data?: string;
  removed?: boolean;
}

export interface TxReceipt {
  transactionHash?: string;
  status?: string;
  blockNumber?: string;
  logs?: ReceiptLog[];
}

export type ReceiptFetcher = (txHash: string, network: ArcNetworkId) => Promise<TxReceipt | null>;

export const fetchReceipt: ReceiptFetcher = (txHash, network) =>
  rpcCall<TxReceipt | null>("eth_getTransactionReceipt", [txHash], { url: ARC_NETWORKS[network].rpcUrl });

export interface TxCheckResult {
  network: ArcNetworkId;
  txHash: string;
  explorerUrl: string;
  findings: Finding[];
}

const ZERO = BigInt(0);
const TEN_POW_12 = BigInt("1000000000000");
const other = (n: ArcNetworkId): ArcNetworkId => (n === "mainnet" ? "testnet" : "mainnet");
const explorerFor = (n: ArcNetworkId, hash: string) => `${ARC_NETWORKS[n].explorerUrl}/tx/${hash}`;
const shortAddr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;
const topicToAddress = (t: string) => ("0x" + t.slice(-40)).toLowerCase();

interface Transfer {
  token: string;
  from: string;
  to: string;
  value: bigint;
}

function readTransfers(receipt: TxReceipt): Transfer[] {
  const out: Transfer[] = [];
  for (const l of receipt.logs ?? []) {
    if (l.removed === true || l.topics?.length !== 3 || l.topics[0].toLowerCase() !== ERC20_TRANSFER_TOPIC || typeof l.data !== "string" || l.data.length <= 2 || typeof l.address !== "string") continue;
    let value: bigint;
    try {
      value = BigInt(l.data);
    } catch {
      continue;
    }
    out.push({ token: l.address.toLowerCase(), from: topicToAddress(l.topics[1]), to: topicToAddress(l.topics[2]), value });
  }
  return out;
}

function tokenName(address: string): string {
  const a = address.toLowerCase();
  for (const entry of Object.values(ARC_ADDRESSES) as AddressEntry[]) {
    for (const net of ["mainnet", "testnet"] as const) {
      const v = entry[net];
      if (v && v.toLowerCase() === a) return entry.label;
    }
  }
  return shortAddr(a);
}

export async function verifyTransaction(txHash: string, expected: ExpectedPayment, fetcher: ReceiptFetcher = fetchReceipt): Promise<TxCheckResult> {
  const net = expected.network;
  const netName = ARC_NETWORKS[net].name;
  const findings: Finding[] = [];
  const result = (): TxCheckResult => ({ network: net, txHash, explorerUrl: explorerFor(net, txHash), findings });

  const receipt = await fetcher(txHash, net);

  if (!receipt) {
    // Not on this network. Look on the other one: a Testnet payment checked
    // against Mainnet (or the reverse) is a common mix-up.
    let elsewhere: TxReceipt | null = null;
    try {
      elsewhere = await fetcher(txHash, other(net));
    } catch {
      elsewhere = null;
    }
    if (elsewhere) {
      findings.push({
        id: "tx.network",
        severity: "error",
        title: `Transaction is on ${ARC_NETWORKS[other(net)].name}, not ${netName}`,
        reason: `The hash exists on ${ARC_NETWORKS[other(net)].name}, so the payment was made on the wrong network for this check.`,
        evidence: explorerFor(other(net), txHash),
        fix: `Check the endpoint's network and the network your wallet paid on. Both must be ${netName}.`,
      });
    } else {
      findings.push({
        id: "tx.found",
        severity: "warning",
        title: `Transaction not found on ${netName}`,
        reason: "The node has no receipt for this hash. It may not be mined yet, the hash may have a typo, or it may be on a network other than Arc.",
        fix: "Check the hash and the network, then try again in a minute.",
      });
    }
    return result();
  }

  if (typeof receipt.transactionHash === "string" && receipt.transactionHash.toLowerCase() !== txHash.toLowerCase()) {
    findings.push({ id: "tx.found", severity: "error", title: "The node returned a different transaction", reason: "The receipt does not belong to the hash you gave, so nothing was verified. Try again shortly." });
    return result();
  }

  if (typeof receipt.blockNumber !== "string") {
    findings.push({ id: "tx.found", severity: "warning", title: "Transaction is not in a block yet", reason: "It has not been committed. Arc transactions are final as soon as they are in a block.", fix: "Try again in a minute." });
    return result();
  }

  if (receipt.status !== "0x1") {
    findings.push({
      id: "tx.status",
      severity: "error",
      title: "Transaction failed",
      reason: "The transaction was committed but reverted, so no funds moved.",
      evidence: `status: ${receipt.status ?? "missing"}`,
      fix: "Look at the explorer page for the revert reason, then pay again.",
    });
    return result();
  }
  findings.push({ id: "tx.status", severity: "ok", title: "Transaction succeeded", reason: `It is in block ${parseInt(receipt.blockNumber, 16)} on ${netName} and is final.` });

  const transfers = readTransfers(receipt);
  const assetName = tokenName(expected.asset);
  const ofAsset = transfers.filter((t) => t.token === expected.asset);
  const toPayee = ofAsset.filter((t) => t.to === expected.payTo);

  if (toPayee.length === 0) {
    const otherTokenToPayee = transfers.filter((t) => t.token !== expected.asset && t.to === expected.payTo);
    if (otherTokenToPayee.length > 0) {
      findings.push({
        id: "tx.token",
        severity: "error",
        title: "The recipient was paid in a different token",
        reason: `The recipient received ${tokenName(otherTokenToPayee[0].token)}, but the endpoint asked for ${assetName}.`,
        fix: `Pay with ${assetName}.`,
      });
    } else if (ofAsset.length > 0) {
      const recipients = Array.from(new Set(ofAsset.map((t) => shortAddr(t.to)))).slice(0, 3).join(", ");
      findings.push({
        id: "tx.recipient",
        severity: "error",
        title: "The payment went to a different recipient",
        reason: `${assetName} was sent, but not to ${shortAddr(expected.payTo)}. It went to: ${recipients}.`,
        fix: "Check the payTo address the endpoint returns and the address your wallet paid.",
      });
    } else {
      findings.push({
        id: "tx.token",
        severity: "error",
        title: `No ${assetName} transfer in this transaction`,
        reason: "The transaction succeeded but moved no tokens of the expected asset. Only token transfers are checked here, not native-currency sends.",
        fix: "Confirm this is the payment transaction.",
      });
    }
    return result();
  }

  const paid = toPayee.reduce((sum, t) => sum + t.value, ZERO);
  const need = expected.amount;
  const ev = `paid ${formatUnits(paid, 6)}, required ${formatUnits(need, 6)} (units ${paid} and ${need})`;
  if (paid === need) {
    findings.push({ id: "tx.amount", severity: "ok", title: `Paid exactly ${formatUnits(paid, 6)} USDC to the recipient`, reason: "The amount matches what the endpoint asked for.", evidence: ev });
  } else if (need === paid * TEN_POW_12) {
    findings.push({
      id: "tx.amount",
      severity: "error",
      title: "The required amount is 10^12 times the amount paid",
      reason: "The endpoint's amount is the paid amount written with 18 decimals instead of 6. The payment is probably right and the endpoint's price is wrong.",
      evidence: ev,
      fix: `Set the endpoint's amount to "${paid}".`,
    });
  } else if (paid < need) {
    findings.push({ id: "tx.amount", severity: "error", title: "Paid less than the endpoint asked for", reason: "The recipient received less than the required amount.", evidence: ev, fix: "Pay the full amount." });
  } else {
    findings.push({ id: "tx.amount", severity: "warning", title: "Paid more than the endpoint asked for", reason: "The recipient received more than the required amount. With the exact scheme the amount should match.", evidence: ev });
  }

  const senders = Array.from(new Set(toPayee.map((t) => t.from)));
  findings.push({ id: "tx.sender", severity: "info", title: `Paid from ${senders.map(shortAddr).join(", ")}`, reason: "This is the wallet whose tokens moved. MicroAI does not know whose it is." });
  return result();
}
