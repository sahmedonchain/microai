// Client-side bookkeeping for credit purchases, so a payment is never lost
// when the confirmation is slow or the tab closes.
//
// Flow: the txHash is saved the moment the wallet returns it, then submitted to
// /api/credits/purchase until the server gives a definitive answer. The saved
// entry is removed only on success or a definitive rejection.

export interface PendingPurchase {
  txHash: string;
  queries: number;
  wallet: string; // lowercase
  timestamp: number; // ms since epoch, when the payment was sent
}

const STORAGE_KEY = "microai_pending_purchases";
// The server only verifies payments for 7 days; older entries can never succeed.
export const PENDING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function createPending(txHash: string, queries: number, wallet: string): PendingPurchase {
  return { txHash, queries, wallet: wallet.toLowerCase(), timestamp: Date.now() };
}

function readAll(): PendingPurchase[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is PendingPurchase =>
        p && typeof p.txHash === "string" && /^0x[0-9a-fA-F]{64}$/.test(p.txHash) && Number.isInteger(p.queries) && typeof p.wallet === "string" && typeof p.timestamp === "number"
    );
  } catch {
    return [];
  }
}

function writeAll(items: PendingPurchase[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable: the in-memory retry loop still runs */
  }
}

export function savePending(p: PendingPurchase) {
  const rest = readAll().filter((x) => x.txHash.toLowerCase() !== p.txHash.toLowerCase());
  writeAll([...rest, { ...p, wallet: p.wallet.toLowerCase() }]);
}

export function removePending(txHash: string) {
  writeAll(readAll().filter((x) => x.txHash.toLowerCase() !== txHash.toLowerCase()));
}

export function loadPending(wallet: string, now = Date.now()): PendingPurchase[] {
  const fresh = readAll().filter((p) => now - p.timestamp <= PENDING_MAX_AGE_MS);
  if (fresh.length !== readAll().length) writeAll(fresh);
  return fresh.filter((p) => p.wallet === wallet.toLowerCase());
}

export type SubmitOutcome =
  | { kind: "credited"; credits: number; added: number }
  | { kind: "already"; message: string } // this tx was already credited (e.g. by another tab)
  | { kind: "retry"; message: string } // not visible yet / node unreachable: ask again later
  | { kind: "held"; message: string } // not creditable automatically (made before recovery went live): keep it saved
  | { kind: "auth" } // no valid session
  | { kind: "rejected"; message: string }; // definitive: this payment will never be credited

// POST one purchase and classify the server's answer.
// `queries` is omitted for payment recovery: the server derives it from the amount paid.
export async function submitPurchase(p: { txHash: string; queries?: number }, fetchFn: typeof fetch = fetch): Promise<SubmitOutcome> {
  let res: Response;
  try {
    res = await fetchFn("/api/credits/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txHash: p.txHash, queries: p.queries }),
    });
  } catch {
    return { kind: "retry", message: "Network problem. Retrying…" };
  }
  let body: { error?: string; credits?: number; added?: number; reason?: string; retryable?: boolean } = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (res.ok) return { kind: "credited", credits: body.credits ?? 0, added: body.added ?? p.queries ?? 0 };
  if (res.status === 401) return { kind: "auth" };
  if (body.reason === "before_recovery") return { kind: "held", message: body.error ?? "This payment was made before our recovery system went live. Contact support." };
  if (body.reason === "already_used") return { kind: "already", message: body.error ?? "This payment has already been credited." };
  if (body.retryable || res.status === 429 || res.status >= 500) return { kind: "retry", message: body.error ?? "Verifying…" };
  return { kind: "rejected", message: body.error ?? "This payment could not be verified." };
}

export type ResolveResult =
  | { status: "credited"; credits: number }
  | { status: "already" }
  | { status: "rejected"; message: string }
  | { status: "held"; message: string } // kept saved; support has to handle it (or a later fix can credit it)
  | { status: "needs-session" } // kept saved; verification resumes after sign-in
  | { status: "gave-up" }; // kept saved; verification resumes on the next visit

interface ResolveDeps {
  submit?: (p: PendingPurchase) => Promise<SubmitOutcome>;
  // Try to (re)establish the signed-in session; resolves to whether it worked.
  ensureSession: () => Promise<boolean>;
  sleep?: (ms: number) => Promise<void>;
  onStatus?: (message: string) => void;
  maxAttempts?: number;
}

const BACKOFF_MS = [3000, 5000, 8000, 12000, 20000, 30000];

// Keeps submitting `p` until the server gives a definitive answer. The saved
// entry is cleared only for credited / already / rejected outcomes.
export async function resolvePurchase(p: PendingPurchase, deps: ResolveDeps): Promise<ResolveResult> {
  const submit = deps.submit ?? ((x: PendingPurchase) => submitPurchase(x));
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxAttempts = deps.maxAttempts ?? 30;
  let triedSession = false;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const outcome = await submit(p);
    switch (outcome.kind) {
      case "credited":
        removePending(p.txHash);
        return { status: "credited", credits: outcome.credits };
      case "already":
        removePending(p.txHash);
        return { status: "already" };
      case "held":
        return { status: "held", message: outcome.message }; // deliberately NOT removed from storage
      case "rejected":
        removePending(p.txHash);
        return { status: "rejected", message: outcome.message };
      case "auth":
        if (triedSession) return { status: "needs-session" };
        triedSession = true;
        deps.onStatus?.("Signing in to finish verifying your payment…");
        if (!(await deps.ensureSession())) return { status: "needs-session" };
        continue; // submit again straight away with the new session
      case "retry":
        deps.onStatus?.("Payment pending, verifying…");
        await sleep(BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]);
        break;
    }
  }
  return { status: "gave-up" };
}
