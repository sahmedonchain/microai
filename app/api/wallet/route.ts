import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const ARC_EXPLORER_API = "https://explorer.arc.io/api/v2";
const EXPLORER_TIMEOUT_MS = 5000;

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const RATE_LIMIT = 10; // requests
const RATE_WINDOW_MS = 60_000; // per minute, per IP

const MAX_UINT_SUFFIX = "f".repeat(64);
// Arc's native USDC uses 18 decimals, and TX `value` is denominated in them.
const HIGH_VALUE_THRESHOLD = BigInt(100) * BigInt(10) ** BigInt(18);
const DAY_MS = 24 * 60 * 60 * 1000;

interface ExplorerTx {
  hash?: string;
  value?: string;
  raw_input?: string;
  timestamp?: string;
  to?: { is_contract?: boolean } | null;
}

async function explorerGet(path: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXPLORER_TIMEOUT_MS);
  try {
    const res = await fetch(`${ARC_EXPLORER_API}${path}`, { cache: "no-store", signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // timeout, network error or malformed response
  } finally {
    clearTimeout(timer);
  }
}

function toBigInt(value: unknown): bigint {
  try {
    return typeof value === "string" || typeof value === "number" ? BigInt(value) : BigInt(0);
  } catch {
    return BigInt(0);
  }
}

function computeRiskSignals(txs: ExplorerTx[]) {
  const now = Date.now();
  let hasUnlimitedApproval = false;
  let highValueTx = false;
  let newContract = false;
  let recentCount = 0;

  for (const tx of txs) {
    const input = (tx.raw_input || "").toLowerCase();
    if (input.startsWith("0x095ea7b3") && input.endsWith(MAX_UINT_SUFFIX)) hasUnlimitedApproval = true;
    if (toBigInt(tx.value) > HIGH_VALUE_THRESHOLD) highValueTx = true;

    const age = tx.timestamp ? now - new Date(tx.timestamp).getTime() : Infinity;
    if (tx.to?.is_contract === true && age < 7 * DAY_MS) newContract = true;
    if (age < DAY_MS) recentCount += 1;
  }

  return { hasUnlimitedApproval, highValueTx, newContract, frequentSmallTx: recentCount > 10 };
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`wallet:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests. Please slow down and try again shortly." }, { status: 429 });
  }

  let address: string;
  try {
    const body = await req.json();
    address = typeof body?.address === "string" ? body.address.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!ADDRESS_RE.test(address)) {
    return NextResponse.json({ error: "Invalid address. Must be 0x followed by 40 hex characters." }, { status: 400 });
  }

  const [profile, txData, tokenData, counters] = await Promise.all([
    explorerGet(`/addresses/${address}`),
    explorerGet(`/addresses/${address}/transactions?limit=20`),
    explorerGet(`/addresses/${address}/token-balances`),
    explorerGet(`/addresses/${address}/counters`),
  ]);

  if (!profile || !txData || !tokenData) {
    return NextResponse.json(
      { error: "Could not load this wallet from Arc Explorer. The address may not exist on Arc Mainnet, or Explorer timed out. Try again in a moment." },
      { status: 504 }
    );
  }

  const transactions: ExplorerTx[] = Array.isArray((txData as { items?: unknown })?.items)
    ? ((txData as { items: ExplorerTx[] }).items).slice(0, 20)
    : [];
  const tokenBalances = Array.isArray(tokenData) ? tokenData : [];
  const txCount =
    (counters as { transactions_count?: string } | null)?.transactions_count ??
    (profile as { tx_count?: string | number }).tx_count ??
    String(transactions.length);

  const riskSignals = computeRiskSignals(transactions);

  let aiSummary = "";
  try {
    const tokens = tokenBalances
      .slice(0, 10)
      .map((t: { token?: { symbol?: string }; value?: string }) => `${t.token?.symbol ?? "?"}: ${t.value ?? "0"} (raw)`)
      .join(", ");
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content:
            "You are MicroAI Wallet Analyst. Analyze Arc wallet activity and give a short 3-4 sentence summary. Focus on USDC movements, contract interactions, and activity patterns. Be factual, not alarmist.",
        },
        {
          role: "user",
          content: `Address: ${address}
Transaction count: ${txCount}
Recent transactions analyzed: ${transactions.length}
Token balances: ${tokens || "none"}
Risk signals detected: ${JSON.stringify(riskSignals)}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 800,
    });
    aiSummary = completion.choices[0]?.message?.content?.trim() || "";
  } catch (err) {
    console.error("Wallet AI summary error:", err);
  }

  return NextResponse.json({
    profile: { ...(profile as object), tx_count: txCount },
    transactions,
    tokenBalances,
    riskSignals,
    aiSummary: aiSummary || "AI summary is unavailable right now.",
  });
}
