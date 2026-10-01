"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Compass,
  Gift,
  Hammer,
  MessageSquare,
  Paperclip,
  Search,
  Share2,
} from "lucide-react";
import { WalletModal } from "@/app/components/WalletModal";
import { LogoMark } from "@/app/components/landing/LandingNavbar";
import { PRICE_PER_QUERY, formatUsdc } from "@/lib/pricing";
import { timeAgo, truncateAddress } from "@/lib/format";

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

interface RecentTransaction {
  hash: string;
  from: string;
  amount: string;
  timestamp: string | null;
}

interface StatsPayload {
  totalQuestions: number;
  uniqueWallets: number;
  recentTransactions: RecentTransaction[];
}

const NAV_ITEMS = [
  { label: "Ask MicroAI", href: "/chat", icon: MessageSquare },
  { label: "Ecosystem", href: "/ecosystem", icon: Compass },
  { label: "Grants", href: "/grants", icon: Gift },
  { label: "Build status", href: "/build-status", icon: Hammer },
  { label: "Stats", href: "/stats", icon: BarChart3 },
];

const POPULAR_PROMPTS = [
  { name: "Developers", ask: "Why does my USDC transfer revert on Arc?" },
  { name: "Builders", ask: "Which Arc projects are hiring contributors?" },
  { name: "Fintech startups", ask: "How do I settle cross-border payouts with CCTP?" },
  { name: "Crypto natives", ask: "Which Arc protocols gained the most TVL this week?" },
];

const TOPICS = ["Arc", "Circle", "USDC", "CCTP", "Contracts"];
const DRAFT_KEY = "microai_chat_draft";

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();

  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);
  const [credit, setCredit] = useState<number | null>(null);

  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [input, setInput] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [context, setContext] = useState("");
  const [shared, setShared] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchCredit = useCallback(async () => {
    try {
      const res = await fetch("/api/credits/balance");
      const data = await res.json();
      setCredit(data.authenticated ? data.credits : null);
    } catch {
      setCredit(null);
    }
  }, []);

  const establishSession = useCallback(async (address: string, prov: EthereumProvider): Promise<boolean> => {
    try {
      const nonceRes = await fetch(`/api/session/nonce?address=${address}`);
      if (!nonceRes.ok) return false;
      const { message } = await nonceRes.json();
      const signature = (await prov.request({ method: "personal_sign", params: [message, address] })) as string;
      const sessionRes = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature }),
      });
      return sessionRes.ok;
    } catch {
      return false;
    }
  }, []);

  const restoreSession = useCallback(async (address: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/session");
      const data = await res.json();
      if (data.authenticated && data.address?.toLowerCase() === address.toLowerCase()) {
        await fetchCredit();
        return true;
      }
      if (data.authenticated) await fetch("/api/session", { method: "DELETE" });
    } catch { /* fall through */ }
    return false;
  }, [fetchCredit]);

  // Silently restore a previously-authorized wallet (eth_accounts never
  // prompts) so the sidebar shows the real balance without a reconnect.
  useEffect(() => {
    const eth = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
    if (!eth) return;
    (async () => {
      try {
        const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
        const address = accounts?.[0];
        if (!address) return;
        setWallet(address);
        await restoreSession(address);
      } catch { /* user can connect manually */ }
    })();
  }, [restoreSession]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setStats(data); })
      .catch(() => { /* stats row is optional enrichment */ });
    return () => { cancelled = true; };
  }, []);

  const handleConnect = async (address: string, prov: EthereumProvider) => {
    setWallet(address);
    setWalletModalOpen(false);
    const ok = await restoreSession(address);
    if (!ok) {
      const established = await establishSession(address, prov);
      if (established) await fetchCredit();
    }
  };

  const launchChat = (text: string) => {
    const draft = context ? `${text}\n\nContext:\n${context}` : text;
    try { localStorage.setItem(DRAFT_KEY, draft); } catch { /* best-effort */ }
    router.push("/chat");
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    if (!wallet) { setWalletModalOpen(true); return; }
    launchChat(text);
  };

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "https://microai-tan.vercel.app";
    try {
      const nav = navigator as Navigator & { share?: (data: { title?: string; url?: string }) => Promise<void> };
      if (nav.share) {
        await nav.share({ title: "MicroAI", url });
      } else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch { /* user cancelled share — not an error */ }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-space font-sans text-text">
      {/* SIDEBAR */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface">
        <Link href="/" className="flex items-center gap-3 border-b border-border px-5 py-5">
          <LogoMark className="size-8 shrink-0" />
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-text">MicroAI</span>
            <span className="text-xs text-muted">Arc intelligence</span>
          </span>
        </Link>

        <nav className="flex flex-col gap-1 px-3 py-4">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  active ? "bg-accent-dim text-accent-text" : "text-muted hover:bg-surface-raised hover:text-text"
                }`}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 overflow-y-auto border-t border-border px-5 py-4">
          <p className="text-xs text-muted">Recent</p>
          <div className="mt-3 flex flex-col gap-3">
            {stats?.recentTransactions.length ? (
              stats.recentTransactions.slice(0, 5).map((tx, i) => (
                <div key={tx.hash || i} className="flex items-center justify-between gap-2 font-mono text-xs text-muted">
                  <span>{truncateAddress(tx.from)}</span>
                  <span>{timeAgo(tx.timestamp)}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted">No queries yet.</p>
            )}
          </div>
        </div>

        <div className="border-t border-border p-4">
          {wallet ? (
            <div className="rounded-lg border border-border bg-space p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Credit balance</span>
                <span className="size-2 rounded-full bg-success" aria-hidden="true" />
              </div>
              <p className="mt-1 font-mono text-lg text-text">
                {credit === null ? "—" : credit} <span className="text-xs text-muted">credits</span>
              </p>
              <p className="mt-2 truncate font-mono text-xs text-muted">{truncateAddress(wallet)}</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setWalletModalOpen(true)}
              className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Connect wallet
            </button>
          )}
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-4">
          <span className="text-sm font-medium text-text">Home</span>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            <div className="relative hidden max-w-sm flex-1 sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                type="text"
                placeholder="Ask anything"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const text = (e.target as HTMLInputElement).value.trim();
                    if (text) { if (!wallet) setWalletModalOpen(true); else launchChat(text); }
                  }
                }}
                className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </div>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-success/20 bg-success/10 px-3 py-1.5 text-xs text-success">
              <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
              Arc Mainnet
            </span>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition hover:bg-surface-raised hover:text-text"
            >
              <Share2 className="size-3.5" aria-hidden="true" />
              {shared ? "Copied" : "Share"}
            </button>
          </div>
        </header>

        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-6 py-16"
        >
          <h1 className="text-center text-3xl font-semibold leading-[1.1] text-text sm:text-4xl">
            Build smarter on Arc.
          </h1>
          <p className="mt-4 max-w-[52ch] text-center text-base leading-relaxed text-muted">
            Ask anything about Arc, Circle, USDC and CCTP. Answers are backed by real on-chain data, paid for with
            prepaid credits.
          </p>

          <div className="mt-10 w-full rounded-lg border border-border bg-surface p-4">
            <textarea
              ref={inputRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="Ask anything about Arc, Circle, USDC, CCTP..."
              className="w-full resize-none bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
            />

            <AnimatePresence initial={false}>
              {contextOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <textarea
                    rows={2}
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Paste extra context (a contract address, error log, tx hash)..."
                    className="mt-2 w-full resize-none rounded-md border border-border bg-space p-2 font-mono text-xs text-text placeholder:text-muted focus:outline-none"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setContextOpen((v) => !v)}
                className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs transition ${
                  contextOpen ? "text-accent-text" : "text-muted hover:text-text"
                }`}
              >
                <Paperclip className="size-3.5" aria-hidden="true" />
                Add context
              </button>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted">${formatUsdc(PRICE_PER_QUERY)} / query</span>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {wallet ? "Ask MicroAI" : "Connect to ask"}
                </button>
              </div>
            </div>
          </div>

          <section className="mt-16 w-full" aria-labelledby="popular-heading">
            <h2 id="popular-heading" className="text-sm font-medium text-muted">
              Popular with builders
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {POPULAR_PROMPTS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => { setInput(p.ask); inputRef.current?.focus(); }}
                  className="rounded-lg border border-border bg-surface p-4 text-left transition hover:border-accent/40 hover:bg-surface-raised"
                >
                  <p className="text-xs text-secondary-text">{p.name}</p>
                  <p className="mt-2 text-sm leading-snug text-text">{p.ask}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-16 flex w-full flex-col items-center gap-6 border-t border-border pt-10">
            <div className="flex flex-wrap items-center justify-center gap-8">
              <div className="text-center">
                <p className="font-mono text-2xl text-text">{stats ? stats.totalQuestions.toLocaleString() : "—"}</p>
                <p className="mt-1 text-xs text-muted">Questions answered</p>
              </div>
              <div className="text-center">
                <p className="font-mono text-2xl text-text">{stats ? stats.uniqueWallets.toLocaleString() : "—"}</p>
                <p className="mt-1 text-xs text-muted">Wallets served</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {TOPICS.map((t) => (
                <span key={t} className="rounded-full border border-border px-3 py-1 text-xs text-muted">
                  {t}
                </span>
              ))}
            </div>
          </section>
        </motion.main>
      </div>

      <AnimatePresence>
        {walletModalOpen && <WalletModal onConnect={handleConnect} onClose={() => setWalletModalOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
