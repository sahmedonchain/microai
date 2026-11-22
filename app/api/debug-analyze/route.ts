import Groq from "groq-sdk";
import { apiErrors, parseJson, withApi } from "@/lib/api";
import { explorerFetch } from "@/lib/arcExplorer";
import { debugAnalyzeBody } from "@/lib/schemas";
import { UNTRUSTED_DATA_NOTICE, dataBlock, sanitizeUntrusted as clean } from "@/lib/untrusted";
import { ARC_MAINNET, USDC_ADDRESS } from "@/lib/arcConfig";
import { rpcCall } from "@/lib/arcRpc";
import { decodeFunction, decodeLogs, diagnose, normalizeRevert, type DecodedEvent, type Diagnosis, type RawLog } from "@/lib/debug/diagnose";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const USDC_CONTRACT = USDC_ADDRESS;
const ARC_CHAIN_ID = ARC_MAINNET.chainId;

interface TxData {
  hash: string;
  status: string;
  result: string;
  block_number: number | null;
  from: { hash: string };
  to: { hash: string } | null;
  value: string;
  gas_used: string;
  gas_limit: string;
  error?: string;
  revert_reason?: string;
  raw_input?: string;
  fee?: { value: string };
  timestamp?: string;
}

interface TokenTransfer {
  symbol: string;
  from: string;
  to: string;
  value: string;
}

interface InternalTx {
  from: string;
  to: string;
  value: string;
  type: string;
}

function buildCorrectedFlow(txData: TxData): string[] {
  if (txData.result === "success") return ["Transaction succeeded, no correction needed"];
  const revert = (txData.revert_reason || "").toLowerCase();
  const error = (txData.error || "").toLowerCase();
  if (revert.includes("allowance")) return ["approve(spender, amount)", "transfer(to, amount)"];
  if (revert.includes("balance")) return ["check USDC balance", "add funds", "retry transfer"];
  if (error.includes("gas")) return ["increase gas limit by 20%", "retry transaction"];
  return ["Review error", "Check Arc Explorer", "Retry with correct params"];
}

// Explorer sub-resources are best-effort: a failure here must not fail the
// whole analysis, so it degrades to an empty list.
async function fetchItems(txHash: string, path: string): Promise<Record<string, any>[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const res = await explorerFetch<{ items?: Record<string, any>[] }>(`/transactions/${txHash}/${path}`, { timeoutMs: 5000 }); // eslint-disable-line @typescript-eslint/no-explicit-any
  return res.ok && Array.isArray(res.data?.items) ? res.data.items : [];
}

function formatUnits(value: unknown, decimals: unknown): string {
  const raw = typeof value === "string" || typeof value === "number" ? String(value) : "0";
  const d = Number(decimals);
  if (!/^\d+$/.test(raw) || !Number.isInteger(d) || d <= 0) return raw;
  const padded = raw.padStart(d + 1, "0");
  const whole = padded.slice(0, -d);
  const frac = padded.slice(-d).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

function normalizeTransfers(items: Record<string, any>[]): TokenTransfer[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  return items.map((i) => ({
    symbol: i.token?.symbol || "?",
    from: i.from?.hash || "",
    to: i.to?.hash || "",
    value: formatUnits(i.total?.value, i.total?.decimals ?? i.token?.decimals),
  }));
}

function normalizeInternal(items: Record<string, any>[]): InternalTx[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  return items.map((i) => ({
    from: i.from?.hash || "",
    to: i.to?.hash || "",
    value: String(i.value ?? "0"),
    type: String(i.type ?? "call"),
  }));
}

interface AnalysisResult {
  summary: string;
  rootCause: string;
  solution: string;
  severity: "high" | "medium" | "low";
}

// Everything taken from the transaction and the Explorer (revert reasons, token
// symbols, input data, ...) is untrusted: it goes into a delimited data block
// in the user message, while the instructions live in the system message.
function buildPrompt(
  txData: TxData,
  decodedFunction: string,
  tokenTransfers: TokenTransfer[],
  internalTxs: InternalTx[],
  correctedFlow: string[],
  diagnosis: Diagnosis[]
): { system: string; user: string } {
  const system = `You analyze Arc MAINNET transactions and debug them.

USDC Contract on Arc: ${USDC_CONTRACT}
Arc Chain ID: ${ARC_CHAIN_ID}

Respond ONLY with valid JSON in this exact format, no other text:
{
  "summary": "one sentence describing what happened",
  "rootCause": "the specific technical reason this failed or succeeded",
  "solution": "exact steps to fix this or what the user should do next",
  "severity": "high or medium or low"
}

A "Deterministic findings" list is decoded from chain data by MicroAI. Items marked confirmed are facts: never contradict them. Items marked probable or unknown are not facts. In rootCause, say "confirmed" only for what the confirmed findings state, and use words like "probably" or "may" for anything else.

If the transaction succeeded, set severity to "low" and explain what it did.
If it failed, identify the root cause from: insufficient USDC balance, wrong chain, gas limit too low, contract revert, invalid input, nonce issue, or other.

${UNTRUSTED_DATA_NOTICE}`;

  const lines = [
    `Transaction Hash: ${clean(txData.hash, 70)}`,
    `Status: ${clean(txData.status, 20)}`,
    `Result: ${clean(txData.result || "unknown", 20)}`,
    `From: ${clean(txData.from?.hash, 50)}`,
    `To: ${clean(txData.to?.hash || "contract creation", 50)}`,
    `Value: ${clean(txData.value, 40)}`,
    `Gas Used: ${clean(txData.gas_used, 20)}`,
    `Gas Limit: ${clean(txData.gas_limit, 20)}`,
    `Error: ${clean(txData.error || "none", 200)}`,
    `Revert Reason: ${clean(txData.revert_reason || "none", 300)}`,
    `Input Data: ${txData.raw_input ? clean(txData.raw_input.slice(0, 100), 100) : "none"}`,
    `Fee: ${clean(txData.fee?.value || "unknown", 40)}`,
    `Timestamp: ${clean(txData.timestamp || "unknown", 40)}`,
    `Block: ${clean(txData.block_number || "pending", 20)}`,
    `Decoded Function: ${clean(decodedFunction, 80)}`,
    `Token Transfers: ${tokenTransfers.length}${tokenTransfers.length ? " (" + tokenTransfers.slice(0, 5).map((t) => `${clean(t.value, 40)} ${clean(t.symbol, 12)}`).join(", ") + ")" : ""}`,
    `Internal Transactions: ${internalTxs.length}`,
    `Suggested Corrected Flow: ${correctedFlow.map((c) => clean(c, 80)).join(" -> ")}`,
    ...diagnosis.slice(0, 6).map((d) => `Deterministic finding (${d.confidence}): ${clean(d.title, 120)}. ${clean(d.evidence.join("; "), 200)}`),
  ];
  return { system, user: `Analyze this transaction:\n${dataBlock("transaction", lines, { maxLineLen: 420 })}` };
}

export const POST = withApi(
  {
    name: "debug-analyze", pause: "ai", onLimiterError: "closed",
    auth: "optional",
    limits: [
      { limit: 5, windowSec: 60 },
      { limit: 40, windowSec: 86_400 },
      { limit: 2000, windowSec: 86_400, scope: "global" },
    ],
  },
  async ({ req, log }) => {
  // This endpoint only ever accepts a tx hash (validated by the schema), never
  // an arbitrary message, so it cannot be used as a free general-purpose chat route.
  const { txHash } = await parseJson(req, debugAnalyzeBody);

  const txRes = await explorerFetch<TxData>(`/transactions/${txHash}`);
  if (!txRes.ok) {
    if (txRes.kind === "not_found") throw apiErrors.notFound("Transaction not found on Arc Mainnet. Check the hash and try again.");
    throw apiErrors.upstream("Arc Explorer is unreachable right now. Try again in a moment.");
  }
  const txData = txRes.data;
  if (!txData?.hash) throw apiErrors.notFound("Transaction not found on Arc Mainnet. Check the hash and try again.");

  const [transferItems, internalItems] = await Promise.all([
    fetchItems(txHash, "token-transfers"),
    fetchItems(txHash, "internal-transactions"),
  ]);
  const tokenTransfers = normalizeTransfers(transferItems);
  const internalTxs = normalizeInternal(internalItems);
  const decodedFunction = decodeFunction(txData.raw_input);
  const correctedFlow = buildCorrectedFlow(txData);

  // Logs come from the receipt (RPC) because the Explorer does not always return them.
  // Best effort: without them the diagnosis simply has no events.
  let events: DecodedEvent[] = [];
  let unknownEvents = 0;
  let eventsAvailable = false;
  try {
    const receipt = await rpcCall<{ logs?: RawLog[] } | null>("eth_getTransactionReceipt", [txHash], { timeoutMs: 4000, retries: 0 });
    if (receipt && Array.isArray(receipt.logs)) {
      const decoded = decodeLogs(receipt.logs);
      events = decoded.events;
      unknownEvents = decoded.unknown;
      eventsAvailable = true;
    }
  } catch {
    /* no logs this time */
  }
  const revert = normalizeRevert(txData.revert_reason);
  const diagnosis = diagnose({
    result: txData.result, status: txData.status, error: txData.error, revert,
    rawInput: txData.raw_input, gasUsed: txData.gas_used, gasLimit: txData.gas_limit, events,
  });

  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: (() => {
        const prompt = buildPrompt(txData, decodedFunction, tokenTransfers, internalTxs, correctedFlow, diagnosis);
        return [
          { role: "system" as const, content: prompt.system },
          { role: "user" as const, content: prompt.user },
        ];
      })(),
      temperature: 0.1,
      max_tokens: 700,
    });

    const raw = completion.choices[0]?.message?.content || "";
    const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsed: AnalysisResult;
    try {
      parsed = JSON.parse(clean);
    } catch {
      parsed = {
        summary: "Transaction analyzed",
        rootCause: raw.slice(0, 200) || "Could not parse AI analysis.",
        solution: "Check Arc Explorer for full details.",
        severity: txData.result === "success" ? "low" : "high",
      };
    }

    return { ...parsed, txData, tokenTransfers, internalTxs, decodedFunction, correctedFlow, diagnosis, revert, events, unknownEvents, eventsAvailable };
  } catch (err) {
    log.error("Debug analysis error", { err });
    throw apiErrors.internal("Analysis failed. Please try again.");
  }
  }
);
