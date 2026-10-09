import Groq from "groq-sdk";
import { apiErrors, parseJson, withApi } from "@/lib/api";
import { explorerFetch } from "@/lib/arcExplorer";
import { debugAnalyzeBody } from "@/lib/schemas";
import { ARC_MAINNET, USDC_ADDRESS } from "@/lib/arcConfig";

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

const KNOWN_SELECTORS: Record<string, string> = {
  a9059cbb: "transfer(address,uint256)",
  "23b872dd": "transferFrom(address,address,uint256)",
  "095ea7b3": "approve(address,uint256)",
  "40c10f19": "mint(address,uint256)",
  "42966c68": "burn(uint256)",
  "3593564c": "execute(bytes,bytes[],uint256) [Uniswap]",
  d0e30db0: "deposit()",
  "2e1a7d4d": "withdraw(uint256)",
};

function decodeFunction(rawInput?: string): string {
  if (!rawInput || !/^0x[0-9a-fA-F]{8}/.test(rawInput)) return "unknown";
  return KNOWN_SELECTORS[rawInput.slice(2, 10).toLowerCase()] ?? "unknown";
}

function buildCorrectedFlow(txData: TxData): string[] {
  if (txData.result === "success") return ["Transaction succeeded — no correction needed"];
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

function buildPrompt(
  txData: TxData,
  decodedFunction: string,
  tokenTransfers: TokenTransfer[],
  internalTxs: InternalTx[],
  correctedFlow: string[]
): string {
  return `Analyze this Arc MAINNET transaction and debug it:

Transaction Hash: ${txData.hash}
Status: ${txData.status}
Result: ${txData.result || "unknown"}
From: ${txData.from?.hash}
To: ${txData.to?.hash || "contract creation"}
Value: ${txData.value}
Gas Used: ${txData.gas_used}
Gas Limit: ${txData.gas_limit}
Error: ${txData.error || "none"}
Revert Reason: ${txData.revert_reason || "none"}
Input Data: ${txData.raw_input ? txData.raw_input.slice(0, 100) : "none"}
Fee: ${txData.fee?.value || "unknown"}
Timestamp: ${txData.timestamp || "unknown"}
Block: ${txData.block_number || "pending"}
Decoded Function: ${decodedFunction}
Token Transfers: ${tokenTransfers.length}${tokenTransfers.length ? " (" + tokenTransfers.slice(0, 5).map((t) => `${t.value} ${t.symbol}`).join(", ") + ")" : ""}
Internal Transactions: ${internalTxs.length}
Suggested Corrected Flow: ${correctedFlow.join(" -> ")}

USDC Contract on Arc: ${USDC_CONTRACT}
Arc Chain ID: ${ARC_CHAIN_ID}

Please respond ONLY with valid JSON in this exact format, no other text:
{
  "summary": "one sentence describing what happened",
  "rootCause": "the specific technical reason this failed or succeeded",
  "solution": "exact steps to fix this or what the user should do next",
  "severity": "high or medium or low"
}

If the transaction succeeded, set severity to "low" and explain what it did.
If it failed, identify the root cause from: insufficient USDC balance, wrong chain, gas limit too low, contract revert, invalid input, nonce issue, or other.`;
}

export const POST = withApi({ name: "debug-analyze", auth: "optional", limits: [{ limit: 10, windowSec: 60 }] }, async ({ req, log }) => {
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

  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: buildPrompt(txData, decodedFunction, tokenTransfers, internalTxs, correctedFlow) }],
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

    return { ...parsed, txData, tokenTransfers, internalTxs, decodedFunction, correctedFlow };
  } catch (err) {
    log.error("Debug analysis error", { err });
    throw apiErrors.internal("Analysis failed. Please try again.");
  }
});
