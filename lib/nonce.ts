import { getRedis } from "./redis";

// Single-use sign-in nonces. Each nonce is its own Redis key with a short
// TTL and is consumed with an atomic GETDEL, so it can be used exactly once
// even under concurrent requests. Keying by nonce (not by address) also stops
// one caller from overwriting another wallet's pending sign-in.
export const NONCE_TTL_SECONDS = 300; // 5 minutes

export interface StoredNonce {
  address: string; // lowercase
  message: string; // the exact message that was issued
  expiresAt: string;
}

function nonceKey(nonce: string): string {
  return `microai:siwe:nonce:${nonce}`;
}

export async function storeNonce(nonce: string, value: StoredNonce): Promise<void> {
  await getRedis().set(nonceKey(nonce), value, { ex: NONCE_TTL_SECONDS });
}

export async function consumeNonce(nonce: string): Promise<StoredNonce | null> {
  return (await getRedis().getdel<StoredNonce>(nonceKey(nonce))) ?? null;
}
