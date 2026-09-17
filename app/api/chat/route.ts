import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Groq from "groq-sdk";
import { ethers } from "ethers";
import { searchKnowledge } from "@/lib/search";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { PRICE_PER_QUERY as PRICE_PER_QUERY_UNITS } from "@/lib/pricing";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const ARC_RPC = "https://rpc.mainnet.arc.io";
const ARC_CHAIN_ID = 5042;
const USDC_CONTRACT = "0x3600000000000000000000000000000000000000";
const RECEIVER = "0x9a318CD2BC533B5B2e96F7f5b499738732492b15";

// Fixed price, 6-decimal USDC units — never accepted from the client.
const PRICE_PER_QUERY = BigInt(PRICE_PER_QUERY_UNITS); // 0.001 USDC

class InsufficientAllowanceError extends Error {}

function encodeAddressParam(address: string): string {
  if (!ethers.isAddress(address)) throw new Error("Invalid address");
  return address.slice(2).toLowerCase().padStart(64, "0");
}

function encodeUint256Param(value: bigint): string {
  if (value < BigInt(0)) throw new Error("Invalid amount");
  const hex = value.toString(16);
  if (hex.length > 64) throw new Error("Amount out of range");
  return hex.padStart(64, "0");
}

async function rpcCall(method: string, params: unknown[]) {
  const res = await fetch(ARC_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.result;
}

async function chargeQuery(userAddress: string): Promise<string> {
  if (!ethers.isAddress(userAddress)) {
    throw new Error("Invalid address");
  }

  const privateKey = process.env.OPERATOR_PRIVATE_KEY;
  if (!privateKey) throw new Error("Operator not configured");

  const network = new ethers.Network("arc-mainnet", ARC_CHAIN_ID);
  const provider = new ethers.JsonRpcProvider(ARC_RPC, network, { staticNetwork: network });
  const operatorKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const operator = new ethers.Wallet(operatorKey, provider);

  // Check allowance via raw RPC (no ethers provider call)
  const allowanceData = "0xdd62ed3e" + encodeAddressParam(userAddress) + encodeAddressParam(operator.address);
  const allowanceHex = await rpcCall("eth_call", [{ to: USDC_CONTRACT, data: allowanceData }, "latest"]);
  const allowance = BigInt(allowanceHex || "0x0");

  if (allowance < PRICE_PER_QUERY) {
    throw new InsufficientAllowanceError("Insufficient allowance");
  }

  // Build transferFrom calldata — amount is always the fixed constant above.
  const transferData =
    "0x23b872dd" +
    encodeAddressParam(userAddress) +
    encodeAddressParam(RECEIVER) +
    encodeUint256Param(PRICE_PER_QUERY);

  const nonceHex = await rpcCall("eth_getTransactionCount", [operator.address, "latest"]);
  const nonce = parseInt(nonceHex, 16);

  const gasPriceHex = await rpcCall("eth_gasPrice", []);
  const gasPrice = BigInt(gasPriceHex);

  const tx = {
    type: 0,
    to: USDC_CONTRACT,
    data: transferData,
    nonce,
    gasPrice,
    gasLimit: BigInt(150000),
    chainId: ARC_CHAIN_ID,
    value: BigInt(0),
  };

  const signedTx = await operator.signTransaction(tx);
  return rpcCall("eth_sendRawTransaction", [signedTx]);
}

const SYSTEM_PROMPT = `
You are MicroAI — the official Arc & Circle Intelligence Hub AI assistant.
You are the most knowledgeable source about Arc blockchain and Circle products.

YOUR KNOWLEDGE COVERS:
- Arc MAINNET: Chain ID 0x13b2 (5042), RPC rpc.mainnet.arc.io, Explorer explorer.arc.io
- USDC contract on Arc: 0x3600000000000000000000000000000000000000 (6 decimals for ERC-20, 18 decimals native)
- EURC contract on Arc: 0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1
- CCTP TokenMessengerV2: 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA (Domain 26)
- CCTP MessageTransmitterV2: 0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275
- ERC-8004: AI Agent identity/reputation standard on Arc
- ERC-8183: Job lifecycle standard (escrow, deliverables, USDC settlement)
- Arc App Kit: Bridge, Swap, Send, Unified Balance across chains
- Circle products: USDC, EURC, CCTP, Gateway, Developer-Controlled Wallets, Modular Wallets
- Faucet: faucet.circle.com
- Docs: docs.arc.io | developers.circle.com

RESPONSE RULES:
1. ALWAYS use the knowledge base context provided first.
2. For technical specs (addresses, chain IDs, RPC URLs) use ONLY verified knowledge base data. Never guess.
3. Remember conversation history — expand on previous answers when asked.
4. If something is not in your knowledge base, direct user to docs.arc.io or developers.circle.com.

RESPONSE FORMAT:

**Direct Answer**
[2-3 lines — clear, complete, accurate]

---
💬 *Ask: **"explain"** · **"guide"** · **"code example"** · **"docs link"***

---

When user says "explain" or "more":
**Deep Explanation**
[Full breakdown with context and how it works]

When user says "guide" or "how to":
**Step-by-Step**
1. First step
2. Second step
3. ...

When user says "code" or "example":
**Code Example**
\`\`\`typescript
// Working code
\`\`\`

When user says "docs" or "source":
**Official Docs**
- docs.arc.io/[relevant-page]
- developers.circle.com/[relevant-page]

TONE: Expert, concise, developer-friendly. Zero fluff. Be the smartest Arc+Circle resource available.
`;

type KnowledgeItem = {
  id: string;
  title: string;
  content: string;
  keywords?: string[];
};

function safeSearch(query: string, data: KnowledgeItem[]) {
  const q = query.toLowerCase();
  return data.filter((item) => {
    const t = item.title.toLowerCase();
    const c = item.content.toLowerCase();
    return t.includes(q) || c.includes(q);
  });
}

export async function POST(req: Request) {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    const session = token ? verifySessionToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: "session_required" }, { status: 401 });
    }

    const userAddress = session.sub;

    const { message, history = [] } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    let txHash: string;
    try {
      txHash = await chargeQuery(userAddress);
    } catch (err) {
      if (err instanceof InsufficientAllowanceError) {
        return NextResponse.json({ error: "insufficient_allowance" }, { status: 402 });
      }
      const error = err as { message?: string };
      console.error("Charge error:", error?.message);
      return NextResponse.json({ error: "payment_failed" }, { status: 500 });
    }

    // The charge already succeeded at this point — from here on we always
    // return txHash so the user keeps proof of payment even if the AI call fails.
    try {
      // STEP 1: SEARCH KNOWLEDGE BASE
      const matched = searchKnowledge(message);
      const fallbackMatched = safeSearch(message, matched);
      const relevantKnowledge = fallbackMatched
        .map((item) => `### ${item.title}\n${item.content}`)
        .join("\n\n");

      const context =
        relevantKnowledge.length > 0
          ? relevantKnowledge
          : "NO DIRECT MATCH — use your built-in Arc & Circle knowledge to answer accurately.";

      // STEP 2: CALL AI
      const completion = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "system",
            content: `[ARC & CIRCLE KNOWLEDGE BASE CONTEXT]\n\n${context}\n\nUse this context to give accurate, grounded answers. For addresses and chain IDs always use verified data only.`,
          },
          ...history.slice(-8).map((h: { role: string; content: string }) => ({
            role: h.role as "user" | "assistant",
            content: h.content,
          })),
          {
            role: "user",
            content: message,
          },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      });

      const reply =
        completion.choices[0]?.message?.content ||
        "Could not generate response.";

      return NextResponse.json({ reply, txHash });
    } catch (err) {
      console.error("AI generation error (payment already charged):", err);
      return NextResponse.json({
        reply: "Payment succeeded, but the response could not be generated. Please contact support with your transaction hash.",
        txHash,
      });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { reply: "Server error occurred." },
      { status: 500 }
    );
  }
}
