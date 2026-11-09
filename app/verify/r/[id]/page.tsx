import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VerifyResult } from "@/app/components/VerifyResult";
import { isReportId, loadReport } from "@/lib/verify/reportStore";

// A shared MicroAI Verify report. Reached only by its unguessable link, never
// indexed, never cached. See lib/verify/reportStore.ts for the safety rules.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shared Verify report — MicroAI",
  description: "A MicroAI Verify report shared by link.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const fmt = (iso: string) => new Date(iso).toISOString().slice(0, 10);

export default async function SharedReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isReportId(id)) notFound();
  const report = await loadReport(id);
  if (!report) notFound();

  const { result } = report;
  // The endpoint is shown as text, never as a link: it was typed by whoever made the report.
  const rerun = result.url && /^https:\/\//i.test(result.url) ? `/verify?url=${encodeURIComponent(result.url)}&run=1` : undefined;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 text-text sm:px-5 sm:py-12">
      <Link href="/verify" className="text-sm text-accent-text hover:underline">
        ← MicroAI Verify
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Shared Verify report</h1>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
        Created by MicroAI Verify on {fmt(report.createdAt)}. This link works until {fmt(report.expiresAt)}. It shows what the check found at that time, not what is true now.
      </p>
      {result.url && (
        <p className="mt-3 break-all rounded-sm border border-border bg-space px-2.5 py-1.5 font-mono text-xs text-text" data-testid="shared-url">
          {result.url}
        </p>
      )}
      <div className="mt-6">
        <VerifyResult
          result={result}
          top={
            <p className="mt-3 rounded-lg border border-warning/25 bg-warning/10 px-4 py-3 text-sm leading-relaxed text-text">
              Parts of this report quote text returned by the endpoint that was checked. Treat that text as untrusted. MicroAI is experimental, not audited, and a clean report is not a guarantee.
            </p>
          }
        />
      </div>
      {rerun && (
        <p className="mt-6">
          <Link href={rerun} className="text-sm text-accent-text hover:underline">
            Run this check again
          </Link>
        </p>
      )}
      <p className="mt-10 text-xs text-muted">
        MicroAI is an independent project, not an official Arc or Circle product. <Link href="/security" className="text-accent-text hover:underline">Security</Link>
      </p>
    </main>
  );
}
