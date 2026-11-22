import { randomBytes } from "node:crypto";
import { getRedis } from "@/lib/redis";
import type { DeliveryCheck, RefundCase } from "./types";

const TTL_SEC = 400 * 86_400;
const ID = /^[A-Za-z0-9_-]{22}$/;
export const isId = (id: unknown): id is string => typeof id === "string" && ID.test(id);
export const newId = () => randomBytes(16).toString("base64url");

const checkKey = (id: string) => `microai:rcheck:${id}`;
const caseKey = (id: string) => `microai:rcase:${id}`;
const walletKey = (addr: string) => `microai:rcases:${addr.toLowerCase()}`;
const txKey = (network: string, hash: string) => `microai:rcase-tx:${network}:${hash.toLowerCase()}`;
const refundTxKey = (network: string, hash: string) => `microai:rrefund-tx:${network}:${hash.toLowerCase()}`;
const lockKey = (id: string) => `microai:rcase-lock:${id}`;

function parse<T extends { v: 1 }>(raw: unknown): T | null {
  let v: unknown = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v && typeof v === "object" && (v as { v?: unknown }).v === 1 ? (v as T) : null;
}

export async function saveDeliveryCheck(c: DeliveryCheck): Promise<void> {
  await getRedis().set(checkKey(c.id), c, { ex: TTL_SEC });
}
export async function loadDeliveryCheck(id: string): Promise<DeliveryCheck | null> {
  return isId(id) ? parse<DeliveryCheck>(await getRedis().get(checkKey(id))) : null;
}

export async function loadCase(id: string): Promise<RefundCase | null> {
  return isId(id) ? parse<RefundCase>(await getRedis().get(caseKey(id))) : null;
}
export async function saveCase(c: RefundCase): Promise<void> {
  await getRedis().set(caseKey(c.id), c, { ex: TTL_SEC });
}

/** One case per payment transaction. Returns false when one already exists. */
export async function claimPayment(network: string, txHash: string, caseId: string): Promise<boolean> {
  return Boolean(await getRedis().set(txKey(network, txHash), caseId, { nx: true, ex: TTL_SEC }));
}
export async function releasePayment(network: string, txHash: string): Promise<void> {
  await getRedis().del(txKey(network, txHash));
}

/** A refund transaction can settle only one case. */
export async function claimRefundTx(network: string, txHash: string, caseId: string): Promise<boolean> {
  return Boolean(await getRedis().set(refundTxKey(network, txHash), caseId, { nx: true, ex: TTL_SEC }));
}
export async function releaseRefundTx(network: string, txHash: string): Promise<void> {
  await getRedis().del(refundTxKey(network, txHash));
}

/** Short lock so two decisions on one case cannot race. */
export async function lockCase(id: string): Promise<boolean> {
  return Boolean(await getRedis().set(lockKey(id), "1", { nx: true, ex: 30 }));
}
export async function unlockCase(id: string): Promise<void> {
  await getRedis().del(lockKey(id));
}

export async function indexCase(c: RefundCase): Promise<void> {
  const redis = getRedis();
  const score = Date.parse(c.createdAt);
  for (const addr of new Set([c.payment.payer, c.payment.payee])) {
    await redis.zadd(walletKey(addr), { score, member: c.id });
  }
}

/** Cases where the wallet is the buyer or the merchant, newest first, at most 100. */
export async function listCasesFor(addr: string): Promise<RefundCase[]> {
  const ids = ((await getRedis().zrange(walletKey(addr), 0, -1)) as string[]).filter(isId).reverse().slice(0, 100);
  const cases = await Promise.all(ids.map((id) => loadCase(id)));
  return cases.filter((c): c is RefundCase => c !== null);
}
