"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { TabLink as Link } from "@/app/components/tabs/TabNav";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BarChart3,
  Bell,
  BookOpen,
  Bug,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Coins,
  Compass,
  Copy,
  ExternalLink,
  FileText,
  Gift,
  Hammer,
  Link2,
  MessageSquare,
  Newspaper,
  Paperclip,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Wallet,
  Wrench,
} from "lucide-react";
import { WalletModal } from "@/app/components/WalletModal";
import { LogoMark } from "@/app/components/landing/LandingNavbar";
import { PRICE_PER_QUERY, MIN_QUERIES, MAX_QUERIES, formatUsdc } from "@/lib/pricing";
import { timeAgo, truncateAddress } from "@/lib/format";
import type { NewsItem } from "@/lib/news";

const ARC_CHAIN_ID = "0x13b2";
const USDC_CONTRACT = "0x3600000000000000000000000000000000000000";
const RECEIVER_ADDRESS = "0x78C144A76614A8674285129810555C8bCa78f044";
const TRANSFER_ABI = "0xa9059cbb"; // transfer(address,uint256)
const PRESET_QUERIES = [5, 10, 20, 50];
const LOW_CREDIT_THRESHOLD = 3;

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

interface Message {
  role: "user" | "assistant";
  text: string;
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
  { label: "Chat", href: "/", icon: MessageSquare },
  { label: "Ecosystem", href: "/ecosystem", icon: Compass },
  { label: "Grants", href: "/grants", icon: Gift },
  { label: "Build status", href: "/build-status", icon: Hammer },
  { label: "Stats", href: "/stats", icon: BarChart3 },
  { label: "News", href: "/news", icon: Newspaper },
  { label: "Copilot", href: "/build", icon: Code2 },
  { label: "Wallet", href: "/wallet", icon: Wallet },
  { label: "Debug", href: "/debug", icon: Bug },
  { label: "Credits", href: "/credits", icon: Coins },
];

const NEW_FEATURES = [
  { title: "AI Developer Copilot", href: "/build", icon: Code2, desc: "Describe your idea. MicroAI builds, integrates, tests and deploys it on Arc." },
  { title: "Wallet Intelligence", href: "/wallet", icon: Wallet, desc: "AI-powered wallet analysis, risk signals, and portfolio overview." },
  { title: "Transaction Debugger", href: "/debug", icon: Bug, desc: "Paste any TX hash. Get full AI breakdown, function decode, and fix suggestions." },
  { title: "Credits & Payments", href: "/credits", icon: Coins, desc: "View your USDC payment history and credit balance." },
];

const DEV_RESOURCES = [
  { label: "Arc Developer Docs", href: "https://arc.io/docs" },
  { label: "Circle Documentation", href: "https://circle.com/docs" },
  { label: "USDC Resources", href: "https://www.circle.com/usdc" },
];

const CATEGORY_PILLS = [
  { label: "Smart Contracts", icon: Code2, prompt: "Show me a sample Solidity contract for USDC transfers on Arc." },
  { label: "USDC & Payments", icon: Coins, prompt: "How do I set up cross-border payments with CCTP?" },
  { label: "Circle APIs", icon: Link2, prompt: "How can I integrate Circle APIs into my dApp?" },
  { label: "Arc Ecosystem", icon: Compass, prompt: "What are the latest updates on Arc's developer tools?" },
  { label: "Developer Tools", icon: Wrench, prompt: "What developer tools are available for building on Arc?" },
];

const POPULAR_PROMPTS = [
  { icon: Code2, title: "How do I set up cross-border payments with CCTP?", desc: "Step-by-step guide to integrate CCTP for cross-chain transfers." },
  { icon: FileText, title: "Show me a sample contract for USDC transfers.", desc: "Get a production-ready Solidity contract with explanations." },
  { icon: Bell, title: "What are the latest updates on Arc's developer tools?", desc: "New features, SDKs, and changelogs." },
  { icon: Link2, title: "How can I integrate Circle APIs into my dApp?", desc: "Authentication, transfers, and webhook setup." },
];

function avatarGradient(address: string): string {
  const h1 = parseInt(address.slice(2, 8), 16) % 360;
  const h2 = parseInt(address.slice(8, 14), 16) % 360;
  return `linear-gradient(135deg, hsl(${h1},65%,58%), hsl(${h2},65%,42%))`;
}

async function waitForReceipt(
  provider: EthereumProvider,
  txHash: string,
  timeoutMs = 20000,
  intervalMs = 1000
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const receipt = (await provider.request({
        method: "eth_getTransactionReceipt",
        params: [txHash],
      })) as { status?: string } | null;
      if (receipt) return receipt.status === "0x1";
    } catch { /* transient RPC hiccup — keep polling */ }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

const SIDEBAR_COLLAPSED_KEY = "microai_sidebar_collapsed";

export function HomeTab() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch { /* localStorage unavailable — keep default expanded */ }
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);
  const [provider, setProvider] = useState<EthereumProvider | null>(null);
  const [credit, setCredit] = useState<number | null>(null);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const walletMenuRef = useRef<HTMLDivElement>(null);

  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [buying, setBuying] = useState(false);
  const [customQueries, setCustomQueries] = useState("");
  const [buyError, setBuyError] = useState("");
  const [txStep, setTxStep] = useState("");

  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [context, setContext] = useState("");
  const [activeCategory, setActiveCategory] = useState("Arc Ecosystem");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchCredit = useCallback(async () => {
    try {
      const res = await fetch("/api/credits/balance");
      const data = await res.json();
      setCredit(data.authenticated ? data.credits : 0);
    } catch {
      setCredit(0);
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
  // prompts) so the page shows the real balance without a reconnect. If
  // the session cookie was cleared (e.g. "Clear site data") but the
  // wallet extension still remembers the connection, restoreSession
  // fails — fall back to establishSession (same as handleConnect) so the
  // real Redis-backed balance loads instead of getting stuck at 0.
  useEffect(() => {
    const eth = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
    if (!eth) return;
    (async () => {
      try {
        const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
        const address = accounts?.[0];
        if (!address) return;
        setWallet(address);
        setProvider(eth);
        const ok = await restoreSession(address);
        if (!ok) {
          const established = await establishSession(address, eth);
          if (established) await fetchCredit();
          else setCredit(0);
        }
      } catch { /* user can connect manually */ }
    })();
  }, [restoreSession, establishSession, fetchCredit]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setStats(data); })
      .catch(() => { /* stats row is optional enrichment */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/news")
      .then((res) => res.json())
      .then((data) => { if (!cancelled && Array.isArray(data.items)) setNewsItems(data.items.slice(0, 4)); })
      .catch(() => { /* news teaser is optional enrichment */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (walletMenuRef.current && !walletMenuRef.current.contains(e.target as Node)) setWalletMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleConnect = async (address: string, prov: EthereumProvider) => {
    setWallet(address);
    setProvider(prov);
    setWalletModalOpen(false);
    const ok = await restoreSession(address);
    if (!ok) {
      const established = await establishSession(address, prov);
      if (established) await fetchCredit();
      else setCredit(0);
    }
  };

  const disconnect = () => {
    setWallet(null);
    setProvider(null);
    setCredit(null);
    setWalletMenuOpen(false);
    fetch("/api/session", { method: "DELETE" }).catch(() => { /* silent */ });
  };

  const copyAddress = async () => {
    if (!wallet) return;
    try {
      await navigator.clipboard.writeText(wallet);
      setAddressCopied(true);
      setTimeout(() => setAddressCopied(false), 2000);
    } catch { /* silent */ }
  };

  const buyCredits = async (queries: number) => {
    if (!wallet || !provider) return;
    setBuying(true);
    setBuyError("");
    setTxStep(`Buying ${queries} ${queries === 1 ? "query" : "queries"}...`);
    try {
      const chainId = (await provider.request({ method: "eth_chainId" })) as string;
      if (chainId !== ARC_CHAIN_ID) {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_CHAIN_ID }] });
      }
      const amount = queries * PRICE_PER_QUERY;
      const amountHex = amount.toString(16).padStart(64, "0");
      const recipientHex = RECEIVER_ADDRESS.slice(2).padStart(64, "0");
      const transferData = TRANSFER_ABI + recipientHex + amountHex;
      const txHash = (await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: wallet, to: USDC_CONTRACT, data: transferData, gas: "0x186A0" }],
      })) as string;

      setTxStep("Confirming transaction...");
      const mined = await waitForReceipt(provider, txHash);
      if (!mined) throw new Error("Transaction did not confirm in time. Please try again.");

      setTxStep("Crediting your account...");
      const doPurchase = () => fetch("/api/credits/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, queries }),
      });
      let res = await doPurchase();
      if (res.status === 401) {
        const ok = await establishSession(wallet, provider);
        if (!ok) throw new Error("Session expired. Please reconnect your wallet.");
        res = await doPurchase();
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purchase failed.");

      setCredit(data.credits);
      setBuyModalOpen(false);
      setCustomQueries("");
    } catch (err: unknown) {
      const error = err as { code?: number; message?: string };
      if (error?.code !== 4001) setBuyError(error?.message || "Purchase failed. Please try again.");
    } finally {
      setBuying(false);
      setTxStep("");
    }
  };

  const buyCustomCredits = () => {
    const queries = Number(customQueries);
    if (!Number.isInteger(queries) || queries < MIN_QUERIES || queries > MAX_QUERIES) {
      setBuyError(`Enter a whole number between ${MIN_QUERIES} and ${MAX_QUERIES}.`);
      return;
    }
    buyCredits(queries);
  };

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading || !wallet || !provider) return;
    if (!credit || credit <= 0) { setBuyModalOpen(true); return; }

    const fullMsg = context ? `${msg}\n\nContext:\n${context}` : msg;
    setInput("");
    setContext("");
    setContextOpen(false);
    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setLoading(true);

    try {
      const body = JSON.stringify({
        message: fullMsg,
        history: messages.slice(-8).map((m) => ({ role: m.role, content: m.text })),
      });
      const doFetch = () => fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      let res = await doFetch();
      if (res.status === 401) {
        const ok = await establishSession(wallet, provider);
        if (!ok) throw new Error("Session expired. Please reconnect your wallet.");
        res = await doFetch();
      }
      const data = await res.json();
      if (res.status === 402 || data.error === "no_credits") {
        setCredit(0);
        setBuyModalOpen(true);
        setMessages((prev) => [...prev, { role: "assistant", text: "You're out of credit. Buy more queries to keep going." }]);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setMessages((prev) => [...prev, { role: "assistant", text: data.reply || "Could not generate a response." }]);
      if (typeof data.credits === "number") setCredit(data.credits);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setMessages((prev) => [...prev, { role: "assistant", text: `Error: ${error?.message || "Something went wrong. Try again."}` }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const askLabel = !wallet
    ? "Connect wallet"
    : credit === null
    ? "Restoring session..."
    : !credit
    ? "Buy credits"
    : "Ask MicroAI";
  const handleAsk = () => {
    if (!wallet) { setWalletModalOpen(true); return; }
    if (credit === null) return; // session still resolving — don't nudge toward a purchase yet
    if (!credit) { setBuyModalOpen(true); return; }
    sendMessage();
  };

  const fillPrompt = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const myActivity = wallet
    ? (stats?.recentTransactions ?? []).filter((tx) => tx.from.toLowerCase() === wallet.toLowerCase())
    : [];

  return (
    <div className="relative flex h-[calc(100vh-4rem)] overflow-hidden bg-space font-sans text-text">
      {/* LEFT SIDEBAR */}
      {sidebarCollapsed && (
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Expand sidebar"
          className="absolute left-4 top-4 z-30 flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-muted shadow-lg transition hover:text-text"
        >
          <PanelLeftOpen className="size-4" aria-hidden="true" />
        </button>
      )}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 0 : 256 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`flex shrink-0 overflow-hidden bg-surface ${sidebarCollapsed ? "" : "border-r border-border"}`}
      >
        <div className="flex w-64 shrink-0 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-5">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <LogoMark className="size-8 shrink-0" />
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-text">MicroAI</span>
              <span className="text-xs text-muted">Build on Arc</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
            className="shrink-0 rounded-md p-1.5 text-muted transition hover:bg-surface-raised hover:text-text"
          >
            <PanelLeftClose className="size-4" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 px-3 py-4">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = href === "/";
            return (
              <Link
                key={label}
                href={href}
                onClick={() => { if (href === "/") inputRef.current?.focus(); }}
                className={`flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm transition ${
                  active
                    ? "border-accent bg-accent-dim text-accent-text"
                    : "border-transparent text-muted hover:bg-surface-raised hover:text-text"
                }`}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border px-5 pt-4">
          <p className="text-xs font-medium tracking-wide text-muted">Developer resources</p>
          <div className="mt-3 flex flex-col gap-0.5">
            {DEV_RESOURCES.map((r) => (
              <a
                key={r.label}
                href={r.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2 rounded-md px-1 py-2 text-sm text-muted transition hover:text-text"
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="size-3.5 text-muted" aria-hidden="true" />
                  {r.label}
                </span>
                <ExternalLink className="size-3 text-muted" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>

        <div className="flex-1" />

        <div className="m-4 rounded-lg border border-accent/20 bg-accent-dim p-4">
          <LogoMark className="size-6" />
          <p className="mt-2 text-sm font-semibold text-text">Explore. Build. Earn.</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            The best place for builders, founders and crypto natives on Arc.
          </p>
          <Link href="/ecosystem" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent-text hover:underline">
            Learn more <ChevronRight className="size-3" aria-hidden="true" />
          </Link>
        </div>
        </div>
      </motion.aside>

      {/* CENTER + RIGHT */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* TOP BAR */}
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <LogoMark className="size-7 shrink-0" />
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-text">MicroAI</span>
              <span className="text-xs text-muted">AI assistant for the Arc ecosystem</span>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent-dim px-3 py-1.5 text-xs text-accent-text">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-text opacity-75" aria-hidden="true" />
                <span className="relative inline-flex size-1.5 rounded-full bg-accent-text" aria-hidden="true" />
              </span>
              Arc Mainnet
            </span>

            {wallet ? (
              <div ref={walletMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setWalletMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-2.5 transition hover:bg-surface-raised"
                >
                  <span className="size-6 rounded-full" style={{ background: avatarGradient(wallet) }} aria-hidden="true" />
                  <span className="font-mono text-xs text-text">{truncateAddress(wallet)}</span>
                  <ChevronDown className={`size-3.5 text-muted transition ${walletMenuOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                <AnimatePresence>
                  {walletMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-full mt-2 w-44 rounded-lg border border-border bg-surface-raised p-1 shadow-lg"
                    >
                      <button
                        onClick={copyAddress}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-text transition hover:bg-surface"
                      >
                        {addressCopied ? <Check className="size-3.5 text-success" aria-hidden="true" /> : <Copy className="size-3.5 text-muted" aria-hidden="true" />}
                        {addressCopied ? "Copied" : "Copy address"}
                      </button>
                      <button
                        onClick={disconnect}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-danger transition hover:bg-surface"
                      >
                        Disconnect
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setWalletModalOpen(true)}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Connect wallet
              </button>
            )}
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* CENTER COLUMN */}
          <motion.main
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col items-center overflow-y-auto px-6 py-14"
          >
            <LogoMark className="size-12" />
            <h1 className="mt-5 text-center text-3xl font-semibold leading-[1.1] text-text sm:text-4xl">
              Ask, Build, Ship on <span className="text-accent-text">Arc</span>
            </h1>
            <p className="mt-4 max-w-[52ch] text-center text-base leading-relaxed text-muted">
              Get fast, accurate answers about Arc, Circle, USDC, and on-chain development.
              <br />
              From smart contracts to integrations, I&apos;m here to help you build.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {CATEGORY_PILLS.map(({ label, icon: Icon, prompt }) => {
                const active = activeCategory === label;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => { setActiveCategory(label); fillPrompt(prompt); }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                      active
                        ? "border-accent/40 bg-accent-dim text-accent-text"
                        : "border-border text-muted hover:border-accent/25 hover:text-text"
                    }`}
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>

            {!wallet && (
              <div className="mt-6 flex w-full flex-col items-center gap-3 rounded-lg border border-border bg-surface p-5 sm:flex-row sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-dim text-accent-text">
                    <MessageSquare className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text">Connect your wallet to start chatting</p>
                    <p className="text-xs text-muted">Each message is paid for with prepaid credits (USDC).</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setWalletModalOpen(true)}
                  className="w-full shrink-0 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110 sm:w-auto"
                >
                  Connect wallet
                </button>
              </div>
            )}

            {messages.length > 0 && (
              <div className="mt-8 flex w-full flex-col gap-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" ? (
                      <div className="max-w-[85%] rounded-xl rounded-bl-sm border border-border bg-surface p-3 text-sm leading-relaxed text-text">
                        <div className="mb-1 font-mono text-xs text-muted">MicroAI</div>
                        <div className="markdown">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-[85%] rounded-xl rounded-br-sm bg-accent-dim px-4 py-2.5 text-sm text-text">
                        {msg.text}
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <div className="rounded-xl rounded-bl-sm border border-border bg-surface px-4 py-3 text-xs text-muted">
                      {txStep || "Thinking..."}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}

            {messages.length === 0 && (
              <section className="mt-10 w-full" aria-labelledby="popular-heading">
                <div className="flex items-center justify-between">
                  <h2 id="popular-heading" className="text-sm font-medium text-text">Popular questions</h2>
                  <Link href="/ecosystem" className="text-xs font-medium text-accent-text hover:underline">
                    View all
                  </Link>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {POPULAR_PROMPTS.map(({ icon: Icon, title, desc }) => (
                    <button
                      key={title}
                      type="button"
                      onClick={() => fillPrompt(title)}
                      className="group flex items-start gap-3 rounded-lg border border-border bg-surface p-4 text-left transition hover:border-accent/40 hover:bg-surface-raised"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-dim text-accent-text">
                        <Icon className="size-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug text-text">{title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted">{desc}</p>
                      </div>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted transition group-hover:text-accent-text" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {messages.length === 0 && (
              <section className="mt-6 w-full" aria-labelledby="new-features-heading">
                <h2 id="new-features-heading" className="text-sm font-medium text-text">What&apos;s new</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {NEW_FEATURES.map(({ title, href, icon: Icon, desc }) => (
                    <Link
                      key={href}
                      href={href}
                      className="group flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 no-underline transition hover:border-accent/40 hover:bg-surface-raised"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-dim text-accent-text">
                          <Icon className="size-4" aria-hidden="true" />
                        </div>
                        <p className="text-sm font-medium text-text">{title}</p>
                      </div>
                      <p className="flex-1 text-xs leading-relaxed text-muted">{desc}</p>
                      <span className="text-xs font-medium text-accent-text">Open →</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {messages.length === 0 && newsItems.length > 0 && (
              <section className="mt-6 w-full" aria-labelledby="news-heading">
                <div className="flex items-center justify-between">
                  <h2 id="news-heading" className="text-sm font-medium text-text">Latest on Arc</h2>
                  <Link href="/news" className="text-xs font-medium text-accent-text hover:underline">
                    All news
                  </Link>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  {newsItems.map((item) => (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left no-underline transition hover:border-accent/40 hover:bg-surface-raised"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text">{item.title}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {item.source}{item.publishedAt ? ` · ${timeAgo(item.publishedAt)}` : ""}
                        </p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </section>
            )}

            <div className="mt-auto w-full pt-10">
              <div className="w-full rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => setContextOpen((v) => !v)}
                    aria-label="Add context"
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md transition ${
                      contextOpen ? "bg-accent-dim text-accent-text" : "text-muted hover:text-text"
                    }`}
                  >
                    <Paperclip className="size-4" aria-hidden="true" />
                  </button>
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); }
                    }}
                    placeholder="Ask anything about Arc, Circle, USDC, CCTP..."
                    className="min-h-[28px] w-full resize-none bg-transparent pt-0.5 text-sm text-text placeholder:text-muted focus:outline-none"
                  />
                </div>

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
                  <span className="font-mono text-xs text-muted">${formatUsdc(PRICE_PER_QUERY)} / message</span>
                  <button
                    type="button"
                    onClick={handleAsk}
                    disabled={loading || (!!wallet && !!credit && !input.trim())}
                    className="flex size-9 items-center justify-center rounded-lg bg-accent text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={askLabel}
                  >
                    {loading ? (
                      <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              {!wallet && <p className="mt-2 text-center text-xs text-muted">{askLabel} to send a message.</p>}
              {wallet && credit === null && (
                <p className="mt-2 text-center text-xs text-muted">Restoring your session...</p>
              )}
            </div>
          </motion.main>

          {/* RIGHT SIDEBAR — only when connected */}
          {wallet && (
            <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-text">Wallet</p>
                <span className="rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[11px] text-success">Connected</span>
              </div>
              <div className="mt-3 flex items-center gap-2.5">
                <span className="size-8 rounded-full" style={{ background: avatarGradient(wallet) }} aria-hidden="true" />
                <span className="font-mono text-sm text-text">{truncateAddress(wallet)}</span>
                <button onClick={copyAddress} aria-label="Copy address" className="text-muted transition hover:text-text">
                  {addressCopied ? <Check className="size-3.5 text-success" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                </button>
              </div>

              <div className="mt-4 rounded-lg border border-border bg-space p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Credits</span>
                  {credit !== null && credit <= LOW_CREDIT_THRESHOLD && (
                    <button onClick={() => setBuyModalOpen(true)} className="text-xs font-medium text-accent-text hover:underline">
                      Buy more
                    </button>
                  )}
                </div>
                <p className="mt-1 font-mono text-xl text-text">
                  {credit === null ? "N/A" : credit} <span className="text-xs text-muted">queries</span>
                </p>
              </div>

              <button
                onClick={disconnect}
                className="mt-3 w-full rounded-lg border border-border py-2 text-sm text-muted transition hover:bg-surface-raised hover:text-text"
              >
                Disconnect
              </button>

              <p className="mt-6 text-xs font-medium tracking-wide text-muted">Quick actions</p>
              <div className="mt-2 flex flex-col gap-1">
                <button
                  onClick={() => setBuyModalOpen(true)}
                  className="flex items-center gap-2.5 rounded-md px-1 py-2 text-left text-sm text-text transition hover:bg-surface-raised"
                >
                  <Receipt className="size-4 text-accent-text" aria-hidden="true" />
                  Buy credits
                </button>
                <a
                  href={`https://explorer.arc.io/address/${wallet}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 rounded-md px-1 py-2 text-sm text-text transition hover:bg-surface-raised"
                >
                  <ExternalLink className="size-4 text-accent-text" aria-hidden="true" />
                  View on Explorer
                </a>
                <Link
                  href="/stats"
                  className="flex items-center gap-2.5 rounded-md px-1 py-2 text-sm text-text transition hover:bg-surface-raised"
                >
                  <BarChart3 className="size-4 text-accent-text" aria-hidden="true" />
                  View stats
                </Link>
              </div>

              <p className="mt-6 text-xs font-medium tracking-wide text-muted">Usage</p>
              <div className="mt-2 flex items-center justify-between rounded-md bg-space px-3 py-2.5">
                <span className="text-xs text-muted">Per message</span>
                <span className="font-mono text-xs text-text">${formatUsdc(PRICE_PER_QUERY)} USDC</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between rounded-md bg-space px-3 py-2.5">
                <span className="text-xs text-muted">Credits remaining</span>
                <span className="font-mono text-xs text-text">{credit ?? "N/A"}</span>
              </div>

              <p className="mt-6 text-xs font-medium tracking-wide text-muted">Recent activity</p>
              <div className="mt-2 flex flex-col gap-2">
                {myActivity.length > 0 ? (
                  myActivity.slice(0, 5).map((tx, i) => (
                    <a
                      key={tx.hash || i}
                      href={`https://explorer.arc.io/tx/${tx.hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-2 rounded-md px-1 py-1.5 text-xs transition hover:bg-surface-raised"
                    >
                      <span className="flex items-center gap-2 text-text">
                        <Receipt className="size-3.5 shrink-0 text-accent-text" aria-hidden="true" />
                        Credit purchase · ${tx.amount}
                      </span>
                      <span className="shrink-0 text-muted">{timeAgo(tx.timestamp)}</span>
                    </a>
                  ))
                ) : (
                  <p className="px-1 py-1.5 text-xs text-muted">No activity yet for this wallet.</p>
                )}
              </div>

              <div className="mt-auto flex items-center gap-2 border-t border-border pt-4">
                <LogoMark className="size-5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text">Powered by Arc</p>
                  <p className="truncate text-[11px] text-muted">Fast · Secure · On-chain</p>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      <AnimatePresence>
        {walletModalOpen && <WalletModal onConnect={handleConnect} onClose={() => setWalletModalOpen(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {buyModalOpen && (
          <motion.div
            onClick={() => !buying && setBuyModalOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Buy query credit"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="w-full max-w-sm rounded-xl border border-border bg-surface p-5"
            >
              <div className="mb-5">
                <div className="text-base font-semibold text-text">Buy query credit</div>
                <p className="mt-1 text-xs text-muted">
                  One payment, one wallet confirmation. Then ask as many questions as you bought.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {PRESET_QUERIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => buyCredits(q)}
                    disabled={buying}
                    className="flex flex-col items-center gap-0.5 rounded-lg border border-accent/20 bg-accent-dim py-3.5 transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="text-sm font-semibold text-text">{q}</div>
                    <div className="font-mono text-xs text-muted">${((q * PRICE_PER_QUERY) / 1e6).toFixed(3)} USDC</div>
                  </button>
                ))}
              </div>

              <div className="mt-3.5 rounded-lg border border-border bg-space p-3.5">
                <div className="mb-2 text-xs font-medium text-text">Custom amount</div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={MIN_QUERIES}
                    max={MAX_QUERIES}
                    step={1}
                    value={customQueries}
                    onChange={(e) => setCustomQueries(e.target.value)}
                    disabled={buying}
                    placeholder={`${MIN_QUERIES}-${MAX_QUERIES} queries`}
                    className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2.5 py-2 text-sm text-text placeholder:text-muted focus:outline-none"
                  />
                  <button
                    onClick={buyCustomCredits}
                    disabled={buying || !customQueries}
                    className="shrink-0 rounded-md bg-accent px-4 py-2 text-xs font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Buy
                  </button>
                </div>
              </div>

              {txStep && <p className="mt-3 text-center text-xs text-warning">{txStep}</p>}
              {buyError && <p className="mt-3 text-center text-xs text-danger">{buyError}</p>}

              {!buying && (
                <button
                  onClick={() => setBuyModalOpen(false)}
                  className="mt-3 w-full rounded-lg border border-border py-2 text-xs text-muted transition hover:bg-surface-raised hover:text-text"
                >
                  Cancel
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
