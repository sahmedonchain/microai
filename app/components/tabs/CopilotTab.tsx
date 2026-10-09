"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { TabLink as Link } from "@/app/components/tabs/TabNav";
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
  truncated?: boolean; // the model hit its length limit; the answer can be continued
  continueId?: string;
}

const MAX_SHOWN = 6;
const MAX_INPUT_HEIGHT = 200; // px; the box grows with the text up to ~8 lines, then scrolls

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

export function CopilotTab() {
  const [mode, setMode] = useState<ModeId | null>(null);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<Exchange[]>([]);
  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [credit, setCredit] = useState<number | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [continuing, setContinuing] = useState<number | null>(null);
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
    // Scroll the answer area itself: scrollIntoView would also scroll the
    // overflow-hidden ancestors and push the pinned input out of view.
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [history, loading, continuing]);

  // Auto-grow: compact by default, grows with the text up to
  // MAX_INPUT_HEIGHT, then scrolls inside. Clearing the input shrinks it back.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, [input]);

  const noCredits = authed && credit !== null && credit <= 0;
  const canSubmit = !!wallet && authed && !noCredits && !loading && input.trim().length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    const message = input.trim();
    setInput("");
    setLoading(true);

    const past = history.slice(-MAX_SHOWN).flatMap((h) => [
      { role: "user", content: h.message },
      { role: "assistant", content: h.reply },
    ]);

    const id = nextId.current++;
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, mode: mode ?? undefined, history: past }),
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
        setHistory((h) => [...h, { id, message, mode: data.mode ?? "GENERAL", reply: data.reply, truncated: data.truncated === true, continueId: data.continueId }]);
      }
    } catch {
      setHistory((h) => [...h, { id, message, mode: "ERROR", error: true, reply: "Network error. Check your connection and try again." }]);
    } finally {
      setLoading(false);
    }
  };

  // Continue a cut-off answer. The server does not charge a credit for this.
  const continueAnswer = async (exchange: Exchange) => {
    if (!exchange.continueId || continuing !== null) return;
    setContinuing(exchange.id);
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ continueId: exchange.continueId }),
      });
      const data = await res.json();
      if (res.ok) {
        if (typeof data.credits === "number") setCredit(data.credits);
        setHistory((h) =>
          h.map((x) =>
            x.id === exchange.id
              ? { ...x, reply: x.reply + data.reply, truncated: data.truncated === true, continueId: data.continueId }
              : x
          )
        );
      } else {
        // 502 keeps the same answer continuable (a fresh id); 410 means it expired.
        setHistory((h) =>
          h.map((x) =>
            x.id === exchange.id
              ? { ...x, continueId: data.continueId, truncated: Boolean(data.continueId), reply: x.reply + (data.continueId ? "" : `\n\n*${data.error || "Could not continue this answer."}*`) }
              : x
          )
        );
      }
    } catch {
      /* network error: keep the Continue button so the user can retry */
    } finally {
      setContinuing(null);
    }
  };

  const shown = history.slice(-MAX_SHOWN);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-space font-sans text-text">
      {showWalletModal && (
        <WalletModal onConnect={handleWalletConnect} onClose={() => setShowWalletModal(false)} />
      )}

      <div className="flex h-12 items-center justify-end gap-3 border-b border-border px-4 sm:px-6">
        {credit !== null && authed && (
          <span className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-muted">
            <span className="text-text">{credit}</span> credits
          </span>
        )}
        {wallet ? (
          <span className="rounded-sm border border-border bg-surface px-3 py-1 font-mono text-xs text-muted">
            {wallet.slice(0, 6)}...{wallet.slice(-4)}
          </span>
        ) : (
          <button
            onClick={() => setShowWalletModal(true)}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:brightness-110"
          >
            Connect wallet
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-8 sm:px-8">
            <div className="max-w-3xl">
              <h1 className="text-2xl font-semibold leading-tight">AI Developer Copilot</h1>
              <p className="mt-2 max-w-xl text-sm text-muted">
                Describe your idea. MicroAI writes the contracts, integration code, tests and deploy steps for Arc.
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
                      {h.truncated && h.continueId && (
                        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3">
                          <button
                            type="button"
                            onClick={() => continueAnswer(h)}
                            disabled={continuing !== null}
                            className="rounded-md border border-border px-3 py-1.5 text-sm text-text transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {continuing === h.id ? "Continuing..." : "Continue"}
                          </button>
                          <span className="text-xs text-muted">This answer hit the length limit. Continuing is free.</span>
                        </div>
                      )}
                    </div>
                  </section>
                ))}

                {loading && (
                  <div className="rounded-lg border border-border bg-surface px-4 py-4">
                    <LoadingDots />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-border bg-space px-4 py-3 sm:px-8">
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
                  <div className="relative rounded-lg border border-border bg-surface focus-within:border-accent">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          submit();
                        }
                      }}
                      maxLength={4000}
                      rows={1}
                      placeholder={placeholder}
                      aria-label="Describe what to build"
                      className="block min-h-[52px] w-full resize-none bg-transparent py-3.5 pl-4 pr-14 text-sm text-text placeholder:text-muted focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={submit}
                      disabled={!canSubmit}
                      aria-label={loading ? "Sending" : "Send"}
                      className="absolute bottom-2 right-2 flex size-9 items-center justify-center rounded-lg bg-accent text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {loading ? (
                        <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" aria-hidden="true" />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="mt-1.5 font-mono text-xs text-muted">1 credit per request, Ctrl+Enter to send</p>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
