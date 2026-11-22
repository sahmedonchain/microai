"use client";
import { useCallback, useEffect, useState } from "react";
import { ARC_NETWORKS, USDC_ADDRESS, type ArcNetworkId } from "@/lib/arcConfig";
import { encodeErc20Transfer, walletErrorMessage } from "@/lib/verify/lab";
import { TabLink } from "@/app/components/tabs/TabNav";

// Refund & Disputes: a buyer opens a case for an x402 payment that was not
// delivered; the merchant approves or rejects; an approved refund is sent by the
// merchant from their own wallet, and MicroAI checks it on chain. MicroAI never
// holds a key and never sends money.

const FIELD =
  "w-full rounded-lg border border-border bg-space px-3.5 py-3 text-base text-text placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const BTN =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const BTN2 =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm text-text hover:bg-surface disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const STATUS_STYLE: Record<string, string> = {
  OPEN: "border-warning/25 bg-warning/10 text-warning",
  APPROVED: "border-accent/30 bg-accent/10 text-accent-text",
  REJECTED: "border-danger/20 bg-danger/10 text-danger",
  REFUNDED: "border-success/25 bg-success/10 text-success",
  PARTIALLY_REFUNDED: "border-success/25 bg-success/10 text-success",
};
const REASONS = [
  ["NO_RESPONSE", "No response"],
  ["WRONG_DATA", "Wrong data"],
  ["INCOMPLETE_RESULT", "Incomplete result"],
  ["WRONG_PRICE", "Wrong price"],
  ["UNAUTHORIZED_PURCHASE", "Unauthorized purchase"],
  ["OTHER", "Other"],
] as const;

interface Summary {
  id: string;
  status: string;
  reason: string;
  role: "buyer" | "merchant";
  network: ArcNetworkId;
  payer: string;
  payee: string;
  paidAmount: string;
  requestedAmount: string;
  approvedAmount: string | null;
  refundTxHash: string | null;
  createdAt: string;
}
interface Detail {
  case: Summary;
  buyerStatement: string;
  merchantResponse: { decision: string; message: string; at: string } | null;
  evidence: { bundle: Record<string, unknown>; bundleHash: string; attestation: { value: string } };
}

const usdc = (units: string) => {
  const s = units.padStart(7, "0");
  return `${s.slice(0, -6)}.${s.slice(-6)}`.replace(/\.?0+$/, "") || "0";
};
function toUnits(v: string): string | null {
  const m = /^(\d{1,24})(?:\.(\d{1,6}))?$/.exec(v.trim());
  if (!m) return null;
  const u = BigInt(m[1]) * BigInt(1_000_000) + BigInt((m[2] ?? "").padEnd(6, "0") || "0");
  return u > BigInt(0) ? u.toString() : null;
}
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data as T;
}

function Badge({ status }: { status: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? ""}`}>{status.replace("_", " ")}</span>;
}

export function RefundsClient({ embedded = false }: { embedded?: boolean } = {}) {
  const [me, setMe] = useState<string | null | undefined>(undefined);
  const [cases, setCases] = useState<Summary[]>([]);
  const [open, setOpen] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api<{ authenticated: boolean; address?: string }>("/api/session");
      setMe(s.authenticated ? s.address ?? null : null);
      if (s.authenticated) setCases((await api<{ cases: Summary[] }>("/api/refund-cases")).cases);
    } catch (e) {
      setMe(null);
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message || walletErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const show = (id: string) => run(async () => setOpen(await api<Detail>(`/api/refund-cases/${id}`)));
  const act = (id: string, action: string, body: unknown) =>
    run(async () => {
      setOpen(await api<Detail>(`/api/refund-cases/${id}/${action}`, body));
      await load();
    });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 text-text sm:px-5 sm:py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Refund &amp; Disputes</h1>
        <span className="inline-flex items-center rounded-full border border-success/25 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">Live on Arc Mainnet</span>
      </div>
      <p className="mt-3 max-w-prose leading-relaxed text-muted">
        An x402 payment cannot be undone. If a service took your payment and did not deliver, open a case here. MicroAI reads the payment from the chain, records the delivery check and builds an evidence bundle. The merchant approves or rejects, and sends any refund from their own wallet. MicroAI never holds keys or sends money, and it does not decide who is right.
      </p>

      {me === null && (
        <p className="mt-6 rounded-lg border border-border bg-surface p-4 text-sm text-muted">
          Sign in with your wallet first on the <TabLink href="/wallet" className="text-accent-text hover:underline">Wallet page</TabLink>, then come back.
        </p>
      )}
      {error && <p role="alert" className="mt-4 rounded-lg border border-danger/20 bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      {me && !open && (
        <>
          <div className="mt-6 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Your cases</h2>
            <button type="button" className={BTN} onClick={() => setCreating((v) => !v)}>{creating ? "Close form" : "Open a case"}</button>
          </div>
          {creating && <NewCase me={me} busy={busy} run={run} onDone={async () => { setCreating(false); await load(); }} />}
          <ul className="mt-4 space-y-3">
            {cases.length === 0 && <li className="text-sm text-muted">No cases yet.</li>}
            {cases.map((c) => (
              <li key={c.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge status={c.status} />
                  <span className="text-sm">{usdc(c.requestedAmount)} USDC · {c.reason.replace(/_/g, " ").toLowerCase()}</span>
                  <span className="ml-auto text-xs text-muted">You are the {c.role}</span>
                </div>
                <p className="mt-1 break-all font-mono text-xs text-muted">{short(c.payer)} paid {short(c.payee)} · {new Date(c.createdAt).toLocaleDateString()}</p>
                <button type="button" className={`${BTN2} mt-3`} onClick={() => show(c.id)} disabled={busy}>View case</button>
              </li>
            ))}
          </ul>
        </>
      )}

      {me && open && <CaseView d={open} busy={busy} onBack={() => setOpen(null)} act={act} run={run} reload={() => show(open.case.id)} />}
      {!embedded && <p className="sr-only">Refund and disputes</p>}
    </main>
  );
}

function NewCase({ busy, run, onDone }: { me: string; busy: boolean; run: (f: () => Promise<void>) => Promise<void>; onDone: () => Promise<void> }) {
  const [f, setF] = useState({ network: "mainnet", txHash: "", payTo: "", reason: "INCOMPLETE_RESULT", statement: "", amount: "", url: "", status: "", body: "", fields: "", contains: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const submit = () =>
    run(async () => {
      let deliveryCheckId: string | undefined;
      if (f.url.trim()) {
        const check = await api<{ check: { id: string } }>("/api/x402/delivery-check", {
          network: f.network, txHash: f.txHash.trim(), payTo: f.payTo.trim(), resourceUrl: f.url.trim(),
          ...(f.status.trim() ? { httpStatus: Number(f.status) } : {}),
          ...(f.body ? { responseBody: f.body } : {}),
          rule: {
            ...(f.fields.trim() ? { requiredJsonFields: f.fields.split(",").map((s) => s.trim()).filter(Boolean) } : {}),
            ...(f.contains.trim() ? { mustContain: f.contains.split(",").map((s) => s.trim()).filter(Boolean) } : {}),
          },
        });
        deliveryCheckId = check.check.id;
      }
      const requested = f.amount.trim() ? toUnits(f.amount) : undefined;
      if (f.amount.trim() && !requested) throw new Error("Amount must be a USDC number such as 0.25.");
      await api("/api/refund-cases", { network: f.network, txHash: f.txHash.trim(), payTo: f.payTo.trim(), reason: f.reason, statement: f.statement, deliveryCheckId, requestedAmount: requested });
      await onDone();
    });
  return (
    <section className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-4">
      <p className="text-sm text-muted">Use the wallet you are signed in with: it must be the one that paid. The delivery check is needed for the first three reasons.</p>
      <select aria-label="Network" className={FIELD} value={f.network} onChange={set("network")}>
        <option value="mainnet">Arc Mainnet</option>
        <option value="testnet">Arc Testnet</option>
      </select>
      <input aria-label="Payment transaction hash" className={`${FIELD} font-mono`} placeholder="Payment transaction hash 0x…" value={f.txHash} onChange={set("txHash")} />
      <input aria-label="Merchant wallet" className={`${FIELD} font-mono`} placeholder="Merchant (payee) address 0x…" value={f.payTo} onChange={set("payTo")} />
      <select aria-label="Reason" className={FIELD} value={f.reason} onChange={set("reason")}>
        {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <textarea aria-label="What went wrong" className={FIELD} rows={3} maxLength={1000} placeholder="What went wrong? (your statement, kept in the evidence)" value={f.statement} onChange={set("statement")} />
      <input aria-label="Amount to refund" className={FIELD} placeholder="Amount to ask back in USDC (empty = the whole payment)" value={f.amount} onChange={set("amount")} />
      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm">Delivery check (what the service answered)</summary>
        <div className="mt-3 space-y-3">
          <input aria-label="Resource URL" className={FIELD} placeholder="https:// URL you paid for" value={f.url} onChange={set("url")} />
          <input aria-label="HTTP status" className={FIELD} inputMode="numeric" placeholder="HTTP status you got (empty = no response)" value={f.status} onChange={set("status")} />
          <textarea aria-label="Response body" className={`${FIELD} font-mono`} rows={3} placeholder="Response body you got (only its hash is kept)" value={f.body} onChange={set("body")} />
          <input aria-label="Required JSON fields" className={FIELD} placeholder="Fields that must be present, e.g. data.items, data.total" value={f.fields} onChange={set("fields")} />
          <input aria-label="Must contain" className={FIELD} placeholder="Text the response must contain (comma separated)" value={f.contains} onChange={set("contains")} />
        </div>
      </details>
      <button type="button" className={BTN} onClick={submit} disabled={busy || !f.txHash || !f.payTo || f.statement.length < 10}>{busy ? "Working…" : "Open case"}</button>
    </section>
  );
}

function CaseView({ d, busy, onBack, act, run, reload }: { d: Detail; busy: boolean; onBack: () => void; act: (id: string, a: string, b: unknown) => Promise<void>; run: (f: () => Promise<void>) => Promise<void>; reload: () => Promise<void> }) {
  const c = d.case;
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState("");
  const [hash, setHash] = useState("");
  const net = ARC_NETWORKS[c.network];
  const merchant = c.role === "merchant";

  const sendRefund = () =>
    run(async () => {
      const eth = (window as unknown as { ethereum?: { request(a: { method: string; params?: unknown[] }): Promise<unknown> } }).ethereum;
      if (!eth) throw new Error("No wallet found. Install a browser wallet such as MetaMask.");
      try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: net.chainIdHex }] });
        const [from] = (await eth.request({ method: "eth_requestAccounts" })) as string[];
        if (from.toLowerCase() !== c.payee) throw new Error("Switch your wallet to the merchant account that was paid.");
        const tx = (await eth.request({ method: "eth_sendTransaction", params: [{ from, to: USDC_ADDRESS, data: encodeErc20Transfer(c.payer, c.approvedAmount ?? "0"), value: "0x0" }] })) as string;
        setHash(tx);
      } catch (e) {
        throw new Error((e as Error).message?.startsWith("Switch") ? (e as Error).message : walletErrorMessage(e));
      }
    });

  return (
    <section className="mt-6">
      <button type="button" className={BTN2} onClick={onBack}>Back to cases</button>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Badge status={c.status} />
        <h2 className="text-lg font-semibold">{usdc(c.requestedAmount)} USDC of {usdc(c.paidAmount)} paid</h2>
      </div>
      <dl className="mt-3 space-y-1 text-sm text-muted">
        <div>Buyer: <span className="break-all font-mono">{c.payer}</span></div>
        <div>Merchant: <span className="break-all font-mono">{c.payee}</span></div>
        <div>Reason: {c.reason.replace(/_/g, " ").toLowerCase()} · {net.name}</div>
        {c.approvedAmount && <div>Approved: {usdc(c.approvedAmount)} USDC</div>}
        {c.refundTxHash && (
          <div>Refund transaction: <a className="break-all font-mono text-accent-text hover:underline" href={`${net.explorerUrl}/tx/${c.refundTxHash}`} target="_blank" rel="noopener noreferrer">{c.refundTxHash}</a></div>
        )}
      </dl>
      <p className="mt-3 rounded-lg border border-border bg-surface p-3 text-sm">Buyer says: {d.buyerStatement}</p>
      {d.merchantResponse && <p className="mt-2 rounded-lg border border-border bg-surface p-3 text-sm">Merchant {d.merchantResponse.decision.toLowerCase()}: {d.merchantResponse.message || "no message"}</p>}

      {merchant && c.status === "OPEN" && (
        <div className="mt-4 space-y-3 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold">Your decision</h3>
          <input aria-label="Partial amount" className={FIELD} placeholder="Partial amount in USDC (empty = approve the full request)" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <textarea aria-label="Message" className={FIELD} rows={2} placeholder="Message or rejection reason" value={msg} onChange={(e) => setMsg(e.target.value)} />
          <div className="flex flex-wrap gap-3">
            <button type="button" className={BTN} disabled={busy} onClick={() => { const u = amount.trim() ? toUnits(amount) : undefined; if (amount.trim() && !u) return run(async () => { throw new Error("Amount must be a USDC number such as 0.25."); }); void act(c.id, "approve", { amount: u ?? undefined, message: msg || undefined }); }}>{amount.trim() ? "Approve partial refund" : "Approve full refund"}</button>
            <button type="button" className={BTN2} disabled={busy || msg.trim().length < 5} onClick={() => act(c.id, "reject", { reason: msg })}>Reject with reason</button>
          </div>
        </div>
      )}

      {merchant && c.status === "APPROVED" && (
        <div className="mt-4 space-y-3 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold">Send the refund from your wallet</h3>
          <p className="text-sm text-muted">You send {usdc(c.approvedAmount ?? "0")} USDC to {short(c.payer)} and approve it in your wallet. Then record the transaction so the case can close.</p>
          <button type="button" className={BTN} disabled={busy} onClick={sendRefund}>Send refund with my wallet</button>
          <input aria-label="Refund transaction hash" className={`${FIELD} font-mono`} placeholder="Refund transaction hash 0x…" value={hash} onChange={(e) => setHash(e.target.value)} />
          <button type="button" className={BTN2} disabled={busy || !/^0x[0-9a-fA-F]{64}$/.test(hash.trim())} onClick={() => act(c.id, "settle", { txHash: hash.trim() })}>Record refund transaction</button>
        </div>
      )}
      {!merchant && c.status === "APPROVED" && <p className="mt-4 text-sm text-muted">The merchant approved. Waiting for them to send the refund.</p>}

      <details className="mt-4 rounded-lg border border-border bg-surface p-4" open>
        <summary className="cursor-pointer text-sm font-semibold">Evidence bundle</summary>
        <p className="mt-2 break-all text-xs text-muted">SHA-256: <span className="font-mono">{d.evidence.bundleHash}</span><br />MicroAI attestation: <span className="font-mono">{d.evidence.attestation.value}</span></p>
        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-space p-3 text-xs">{JSON.stringify(d.evidence.bundle, null, 2)}</pre>
        <button type="button" className={`${BTN2} mt-3`} onClick={() => navigator.clipboard?.writeText(JSON.stringify(d.evidence, null, 2))}>Copy evidence</button>
      </details>
      <button type="button" className={`${BTN2} mt-4`} onClick={reload} disabled={busy}>Refresh</button>
    </section>
  );
}
