import { getRedis } from "./redis";

// Marks a payment txHash as credited so it can never be credited twice. Backed
// by Redis (not in-memory) because serverless deployments run multiple
// instances with no shared memory.
//
// Claims never expire. A purchase can be verified up to 7 days after it was
// mined (recovery of payments whose confirmation was lost), so a claim has to
// outlive that window; keeping it forever also leaves an audit trail.
const getClient = getRedis;

function txKey(txHash: string): string {
  return `microai:usedtx:${txHash.toLowerCase()}`;
}

export interface TxClaim {
  wallet: string;
  credits: number;
  at: string;
}

// Atomically claims a txHash (SET NX). Returns true if this call claimed it
// (first use), false if it was already claimed (replay).
export async function claimTxHash(txHash: string, claim: TxClaim): Promise<boolean> {
  const result = await getClient().set(txKey(txHash), claim, { nx: true });
  return result === "OK";
}

// Releases a claim — used only when crediting the wallet after a successful
// claim fails, so the payer isn't permanently locked out of retrying the
// same on-chain transaction for a credit they never received.
export async function releaseTxHash(txHash: string): Promise<void> {
  await getClient().del(txKey(txHash));
}
