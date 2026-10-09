import Groq from "groq-sdk";
import { apiErrors, parseJson, withApi } from "@/lib/api";
import { explorerFetch } from "@/lib/arcExplorer";
import { walletBody } from "@/lib/schemas";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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

// Public AI endpoint: strict per-minute and per-day limits for each caller
// (wallet if signed in, otherwise IP) plus one shared daily budget for the route.
export const POST = withApi(
  {
    name: "wallet",
    auth: "optional",
    limits: [
      { limit: 5, windowSec: 60 },
      { limit: 40, windowSec: 86_400 },
      { limit: 2000, windowSec: 86_400, scope: "global" },
    ],
  },
  async ({ req, log }) => {
  const { address } = await parseJson(req, walletBody);

  const [profileRes, txRes, tokenRes, countersRes] = await Promise.all([
    explorerFetch<object>(`/addresses/${address}`),
    explorerFetch<{ items?: ExplorerTx[] }>(`/addresses/${address}/transactions`),
    explorerFetch<{ token?: { symbol?: string }; value?: string }[]>(`/addresses/${address}/token-balances`),
    explorerFetch<{ transactions_count?: string }>(`/addresses/${address}/counters`),
  ]);

  if (!profileRes.ok && profileRes.kind === "not_found") throw apiErrors.notFound("Address not found on Arc Mainnet.");
  if (!profileRes.ok || !txRes.ok || !tokenRes.ok) {
    throw apiErrors.upstream("Arc Explorer is unreachable right now. Try again in a moment.");
  }

  const profile = profileRes.data;
  const transactions: ExplorerTx[] = Array.isArray(txRes.data?.items) ? txRes.data.items.slice(0, 20) : [];
  const tokenBalances = Array.isArray(tokenRes.data) ? tokenRes.data : [];
  const txCount =
    (countersRes.ok ? countersRes.data?.transactions_count : undefined) ??
    (profile as { tx_count?: string | number }).tx_count ??
    String(transactions.length);

  const riskSignals = computeRiskSignals(transactions);

  let aiSummary = "";
  try {
    const tokens = tokenBalances
      .slice(0, 10)
      .map((t) => `${t.token?.symbol ?? "?"}: ${t.value ?? "0"} (raw)`)
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
    log.error("Wallet AI summary error", { err });
  }

  return {
    profile: { ...profile, tx_count: txCount },
    transactions,
    tokenBalances,
    riskSignals,
    aiSummary: aiSummary || "AI summary is unavailable right now.",
  };
  }
);
