import type { Metadata } from "next";
import Link from "next/link";
import { LegalLinks } from "@/app/components/LegalLinks";

export const metadata: Metadata = {
  title: "Security — MicroAI",
  description: "How MicroAI protects sign-in, payments and credits, and what it does not guarantee.",
};

const CONTROLS = [
  ["Sign-in", "Sign-In with Ethereum (EIP-4361), bound to this site and to Arc Mainnet. Each sign-in nonce works once and expires after 5 minutes. The session cookie is httpOnly, SameSite=Lax and lasts 24 hours."],
  ["Payments", "The server reads the transaction receipt from the Arc RPC and checks that it is on Arc Mainnet, succeeded, and that every USDC Transfer log from your wallet to the MicroAI payment wallet matches a valid credit bundle. A transaction can be credited once."],
  ["Credits", "Credits never expire. If the AI fails to answer, the credit is refunded automatically."],
  ["Private keys", "MicroAI never asks for a private key or seed phrase. Wallet signing happens in your own wallet."],
  ["Abuse limits", "Per-IP and per-wallet rate limits on every AI route. Paid routes stop (503) if the limiter is unavailable."],
  ["Outbound requests", "Requests to other sites go through a guard that allows only https, blocks private and internal addresses, and enforces timeouts and size limits."],
  ["Browser protections", "HSTS, X-Frame-Options DENY, nosniff, a strict referrer policy, a permissions policy, same-site checks on every write request, and a Content-Security-Policy (currently in report-only mode)."],
  ["Emergency stop", "AI answers, new credit purchases and the Verify checker can each be paused by the operator within minutes."],
] as const;

const LIMITS = [
  "MicroAI is experimental and has not been independently audited. Do not rely on it for large amounts.",
  "AI answers can be wrong. Check addresses and parameters against docs.arc.io before sending funds.",
  "Copilot output is not compiled or tested. Review and test generated code yourself.",
  "Chain data comes from the Arc RPC and Arc Explorer API and is unavailable when they are down.",
  "MicroAI is an independent project, not an official Arc or Circle product.",
];

export default function SecurityPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 text-[var(--color-text)]">
      <Link href="/" className="text-sm text-[var(--color-accent-text)] hover:underline">
        ← MicroAI
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">Security</h1>
      <p className="mt-3 text-[var(--color-muted)]">
        What MicroAI does to protect you, and what it does not promise. Last reviewed October 2026.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Controls in place</h2>
      <dl className="mt-4 space-y-4">
        {CONTROLS.map(([title, text]) => (
          <div key={title} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <dt className="font-medium">{title}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">{text}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-10 text-xl font-semibold">Known limitations</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--color-muted)]">
        {LIMITS.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>

      <h2 className="mt-10 text-xl font-semibold">Report a vulnerability</h2>
      <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
        Please report privately using{" "}
        <a
          className="text-[var(--color-accent-text)] underline"
          href="https://github.com/sahmedonchain/microai/security/advisories/new"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub Private Vulnerability Reporting
        </a>
        . Do not open a public issue, and do not test against other users&apos; wallets or funds.
      </p>
      <LegalLinks className="mt-12 border-t border-[var(--color-border)] pt-6" />
    </main>
  );
}
