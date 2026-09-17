import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const ARC_EXPLORER_API = "https://explorer.arc.io/api/v2";
const USDC_CONTRACT = "0x3600000000000000000000000000000000000000";
const ARC_CHAIN_ID = 5042;

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

const RATE_LIMIT = 10; // requests
const RATE_WINDOW_MS = 60_000; // per minute, per IP

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

interface AnalysisResult {
  summary: string;
  rootCause: string;
  solution: string;
  severity: "high" | "medium" | "low";
}

function buildPrompt(txData: TxData): string {
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

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`debug-analyze:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests. Please slow down and try again shortly." }, { status: 429 });
  }

  let txHash: string;
  try {
    const body = await req.json();
    txHash = typeof body?.txHash === "string" ? body.txHash.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Strict format check — this endpoint only ever accepts a tx hash, never
  // an arbitrary message, so it can't be used as a free general-purpose chat route.
  if (!TX_HASH_RE.test(txHash)) {
    return NextResponse.json({ error: "Invalid transaction hash. Must be 0x followed by 64 hex characters." }, { status: 400 });
  }

  let txData: TxData;
  try {
    const res = await fetch(`${ARC_EXPLORER_API}/transactions/${txHash}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || data.errors || !data.hash) {
      return NextResponse.json({ error: "Transaction not found on Arc MAINNET. Check the hash and try again." }, { status: 404 });
    }
    txData = data as TxData;
  } catch (err) {
    console.error("Explorer fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch transaction. Arc Explorer may be temporarily unavailable." }, { status: 502 });
  }

  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: buildPrompt(txData) }],
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

    return NextResponse.json({ ...parsed, txData });
  } catch (err) {
    console.error("Debug analysis error:", err);
    return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 500 });
  }
}
