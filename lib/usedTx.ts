import { getRedis } from "./redis";
import { creditKey } from "./credits";

// Marks a payment txHash as credited so it can never be credited twice, and
// credits the wallet in the SAME atomic Redis operation. Backed by Redis (not
// in-memory) because serverless deployments run multiple instances.
//
// Claims never expire. A purchase can be verified up to 7 days after it was
// mined, so a claim has to outlive that window; keeping it forever also leaves
// an audit trail. A claim is never released: if a call fails ambiguously
// (timeout after Redis applied it) the retry finds the claim and reports
// "already credited" instead of crediting twice.

function txKey(txHash: string): string {
  return `microai:usedtx:${txHash.toLowerCase()}`;
}

// One claim per transaction hash, however many Transfer logs it contains: the
// claim covers the whole transaction, and records which logs were counted.
export interface TxClaim {
  wallet: string;
  credits: number;
  logIndexes: number[];
  at: string;
  status: "credited";
}

export type ClaimResult =
  | { outcome: "credited"; balance: number }
  // The claim already existed. `claim` is null for legacy entries (value "1") whose owner is unknown.
  | { outcome: "already"; claim: TxClaim | null };

// KEYS[1] claim key, KEYS[2] credit key; ARGV[1] claim JSON, ARGV[2] credits.
// Redis runs a script atomically, so claim and credit succeed or fail together.
export const CLAIM_AND_CREDIT_SCRIPT = `
local existing = redis.call('GET', KEYS[1])
if existing then return {0, existing} end
redis.call('SET', KEYS[1], ARGV[1])
local balance = redis.call('INCRBY', KEYS[2], tonumber(ARGV[2]))
redis.call('PERSIST', KEYS[2])
return {1, balance}
`;

function parseClaim(raw: unknown): TxClaim | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  const c = value as Partial<TxClaim> | null;
  return c && typeof c === "object" && typeof c.wallet === "string" ? (c as TxClaim) : null;
}

export async function getClaim(txHash: string): Promise<{ exists: boolean; claim: TxClaim | null }> {
  const raw = await getRedis().get(txKey(txHash));
  return raw === null ? { exists: false, claim: null } : { exists: true, claim: parseClaim(raw) };
}

export async function claimAndCredit(txHash: string, wallet: string, credits: number, logIndexes: number[]): Promise<ClaimResult> {
  const claim: TxClaim = { wallet: wallet.toLowerCase(), credits, logIndexes, at: new Date().toISOString(), status: "credited" };
  const res = (await getRedis().eval(CLAIM_AND_CREDIT_SCRIPT, [txKey(txHash), creditKey(wallet)], [JSON.stringify(claim), String(credits)])) as [number, unknown];
  return res[0] === 1 ? { outcome: "credited", balance: Number(res[1]) } : { outcome: "already", claim: parseClaim(res[1]) };
}
