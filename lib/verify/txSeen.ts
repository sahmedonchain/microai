import { getRedis } from "@/lib/redis";
import type { ArcNetworkId } from "@/lib/arcConfig";
import type { Finding } from "@/lib/verify/types";

// "Already checked" memory for Verify's transaction check.
//
// What it is: the first time MicroAI checks a successful transaction it records
// the time (Redis SET NX, so two simultaneous first checks cannot both be "first").
// Later checks of the same hash say it was checked before.
//
// What it is NOT: MicroAI does not know your orders. It cannot tell whether a hash
// was used to fulfil an order, and the same person re-checking their own payment
// looks identical to someone replaying it. A shop must still accept each hash once
// in its own database. This is a hint, never proof that a payment is unused.
//
// Only successful transactions are recorded. If Redis fails, no finding is added
// (and none is claimed): the check itself is never blocked by this.

export const SEEN_TTL_SEC = 30 * 24 * 3600;

const seenKey = (network: ArcNetworkId, txHash: string) => `microai:txseen:${network}:${txHash.toLowerCase()}`;

/** Returns the ISO time of the FIRST earlier check, or null when this is the first (or Redis is unavailable). */
export async function recordTxSeen(network: ArcNetworkId, txHash: string, now: Date = new Date()): Promise<string | null> {
  try {
    const redis = getRedis();
    const key = seenKey(network, txHash);
    const stored = await redis.set(key, now.toISOString(), { nx: true, ex: SEEN_TTL_SEC });
    if (stored) return null; // we wrote it: first check
    const first = await redis.get<string>(key);
    return typeof first === "string" ? first : null;
  } catch {
    return null;
  }
}

export function seenFinding(firstCheckedAt: string): Finding {
  return {
    id: "tx.seen",
    severity: "info",
    title: "This transaction hash was checked before",
    reason: `MicroAI first checked this hash on ${firstCheckedAt.slice(0, 10)} (kept for 30 days). Checking your own payment twice is normal. If you fulfil orders from payments, accept each transaction hash only once in your own system: MicroAI does not know your orders and cannot tell whether a hash was already used.`,
    evidence: `first checked: ${firstCheckedAt}`,
  };
}
