import { Redis } from "@upstash/redis";

const TTL_SECONDS = 300; // 5 minutes

let client: Redis | null = null;

function getClient(): Redis {
  if (!client) {
    client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return client;
}

function nonceKey(address: string): string {
  return `microai:nonce:${address.toLowerCase()}`;
}

export interface StoredNonce {
  nonce: string;
  expiresAt: string;
}

export async function storeNonce(address: string, nonce: string, expiresAt: string): Promise<void> {
  const value: StoredNonce = { nonce, expiresAt };
  await getClient().set(nonceKey(address), value, { ex: TTL_SECONDS });
}

export async function consumeNonce(address: string): Promise<StoredNonce | null> {
  const key = nonceKey(address);
  const value = await getClient().get<StoredNonce>(key);
  if (!value) return null;
  await getClient().del(key);
  return value;
}
