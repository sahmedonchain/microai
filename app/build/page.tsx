"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { WalletModal } from "@/app/components/WalletModal";

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

const MODES = [
  {
    id: "ARCHITECT",
    desc: "Design the system: components, data flow and diagram.",
    placeholder: "Design a pay-per-API-call service that settles in USDC on Arc...",
  },
  {
    id: "CONTRACT",
    desc: "Write a complete Solidity contract with events and tests list.",
    placeholder: "Write an ERC-8183 escrow contract that releases USDC when a job is delivered...",
  },
  {
    id: "USDC",
    desc: "Handle USDC and EURC transfers, approvals and 6-decimal math.",
    placeholder: "Show how to send 5 USDC from a script with viem, handling decimals correctly...",
  },
  {
    id: "CIRCLE",
    desc: "Pick and wire Circle products: CCTP, Gateway, wallets, App Kit.",
    placeholder: "Bridge USDC from Base to Arc using CCTP V2...",
  },
  {
    id: "DEPLOY",
    desc: "Config, script and checklist to deploy on Arc mainnet.",
    placeholder: "Give me a Foundry setup and deploy script for my contract on Arc mainnet...",
  },
  {
    id: "AUDIT",
    desc: "Review code for vulnerabilities, with severity and fixes.",
    placeholder: "Audit this contract for reentrancy and access control issues (paste code)...",
  },
  {
    id: "SIMULATE",
    desc: "Dry-run a scenario with eth_call or a fork test.",
    placeholder: "Simulate a 1000 USDC deposit and withdrawal against my vault before deploying...",
  },
  {
    id: "DEBUG",
    desc: "Find the root cause of an error or revert and fix it.",
    placeholder: "My transaction reverts with 'ERC20: insufficient allowance' (paste code and error)...",
  },
  {
    id: "MIGRATE",
    desc: "Port an existing dApp from another chain to Arc.",
    placeholder: "Migrate my Base USDC payment contract and frontend to Arc...",
  },
] as const;

type ModeId = (typeof MODES)[number]["id"];

interface Exchange {
  id: number;
  message: string;
  reply: string;
  mode: string;
  error?: boolean;
}

const MAX_SHOWN = 6;

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted" role="status">
      MicroAI is building
      <span className="inline-flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-pulse rounded-full bg-accent-text motion-reduce:animate-none"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </span>
      <span className="sr-only">...</span>
    </span>
  );
}

export default function BuildPage() {
  const [mode, setMode] = useState<ModeId | null>(null);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<Exchange[]>([]);
  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [credit, setCredit] = useState<number | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  const placeholder =
    MODES.find((m) => m.id === mode)?.placeholder ??
    "Describe what you want to build on Arc. Pick a mode above to focus the answer.";

  const fetchCredit = useCallback(async () => {
    try {
      const res = await fetch("/api/credits/balance");
      const data = await res.json();
      setAuthed(Boolean(data.authenticated));
      setCredit(data.authenticated ? data.credits : 0);
    } catch {
      setCredit(0);
    }
  }, []);

  // Restore a previously authorised wallet and its session without prompting.
  useEffect(() => {
    const eth = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
    if (!eth) return;
    (async () => {
      try {
        const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
        const address = accounts?.[0];
        if (!address) return;
        setWallet(address);
        await fetchCredit();
      } catch {
        /* user can connect manually */
      }
    })();
  }, [fetchCredit]);

  const establishSession = useCallback(async (address: string, prov: EthereumProvider) => {
    try {
      const nonceRes = await fetch(`/api/session/nonce?address=${address}`);
      if (!nonceRes.ok) return false;
      const { message } = await nonceRes.json();
      const signature = (await prov.request({
        method: "personal_sign",
        params: [message, address],
      })) as string;
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const handleWalletConnect = useCallback(
    async (address: string, prov: EthereumProvider) => {
      setWallet(address);
      setShowWalletModal(false);
      try {
        const res = await fetch("/api/session");
        const data = await res.json();
        const valid = data.authenticated && data.address?.toLowerCase() === address.toLowerCase();
        if (!valid) {
          if (data.authenticated) await fetch("/api/session", { method: "DELETE" });
          await establishSession(address, prov);
        }
      } catch {
        /* fetchCredit below reports unauthenticated */
      }
      await fetchCredit();
    },
    [establishSession, fetchCredit]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  const noCredits = authed && credit !== null && credit <= 0;
  const canSubmit = !!wallet && authed && !noCredits && !loading && input.trim().length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    const message = input.trim();
    setInput("");
    setLoading(true);

    // Prefix a chosen mode so the server's keyword detection follows the pill.
    const outgoing = mode ? `[${mode}] ${message}` : message;
    const past = history.slice(-MAX_SHOWN).flatMap((h) => [
      { role: "user", content: h.message },
      { role: "assistant", content: h.reply },
    ]);

    const id = nextId.current++;
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: outgoing, history: past }),
      });
      const data = await res.json();

      if (res.status === 401) {
        setAuthed(false);
        setHistory((h) => [...h, { id, message, mode: "ERROR", error: true, reply: "Your session expired. Connect your wallet to sign in again." }]);
      } else if (res.status === 402) {
        setCredit(0);
        setHistory((h) => [...h, { id, message, mode: "ERROR", error: true, reply: "You are out of credits. Buy credits to continue." }]);
      } else if (!res.ok) {
        setHistory((h) => [...h, { id, message, mode: "ERROR", error: true, reply: data.error || data.reply || "Request failed. Try again in a moment." }]);
      } else {
        if (typeof data.credits === "number") setCredit(data.credits);
        setHistory((h) => [...h, { id, message, mode: data.mode ?? "GENERAL", reply: data.reply }]);
      }
    } catch {
      setHistory((h) => [...h, { id, message, mode: "ERROR", error: true, reply: "Network error. Check your connection and try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const shown = history.slice(-MAX_SHOWN);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-space font-sans text-text">
      {showWalletModal && (
        <WalletModal onConnect={handleWalletConnect} onClose={() => setShowWalletModal(false)} />
      )}

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-8">
            <div className="max-w-3xl">
              <h1 className="text-2xl font-semibold leading-tight">AI Developer Copilot</h1>
              <p className="mt-2 max-w-xl text-sm text-muted">
                Describe your idea. MicroAI builds, integrates, tests and deploys it on Arc.
              </p>

              <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Copilot mode">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    title={m.desc}
                    aria-pressed={mode === m.id}
                    onClick={() => setMode(mode === m.id ? null : m.id)}
                    className={`rounded-full border px-3 py-1 font-mono text-xs transition ${
                      mode === m.id
                        ? "border-accent bg-accent-dim text-accent-text"
                        : "border-border text-muted hover:text-text"
                    }`}
                  >
                    {m.id}
                  </button>
                ))}
              </div>

              <div className="mt-8 space-y-8">
                {shown.length === 0 && !loading && (
                  <p className="text-sm text-muted">Send your first idea to begin.</p>
                )}

                {shown.map((h) => (
                  <section key={h.id} className="space-y-3">
                    <div className="rounded-lg border border-border bg-accent-dim px-4 py-3 text-sm whitespace-pre-wrap">
                      {h.message}
                    </div>
                    <div className="rounded-lg border border-border bg-surface px-4 py-4">
                      <span
                        className={`mb-3 inline-block rounded-full border px-2.5 py-0.5 font-mono text-xs ${
                          h.error
                            ? "border-danger/20 bg-danger/10 text-danger"
                            : "border-border bg-space text-accent-text"
                        }`}
                      >
                        {h.error ? "Error" : h.mode}
                      </span>
                      <div className="markdown text-sm leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{h.reply}</ReactMarkdown>
                      </div>
                    </div>
                  </section>
                ))}

                {loading && (
                  <div className="rounded-lg border border-border bg-surface px-4 py-4">
                    <LoadingDots />
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>
          </div>

          <div className="border-t border-border bg-space px-4 py-4 sm:px-8">
            <div className="max-w-3xl">
              {!wallet || !authed ? (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                  <p className="text-sm text-muted">Connect wallet to use Copilot</p>
                  <button
                    onClick={() => setShowWalletModal(true)}
                    className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:brightness-110"
                  >
                    Connect wallet
                  </button>
                </div>
              ) : noCredits ? (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                  <p className="text-sm text-muted">Buy credits to continue</p>
                  <Link
                    href="/chat"
                    className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:brightness-110"
                  >
                    Buy credits
                  </Link>
                </div>
              ) : (
                <>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        submit();
                      }
                    }}
                    maxLength={4000}
                    rows={6}
                    placeholder={placeholder}
                    className="w-full resize-y rounded-sm border border-border bg-surface px-4 py-3 text-base text-text placeholder:text-muted focus:border-accent focus:outline-none"
                  />
                  <div className="mt-3 flex items-center gap-4">
                    <button
                      onClick={submit}
                      disabled={!canSubmit}
                      className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Build with Copilot
                    </button>
                    <span className="font-mono text-xs text-muted">1 credit per request, Ctrl+Enter to send</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
