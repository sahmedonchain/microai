import { getRedis } from "./redis";

// Prepaid query credit ledger, keyed by wallet address (never trust an
// address from a request body — callers must derive it from the verified
// session). Stored in Redis so credit survives across serverless instances.
//
// Purchased credits never expire. Balances written before this change carried
// a 30-day TTL; they are made permanent when touched (read, spend, top-up) and
// in bulk by scripts/persist-credits.ts.

const getClient = getRedis;

export function creditKey(address: string): string {
  return `microai:credit:${address.toLowerCase()}`;
}

// Removes any leftover expiry. Failure is not fatal: the next touch retries.
async function keepForever(key: string): Promise<void> {
  try {
    await getClient().persist(key);
  } catch {
    /* best effort */
  }
}

export async function getCredit(address: string): Promise<number> {
  const key = creditKey(address);
  const value = await getClient().get<number>(key);
  if (typeof value !== "number") return 0;
  if (value > 0) await keepForever(key);
  return value;
}

// Adds `queries` credit. Returns the new total.
export async function addCredit(address: string, queries: number): Promise<number> {
  const key = creditKey(address);
  const newTotal = await getClient().incrby(key, queries);
  await keepForever(key);
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
  if (remaining > 0) await keepForever(key);
  return remaining;
}
