import { Redis } from "@upstash/redis";

// Prepaid query credit ledger, keyed by wallet address (never trust an
// address from a request body — callers must derive it from the verified
// session). Stored in Redis so credit survives across serverless instances.
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

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

function creditKey(address: string): string {
  return `microai:credit:${address.toLowerCase()}`;
}

export async function getCredit(address: string): Promise<number> {
  const value = await getClient().get<number>(creditKey(address));
  return typeof value === "number" ? value : 0;
}

// Adds `queries` credit and refreshes the 30-day TTL. Returns the new total.
export async function addCredit(address: string, queries: number): Promise<number> {
  const key = creditKey(address);
  const newTotal = await getClient().incrby(key, queries);
  await getClient().expire(key, TTL_SECONDS);
  return newTotal;
}

// Atomically spends 1 credit. DECR is atomic in Redis, so concurrent
// requests can't both spend the last credit: if the decrement goes negative
// (no credit was available), it's compensated back and the caller is told
// there was nothing to spend.
export async function spendCredit(address: string): Promise<number | null> {
  const key = creditKey(address);
  const remaining = await getClient().decr(key);
  if (remaining < 0) {
    await getClient().incr(key);
    return null;
  }
  return remaining;
}
