"use client";

import { useState, type ReactNode } from "react";
import type { DeliveryVerdict, DeliveryStatus } from "@/lib/verify/delivery";
import type { Finding, Severity, VerifyReport } from "@/lib/verify/types";
import { SEVERITY_LABEL, groupFindings, reportToText, sumCounts, verdict } from "@/lib/verify/ui";

// The result of one Verify check, shared by the live page and by shared report
// pages (/verify/r/<id>), so both read exactly the same.

export interface TxResult {
  network?: "mainnet" | "testnet";
  txHash: string;
  explorerUrl?: string;
  findings: Finding[];
  counts: Record<Severity, number>;
}

export interface VerifyResponse {
  url?: string;
  httpStatus?: number;
  report?: VerifyReport;
  transaction?: TxResult;
  delivery?: DeliveryVerdict;
}

const PILL: Record<Severity, string> = {
  error: "border-danger/20 bg-danger/10 text-danger",
  warning: "border-warning/25 bg-warning/10 text-warning",
  info: "border-secondary/30 bg-secondary-dim text-secondary-text",
  ok: "border-success/25 bg-success/10 text-success",
};
const MARK: Record<Severity, string> = { error: "✕", warning: "▲", info: "●", ok: "✓" };

const DELIVERY_LOOK: Record<DeliveryStatus, { label: string; tone: Severity }> = {
  delivered: { label: "Delivered", tone: "ok" },
  mismatch: { label: "Mismatch", tone: "error" },
  pending: { label: "Pending", tone: "warning" },
  failed: { label: "Failed", tone: "error" },
  unknown: { label: "Unknown", tone: "info" },
};

function DeliveryCard({ d }: { d: DeliveryVerdict }) {
  const look = DELIVERY_LOOK[d.status];
  return (
    <section className="mt-6" aria-labelledby="delivery-heading">
      <h2 id="delivery-heading" className="text-lg font-semibold">
        Delivery
      </h2>
      <div className="mt-2 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${PILL[look.tone]}`}>
            <span aria-hidden="true">{MARK[look.tone]}</span>
            {look.label}
          </span>
          <h3 className="min-w-0 text-base font-semibold">{d.title}</h3>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">{d.reason}</p>
        {d.evidence.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 font-mono text-xs text-muted">
            {d.evidence.map((e) => (
              <li key={e} className="break-all">{e}</li>
            ))}
          </ul>
        )}
        {d.fix && <p className="mt-2 text-sm"><span className="font-medium">Next step: </span>{d.fix}</p>}
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
          {d.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const BTN_SECONDARY =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm text-text hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function FindingCard({ f, level }: { f: Finding; level: "h3" | "h4" }) {
  const Heading = level;
  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${PILL[f.severity]}`}>
          <span aria-hidden="true">{MARK[f.severity]}</span>
          {SEVERITY_LABEL[f.severity]}
        </span>
        <Heading className="min-w-0 text-base font-semibold">{f.title}</Heading>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">{f.reason}</p>
      {f.evidence && (
        <p className="mt-2 break-all rounded-sm border border-border bg-space px-2.5 py-1.5 font-mono text-xs text-text">{f.evidence}</p>
      )}
      {f.fix && (
        <p className="mt-2 text-sm leading-relaxed">
          <span className="font-medium text-accent-text">How to fix: </span>
          <span className="text-text">{f.fix}</span>
        </p>
      )}
    </li>
  );
}

function Findings({ items, level = "h3" }: { items: Finding[]; level?: "h3" | "h4" }) {
  return (
    <ul className="mt-3 space-y-3">
      {items.map((f, i) => (
        <FindingCard key={`${f.id}-${i}`} f={f} level={level} />
      ))}
    </ul>
  );
}

function EndpointFindings({ findings }: { findings: Finding[] }) {
  const g = groupFindings(findings);
  return (
    <>
      <h2 className="mt-6 text-lg font-semibold">Endpoint</h2>
      {g.general.length > 0 && <Findings items={g.general} />}
      {g.arcOptions.map((o) => (
        <div key={o.index} className="mt-6">
          <h3 className="text-base font-semibold">
            Option {o.index + 1}: <span className="text-accent-text">{o.label}</span>
          </h3>
          <Findings items={o.findings} level="h4" />
        </div>
      ))}
      {g.otherNetworks.length > 0 && (
        <details className="mt-6 rounded-lg border border-border bg-surface p-4">
          <summary className="min-h-6 cursor-pointer text-sm font-medium">
            {g.otherNetworks.length} option{g.otherNetworks.length === 1 ? "" : "s"} on other networks, not verified
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-muted">MicroAI Verify checks Arc only. These networks were listed by the endpoint and were not checked.</p>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {g.otherNetworks.map((n) => (
              <li key={n.index} className="break-all">
                Option {n.index + 1}: {n.network}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

export function VerifyResult({ result, top }: { result: VerifyResponse; /** Shown under the verdict, e.g. the share link. */ top?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const counts = sumCounts(result.report?.counts, result.transaction?.counts);
  const v = verdict(counts);

  async function copyReport() {
    const text = reportToText({
      url: result.url,
      httpStatus: result.httpStatus,
      findings: result.report?.findings ?? [],
      txHash: result.transaction?.txHash,
      explorerUrl: result.transaction?.explorerUrl,
      txFindings: result.transaction?.findings,
      notChecked: result.report?.notChecked,
      delivery: result.delivery,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
      <section>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${PILL[v.tone === "ok" ? "ok" : v.tone]}`}>
              <span aria-hidden="true">{MARK[v.tone === "ok" ? "ok" : v.tone]}</span>
              {v.text}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted">
            {counts.error} error{counts.error === 1 ? "" : "s"}, {counts.warning} warning{counts.warning === 1 ? "" : "s"}, {counts.info} note{counts.info === 1 ? "" : "s"}, {counts.ok} passed
            {result.httpStatus !== undefined && <> · the endpoint answered HTTP {result.httpStatus}</>}
          </p>
          <button type="button" onClick={copyReport} className={`${BTN_SECONDARY} mt-3`}>
            {copied ? "Copied" : "Copy report as text"}
          </button>
          {copyFailed && <p role="alert" className="mt-2 text-sm text-danger">Could not copy. Select the report text and copy it by hand.</p>}
        </div>

        {top}

        {result.report && <EndpointFindings findings={result.report.findings} />}

        {result.transaction && (
          <>
            <h2 className="mt-6 text-lg font-semibold">Transaction</h2>
            <p className="mt-1 break-all font-mono text-xs text-muted">{result.transaction.txHash}</p>
            {result.transaction.explorerUrl && (
              <a href={result.transaction.explorerUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm text-accent-text hover:underline">
                View on Arc Explorer
              </a>
            )}
            <Findings items={result.transaction.findings} />
          </>
        )}

        {result.delivery && <DeliveryCard d={result.delivery} />}

        {result.report && (
          <details className="mt-6 rounded-lg border border-border bg-surface p-4">
            <summary className="min-h-6 cursor-pointer text-sm font-medium">What was and was not checked</summary>
            <h3 className="mt-3 text-sm font-semibold">Checked</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
              {result.report.checked.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <h3 className="mt-3 text-sm font-semibold">Not checked</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
              {result.report.notChecked.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </details>
        )}
      </section>
  );
}
