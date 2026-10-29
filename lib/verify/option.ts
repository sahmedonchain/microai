import type { ArcNetworkId } from "@/lib/arcConfig";
import { NETWORK_BY_CHAIN, isObject, readAddress } from "./checks";
import type { EndpointResponse } from "./types";
import { parseResponse } from "./x402";

// Picks the Arc payment option a transaction should be compared against.

export interface PaymentOption {
  network: ArcNetworkId;
  /** Lower-case addresses. */
  asset: string;
  payTo: string;
  /** Smallest units of the asset. */
  amount: bigint;
  /** Circle Gateway batching: one payment may not appear as its own transfer. */
  batched: boolean;
}

export function selectPaymentOption(res: EndpointResponse, wanted?: ArcNetworkId): PaymentOption | undefined {
  const { parsed } = parseResponse(res);
  if (!parsed) return undefined;
  for (const raw of parsed.accepts) {
    if (!isObject(raw) || typeof raw.network !== "string") continue;
    const m = /^eip155:(\d+)$/.exec(raw.network);
    const network = m ? NETWORK_BY_CHAIN.get(Number(m[1])) : undefined;
    if (!network || (wanted && network !== wanted)) continue;
    const asset = readAddress(raw.asset);
    const payTo = readAddress(raw.payTo);
    let amount: bigint | undefined;
    if (typeof raw.amount === "string" && /^\d+$/.test(raw.amount)) amount = BigInt(raw.amount);
    else if (typeof raw.amount === "number" && Number.isSafeInteger(raw.amount) && raw.amount >= 0) amount = BigInt(raw.amount);
    if (!asset.ok || !payTo.ok || amount === undefined) continue;
    const extra = isObject(raw.extra) ? raw.extra : undefined;
    return { network, asset: asset.lower, payTo: payTo.lower, amount, batched: extra?.name === "GatewayWalletBatched" };
  }
  return undefined;
}
