"use client";
import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import Link from "next/link";
import { LogoMark } from "@/app/components/landing/LandingNavbar";
import { timeAgo } from "@/lib/format";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Ecosystem", href: "/ecosystem" },
  { label: "Grants", href: "/grants" },
  { label: "Build status", href: "/build-status" },
  { label: "Stats", href: "/stats" },
  { label: "News", href: "/news" },
];

const ARC_RPC = "https://rpc.mainnet.arc.io";
const USDC_CONTRACT = "0x3600000000000000000000000000000000000000";
const EURC_CONTRACT = "0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1";
const RECEIVER_WALLET = "0x78C144A76614A8674285129810555C8bCa78f044";
const FETCH_TIMEOUT_MS = 5000;
const RETRY_DELAY_MS = 3000;

interface NetworkStats {
  blockNumber: number;
  gasPriceGwei: string;
  gasPricePerTransferUsd: string;
  chainId: string;
}

interface WalletBalances {
  address: string;
  usdc: string;
  eurc: string;
  native: string;
}

interface RecentTransaction {
  hash: string;
  from: string;
  amount: string;
  timestamp: string | null;
}

interface ExplorerData {
  totalTransactions: number;
  recentTransactions: RecentTransaction[];
  stale: boolean;
  unavailable: boolean;
  cachedAt: number | null;
}

async function fetchWithTimeout(url: string, options: RequestInit, ms = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function rpcCall(method: string, params: unknown[] = []) {
  const res = await fetchWithTimeout(ARC_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  if (!res.ok) throw new Error(`RPC returned ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "RPC error");
  return data.result;
}

function formatUnits(hex: string, decimals: number): string {
  if (!hex || hex === "0x") return "0";
  const value = BigInt(hex);
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = value / divisor;
  const frac = value % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 4);
  return `${whole}.${fracStr}`;
}

// eth_gasPrice on Arc returns wei (18-decimal native gas accounting), not a
// 6-decimal USDC amount — docs.arc.io/arc/references/gas-and-fees. Convert to
// Gwei for display, and estimate a standard 21000-gas transfer's USD cost
// (USDC ~= $1, so wei-denominated gas cost converts directly to USD at 1e18).
// Max base fee is a 20,000 Gwei hard ceiling, so these values never approach
// Number.MAX_SAFE_INTEGER and BigInt -> Number loses no precision here.
function formatGasPrice(hex: string): { gwei: string; perTransferUsd: string } {
  if (!hex || hex === "0x") return { gwei: "0", perTransferUsd: "0.000000" };
  const wei = Number(BigInt(hex));
  const gwei = wei / 1e9;
  const perTransferUsd = (wei * 21000) / 1e18;
  return { gwei: gwei.toFixed(2), perTransferUsd: perTransferUsd.toFixed(6) };
}

// Briefly flashes/scales its content when `value` changes between
// refreshes, so a live update is noticeable rather than a silent swap.
// Skips the flash on first mount (only fires on actual changes).
function FlashValue({ value, children }: { value: string | number; children: ReactNode }) {
  const prev = useRef(value);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setTick((t) => t + 1);
    }
  }, [value]);
  return (
    <span key={tick} style={{ display: "inline-block", animation: tick > 0 ? "valueFlash 0.7s ease-out" : undefined }}>
      {children}
    </span>
  );
}

const EASE_OUT_CUBIC = (t: number) => 1 - Math.pow(1 - t, 3);
const TWEEN_DURATION_MS = 700;

// Odometer-style count-up/down: tweens its displayed number from the old
// value to the new one over ~700ms (eased, not linear) whenever `value`
// changes, and flashes at the same time. Shows the real value instantly
// on first mount — only re-fetches get the tween treatment.
function TickingNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const [flashKey, setFlashKey] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (displayRef.current === value) return;
    const from = displayRef.current;
    const to = value;
    setFlashKey((k) => k + 1);

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / TWEEN_DURATION_MS);
      const next = from + (to - from) * EASE_OUT_CUBIC(t);
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  return (
    <span key={flashKey} style={{ display: "inline-block", animation: flashKey > 0 ? "valueFlash 0.7s ease-out" : undefined }}>
      {format(display)}
    </span>
  );
}

// Block height gets the same real-data tween, plus a purely-visual ~1
// block/600ms increment between real refreshes so the counter feels alive
// like Arc's own explorer — it always snaps back in sync on the next real
// fetch, so it can't drift for more than one poll interval (~10s).
function LiveBlockHeight({ blockNumber }: { blockNumber?: number }) {
  const [display, setDisplay] = useState<number | undefined>(blockNumber);
  const displayRef = useRef<number | undefined>(blockNumber);
  const prevRealRef = useRef<number | undefined>(blockNumber);
  const [flashKey, setFlashKey] = useState(0);
  const rafRef = useRef<number | null>(null);
  const simRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (blockNumber === undefined) return;
    if (simRef.current) { clearInterval(simRef.current); simRef.current = null; }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (blockNumber !== prevRealRef.current) setFlashKey((k) => k + 1);
    prevRealRef.current = blockNumber;

    const from = displayRef.current ?? blockNumber;
    const to = blockNumber;
    const start = performance.now();
    const settle = (v: number) => { displayRef.current = v; setDisplay(v); };
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / TWEEN_DURATION_MS);
      settle(from + (to - from) * EASE_OUT_CUBIC(t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        settle(to);
        // Visual-only simulated ticking (Arc blocks land roughly every
        // ~0.6s) — not a real chain read, purely a "feels alive" cue.
        simRef.current = setInterval(() => {
          settle((displayRef.current ?? to) + 1);
        }, 600);
      }
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (simRef.current) clearInterval(simRef.current);
    };
  }, [blockNumber]);

  return (
    <span key={flashKey} style={{ display: "inline-block", animation: flashKey > 0 ? "valueFlash 0.7s ease-out" : undefined }}>
      {display !== undefined ? Math.round(display).toLocaleString() : null}
    </span>
  );
}

// Small pulsing-dot "Live" badge for section headings that auto-refresh.
function LiveDot() {
  return (
    <span className="relative mr-1.5 inline-flex size-1.5">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" aria-hidden="true" />
      <span className="relative inline-flex size-1.5 rounded-full bg-success" aria-hidden="true" />
    </span>
  );
}

// Pulsing placeholder shown only until a stat has ever loaded successfully.
// Once real data arrives it stays on screen (even mid-refresh) instead of
// flashing back to this.
function Skeleton({ width = 90, height = 22 }: { width?: number | string; height?: number }) {
  return (
    <span
      className="inline-block animate-pulse rounded-md bg-accent-dim"
      style={{ width, height }}
    />
  );
}

function Unavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-sm text-danger">unavailable</span>
      <button
        onClick={onRetry}
        className="rounded-md border border-border px-2 py-0.5 text-xs text-muted transition hover:text-text"
      >
        Retry
      </button>
    </span>
  );
}

function StatCard({ label, children, tone = "default" }: { label: string; children: ReactNode; tone?: "default" | "accent" }) {
  return (
    <div className={`rounded-lg border px-5 py-4 ${tone === "accent" ? "border-accent/25 bg-accent-dim" : "border-border bg-surface"}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl text-text">{children}</p>
    </div>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [networkFailed, setNetworkFailed] = useState(false);
  const [networkUpdated, setNetworkUpdated] = useState<Date | null>(null);
  const networkRetried = useRef(false);

  const [revenue, setRevenue] = useState<string | null>(null);
  const [revenueFailed, setRevenueFailed] = useState(false);
  const revenueRetried = useRef(false);

  const [explorer, setExplorer] = useState<ExplorerData | null>(null);
  const [explorerFailed, setExplorerFailed] = useState(false);
  const explorerRetried = useRef(false);

  const [walletInput, setWalletInput] = useState("");
  const [walletData, setWalletData] = useState<WalletBalances | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");

  const isValidAddress = (a: string) => /^0x[a-fA-F0-9]{40}$/.test(a.trim());

  const fetchNetworkStats = useCallback(async (isRetry = false) => {
    try {
      const [blockHex, gasPriceHex, chainIdHex] = await Promise.all([
        rpcCall("eth_blockNumber"),
        rpcCall("eth_gasPrice"),
        rpcCall("eth_chainId"),
      ]);
      const gasPrice = formatGasPrice(gasPriceHex);
      setStats({
        blockNumber: parseInt(blockHex, 16),
        gasPriceGwei: gasPrice.gwei,
        gasPricePerTransferUsd: gasPrice.perTransferUsd,
        chainId: parseInt(chainIdHex, 16).toString(),
      });
      setNetworkUpdated(new Date());
      setNetworkFailed(false);
      networkRetried.current = false;
    } catch {
      if (!isRetry && !networkRetried.current) {
        networkRetried.current = true;
        setTimeout(() => fetchNetworkStats(true), RETRY_DELAY_MS);
      } else {
        setNetworkFailed(true);
      }
    }
  }, []);

  const fetchRevenue = useCallback(async (isRetry = false) => {
    try {
      const data = "0x70a08231" + RECEIVER_WALLET.slice(2).padStart(64, "0");
      const result = await rpcCall("eth_call", [{ to: USDC_CONTRACT, data }, "latest"]);
      setRevenue(formatUnits(result, 6));
      setRevenueFailed(false);
      revenueRetried.current = false;
    } catch {
      if (!isRetry && !revenueRetried.current) {
        revenueRetried.current = true;
        setTimeout(() => fetchRevenue(true), RETRY_DELAY_MS);
      } else {
        setRevenueFailed(true);
      }
    }
  }, []);

  const fetchExplorerData = useCallback(async (isRetry = false) => {
    try {
      const res = await fetchWithTimeout("/api/stats", {});
      if (!res.ok) throw new Error(`stats API returned ${res.status}`);
      const data = await res.json();
      if (data.unavailable) throw new Error("explorer unavailable");
      setExplorer({
        totalTransactions: data.totalTransactions ?? 0,
        recentTransactions: Array.isArray(data.recentTransactions) ? data.recentTransactions : [],
        stale: !!data.stale,
        unavailable: false,
        cachedAt: data.cachedAt ?? null,
      });
      setExplorerFailed(false);
      explorerRetried.current = false;
    } catch {
      if (!isRetry && !explorerRetried.current) {
        explorerRetried.current = true;
        setTimeout(() => fetchExplorerData(true), RETRY_DELAY_MS);
      } else {
        setExplorerFailed(true);
      }
    }
  }, []);

  useEffect(() => {
    fetchNetworkStats();
    const interval = setInterval(() => fetchNetworkStats(), 10000);
    return () => clearInterval(interval);
  }, [fetchNetworkStats]);

  useEffect(() => {
    fetchRevenue();
    const interval = setInterval(() => fetchRevenue(), 10000);
    return () => clearInterval(interval);
  }, [fetchRevenue]);

  useEffect(() => {
    fetchExplorerData();
    const interval = setInterval(() => fetchExplorerData(), 10000);
    return () => clearInterval(interval);
  }, [fetchExplorerData]);

  const retryNetwork = () => { setNetworkFailed(false); networkRetried.current = false; fetchNetworkStats(); };
  const retryRevenue = () => { setRevenueFailed(false); revenueRetried.current = false; fetchRevenue(); };
  const retryExplorer = () => { setExplorerFailed(false); explorerRetried.current = false; fetchExplorerData(); };

  const lookupWallet = async () => {
    const addr = walletInput.trim();
    if (!isValidAddress(addr)) {
      setWalletError("Invalid address. Must be 0x followed by 40 hex characters.");
      return;
    }
    setWalletLoading(true);
    setWalletError("");
    setWalletData(null);
    try {
      const usdcData = "0x70a08231" + addr.slice(2).padStart(64, "0");
      const [usdcHex, eurcHex, nativeHex] = await Promise.all([
        rpcCall("eth_call", [{ to: USDC_CONTRACT, data: usdcData }, "latest"]),
        rpcCall("eth_call", [{ to: EURC_CONTRACT, data: usdcData }, "latest"]),
        rpcCall("eth_getBalance", [addr, "latest"]),
      ]);
      setWalletData({
        address: addr,
        usdc: formatUnits(usdcHex, 6),
        eurc: formatUnits(eurcHex, 6),
        native: formatUnits(nativeHex, 18),
      });
    } catch {
      setWalletError("Could not fetch balance. Check the address and try again.");
    } finally {
      setWalletLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-space font-sans text-text">
      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-border bg-space/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <LogoMark className="size-7" />
            <span className="text-sm font-semibold text-text">MicroAI</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  l.href === "/stats" ? "bg-accent-dim text-accent-text" : "text-muted hover:text-text"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent-dim px-3 py-1.5 text-xs text-accent-text">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-text opacity-75" aria-hidden="true" />
                <span className="relative inline-flex size-1.5 rounded-full bg-accent-text" aria-hidden="true" />
              </span>
              Arc Mainnet
            </span>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <p className="text-xs text-muted">
            <Link href="/" className="hover:text-text">Home</Link> / Stats
          </p>
          <div className="mt-4 max-w-xl">
            <h1 className="text-3xl font-semibold leading-[1.15] text-text sm:text-4xl">
              Arc Network
              <br />
              Stats
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted">
              Real-time data pulled directly from Arc Mainnet RPC. No static numbers: this refreshes every 10 seconds.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* NETWORK STATUS */}
        <p className="text-sm font-medium text-text">Network status</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Block height" tone="accent">
            {stats ? <LiveBlockHeight blockNumber={stats.blockNumber} /> : networkFailed ? <Unavailable onRetry={retryNetwork} /> : <Skeleton />}
          </StatCard>
          <div className="rounded-lg border border-accent/25 bg-accent-dim px-5 py-4">
            <p className="text-xs text-muted">Gas price</p>
            <p className="mt-2 font-mono text-2xl text-text">
              {stats?.gasPriceGwei !== undefined ? (
                <FlashValue value={stats.gasPriceGwei}>
                  {stats.gasPriceGwei}<span className="ml-1 text-xs text-muted">Gwei</span>
                </FlashValue>
              ) : networkFailed ? <Unavailable onRetry={retryNetwork} /> : <Skeleton />}
            </p>
            {stats?.gasPricePerTransferUsd !== undefined && (
              <p className="mt-1 text-xs text-muted">~${stats.gasPricePerTransferUsd} per transfer</p>
            )}
          </div>
          <StatCard label="Chain ID" tone="accent">
            {stats?.chainId !== undefined ? (
              <FlashValue value={stats.chainId}>{stats.chainId}</FlashValue>
            ) : networkFailed ? <Unavailable onRetry={retryNetwork} /> : <Skeleton />}
          </StatCard>
        </div>
        {networkUpdated && (
          <p className="mt-2 text-right text-xs text-muted">
            Last updated {timeAgo(networkUpdated.toISOString())} · auto-refresh 10s
          </p>
        )}

        {/* MICROAI ON-CHAIN ACTIVITY */}
        <p className="mt-10 text-sm font-medium text-text">MicroAI on-chain activity</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface px-5 py-4">
            <p className="text-xs text-muted">Total USDC received</p>
            <p className="mt-2 font-mono text-2xl text-text">
              {revenue !== null ? (
                <TickingNumber value={parseFloat(revenue)} format={(n) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`} />
              ) : revenueFailed ? (
                <Unavailable onRetry={retryRevenue} />
              ) : (
                <Skeleton />
              )}
            </p>
            <p className="mt-1 text-xs text-muted">From AI queries</p>
          </div>
          <div className="rounded-lg border border-border bg-surface px-5 py-4">
            <p className="text-xs text-muted">Total transactions</p>
            <p className="mt-2 font-mono text-2xl text-text">
              {explorer !== null ? (
                <TickingNumber value={explorer.totalTransactions} format={(n) => Math.round(n).toLocaleString()} />
              ) : explorerFailed ? (
                <Unavailable onRetry={retryExplorer} />
              ) : (
                <Skeleton />
              )}
            </p>
            <p className="mt-1 text-xs text-muted">On receiver wallet</p>
          </div>
        </div>
        {explorer?.stale && explorer.cachedAt && (
          <p className="mt-2 text-right text-xs text-warning">
            Showing last known data from {timeAgo(new Date(explorer.cachedAt).toISOString())}
          </p>
        )}
        <a
          href={`https://explorer.arc.io/address/${RECEIVER_WALLET}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-xs font-medium text-accent-text hover:underline"
        >
          View wallet on Arc Explorer →
        </a>

        {/* LIVE TRANSACTION FEED */}
        <div className="mt-10 flex items-center text-sm font-medium text-text">
          <LiveDot />Live transaction feed · last 10 · auto-refresh 10s
        </div>
        <div className="mt-3 overflow-hidden rounded-lg border border-border bg-surface">
          {explorer === null ? (
            explorerFailed ? (
              <div className="flex justify-center p-5">
                <Unavailable onRetry={retryExplorer} />
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 p-5">
                {[0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={16} />)}
              </div>
            )
          ) : explorer.recentTransactions.length === 0 ? (
            <p className="p-5 text-center text-sm text-muted">No transactions yet.</p>
          ) : (
            explorer.recentTransactions.map((tx, i) => (
              <div
                key={tx.hash || i}
                className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                {tx.hash ? (
                  <a
                    href={`https://explorer.arc.io/tx/${tx.hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 font-mono text-xs text-accent-text hover:underline"
                  >
                    {tx.hash.slice(0, 8)}...{tx.hash.slice(-6)}
                  </a>
                ) : (
                  <span className="font-mono text-xs text-muted">N/A</span>
                )}
                <span className="flex-1 text-center font-mono text-xs text-muted">{timeAgo(tx.timestamp)}</span>
                <span className="shrink-0 font-mono text-xs font-semibold text-success">${tx.amount} USDC</span>
              </div>
            ))
          )}
        </div>

        {/* WALLET LOOKUP */}
        <p className="mt-10 text-sm font-medium text-text">Wallet balance lookup</p>
        <div className="mt-3 rounded-lg border border-border bg-surface p-5">
          <div className="flex flex-wrap gap-2.5">
            <input
              type="text"
              value={walletInput}
              onChange={(e) => setWalletInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookupWallet()}
              placeholder="0x... (any Arc mainnet address)"
              className="min-w-0 flex-1 rounded-lg border border-border bg-space px-3.5 py-3 font-mono text-sm text-text placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <button
              onClick={lookupWallet}
              disabled={walletLoading}
              className="shrink-0 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {walletLoading ? "Checking..." : "Lookup →"}
            </button>
          </div>

          {walletError && (
            <div className="mt-3 rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
              {walletError}
            </div>
          )}

          {walletData && (
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {[
                { label: "USDC", value: walletData.usdc, color: "text-secondary-text" },
                { label: "EURC", value: walletData.eurc, color: "text-secondary-text" },
                { label: "Native gas", value: walletData.native, color: "text-success" },
              ].map((b) => (
                <div key={b.label} className="rounded-md border border-border bg-space px-3.5 py-3">
                  <p className="text-xs text-muted">{b.label}</p>
                  <p className={`mt-1.5 font-mono text-sm font-semibold ${b.color}`}>{b.value}</p>
                </div>
              ))}
            </div>
          )}

          {!walletData && !walletError && (
            <p className="mt-3 text-xs text-muted">
              Paste any Arc MAINNET wallet address to see live USDC, EURC, and native gas balance.
            </p>
          )}
        </div>
      </div>

      {/* CTA */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-7xl px-4 py-14 text-center sm:px-6">
          <h2 className="text-2xl font-semibold text-text">Ask MicroAI</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
            Get deeper answers about Arc transactions, USDC, CCTP, or any Circle integration for $0.001 USDC.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:brightness-110"
          >
            Ask MicroAI
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-6">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-5" />
            <span className="text-xs text-muted">MicroAI · The Arc &amp; Circle hub</span>
          </div>
          <div className="flex flex-wrap gap-5">
            {[
              { l: "Arc", h: "https://arc.io" },
              { l: "Circle", h: "https://circle.com" },
              { l: "GitHub", h: "https://github.com/sahmedonchain/microai" },
              { l: "Explorer", h: "https://explorer.arc.io" },
            ].map((link) => (
              <a key={link.l} href={link.h} target="_blank" rel="noreferrer" className="text-xs text-muted transition hover:text-text">
                {link.l}
              </a>
            ))}
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes valueFlash {
          0% { color: #baf5d6; transform: scale(1.1); text-shadow: 0 0 12px rgba(61,214,140,0.5); }
          60% { color: #3dd68c; transform: scale(1.03); }
          100% { color: inherit; transform: scale(1); text-shadow: none; }
        }
        input::placeholder { color: var(--color-muted); }
      `}</style>
    </div>
  );
}
