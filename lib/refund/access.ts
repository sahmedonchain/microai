import { apiErrors } from "@/lib/api";
import { isId, loadCase, lockCase, unlockCase } from "./store";
import { isParty } from "./view";
import type { RefundCase } from "./types";

/** A case the viewer is a party to. Strangers and missing ids both get 404. */
export async function loadForParty(id: string, addr: string): Promise<RefundCase> {
  const c = isId(id) ? await loadCase(id) : null;
  if (!c || !isParty(c, addr)) throw apiErrors.notFound("Refund case not found.");
  return c;
}

/**
 * Runs `fn` on the case under a short lock, for a decision only the merchant
 * (the wallet that was paid) may make, and only while the case is in `from`.
 */
export async function asMerchant(id: string, addr: string, from: RefundCase["status"], fn: (c: RefundCase) => Promise<RefundCase>): Promise<RefundCase> {
  const first = await loadForParty(id, addr);
  if (addr !== first.payment.payee) throw apiErrors.forbidden("Only the merchant (the wallet that was paid) can do this.");
  if (!(await lockCase(id))) throw apiErrors.badRequest("This case is being updated. Try again in a moment.");
  try {
    const c = await loadForParty(id, addr);
    if (c.status !== from) throw apiErrors.badRequest(`This case is ${c.status}, so it cannot be changed this way.`);
    return await fn(c);
  } finally {
    await unlockCase(id);
  }
}
