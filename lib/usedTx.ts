import { getRedis } from "./redis";

// Marks a payment txHash as spent so it can't be replayed to get more than
// one AI response. Backed by Redis (not in-memory) because serverless
// deployments run multiple instances with no shared memory — an in-memory
// set would fail to catch replays that land on a different instance.
const TTL_SECONDS = 60 * 60; // generous vs. the 5-minute tx-age window we enforce separately

const getClient = getRedis;

function txKey(txHash: string): string {
  return `microai:usedtx:${txHash.toLowerCase()}`;
}

// Atomically claims a txHash. Returns true if this call claimed it (first
// use), false if it was already claimed (replay).
export async function claimTxHash(txHash: string): Promise<boolean> {
  const result = await getClient().set(txKey(txHash), "1", { nx: true, ex: TTL_SECONDS });
  return result === "OK";
}

// Releases a claim — used only when crediting the wallet after a successful
// claim fails, so the payer isn't permanently locked out of retrying the
// same on-chain transaction for a credit they never received.
export async function releaseTxHash(txHash: string): Promise<void> {
  await getClient().del(txKey(txHash));
}
