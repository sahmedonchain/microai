import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { ethers } from "ethers";
import { searchKnowledge } from "@/lib/search";
import { claimTxHash } from "@/lib/usedTx";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const ARC_RPC = "https://rpc.mainnet.arc.io";
const USDC_CONTRACT = "0x3600000000000000000000000000000000000000";
const RECEIVER = "0x9a318CD2BC533B5B2e96F7f5b499738732492b15";

// Fixed price, 6-decimal USDC units — never accepted from the client.
const PRICE_PER_QUERY = BigInt(1000); // 0.001 USDC

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const MAX_TX_AGE_MS = 5 * 60 * 1000;

class PaymentVerificationError extends Error {}

function topicToAddress(topic: string): string {
  return "0x" + topic.slice(-40);
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

// Verifies txHash is a real, recent, exact 0.001 USDC transfer from
// walletAddress to RECEIVER, then atomically marks it spent. Validation
// happens fully before the claim so a transient RPC hiccup never burns a
// legitimate payment; the claim itself is what blocks replay.
async function verifyPayment(txHash: string, walletAddress: string): Promise<void> {
  const receipt = await rpcCall("eth_getTransactionReceipt", [txHash]);
  if (!receipt) {
    throw new PaymentVerificationError("Transaction not found on Arc MAINNET.");
  }
  if (receipt.status !== "0x1") {
    throw new PaymentVerificationError("Transaction did not succeed.");
  }

  const logs = (receipt.logs || []) as { address?: string; topics?: string[]; data?: string }[];
  const transferLog = logs.find(
    (log) =>
      log.address?.toLowerCase() === USDC_CONTRACT.toLowerCase() &&
      log.topics?.[0]?.toLowerCase() === TRANSFER_TOPIC &&
      log.topics?.length === 3
  );
  if (!transferLog || !transferLog.topics || !transferLog.data) {
    throw new PaymentVerificationError("No USDC transfer found in transaction.");
  }

  const from = topicToAddress(transferLog.topics[1]);
  const to = topicToAddress(transferLog.topics[2]);
  const value = BigInt(transferLog.data);

  if (to.toLowerCase() !== RECEIVER.toLowerCase()) {
    throw new PaymentVerificationError("Transfer recipient does not match.");
  }
  if (value !== PRICE_PER_QUERY) {
    throw new PaymentVerificationError("Transfer amount does not match.");
  }
  if (from.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new PaymentVerificationError("Transfer sender does not match connected wallet.");
  }

  const block = await rpcCall("eth_getBlockByNumber", [receipt.blockNumber, false]);
  const blockTimeMs = parseInt(block.timestamp, 16) * 1000;
  if (Date.now() - blockTimeMs > MAX_TX_AGE_MS) {
    throw new PaymentVerificationError("Transaction is too old.");
  }

  const claimed = await claimTxHash(txHash);
  if (!claimed) {
    throw new PaymentVerificationError("Transaction has already been used.");
  }
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
    const { message, history = [], txHash, walletAddress } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    if (typeof txHash !== "string" || !TX_HASH_RE.test(txHash)) {
      return NextResponse.json({ error: "Invalid or missing transaction hash." }, { status: 401 });
    }
    if (typeof walletAddress !== "string" || !ethers.isAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid or missing wallet address." }, { status: 401 });
    }

    try {
      await verifyPayment(txHash, walletAddress);
    } catch (err) {
      const message = err instanceof PaymentVerificationError ? err.message : "Payment verification failed.";
      console.error("Payment verification error:", err);
      return NextResponse.json({ error: message }, { status: 401 });
    }

    // The payment is verified and claimed at this point — from here on we
    // always return txHash so the user keeps proof of payment even if the
    // AI call fails.
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
      console.error("AI generation error (payment already verified):", err);
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
