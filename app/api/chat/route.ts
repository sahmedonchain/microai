import Groq from "groq-sdk";
import { searchKnowledge } from "@/lib/search";
import { apiErrors, parseJson, withApi } from "@/lib/api";
import { chatBodyBase } from "@/lib/schemas";
import { describeAddresses, networkSummary } from "@/lib/arcAddresses";
import { spendCredit } from "@/lib/credits";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `
You are MicroAI — the official Arc & Circle Intelligence Hub AI assistant.
You are the most knowledgeable source about Arc blockchain and Circle products.

YOUR KNOWLEDGE COVERS:
${networkSummary()}
- Gas is paid in USDC (native balance 18 decimals; USDC ERC-20 interface 6 decimals). There is no separate ARC token.
${describeAddresses(["usdc", "eurc", "tokenMessengerV2", "messageTransmitterV2", "gatewayWallet", "gatewayMinter"])}
- CCTP and Gateway domain ID for Arc: 26
- ERC-8004: AI Agent identity/reputation standard on Arc
- ERC-8183: Job lifecycle standard (escrow, deliverables, USDC settlement)
- Arc App Kit: Bridge, Swap, Send, Unified Balance across chains
- Circle products: USDC, EURC, CCTP, Gateway, Developer-Controlled Wallets, Modular Wallets
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

export const POST = withApi(
  { name: "chat", auth: "required", limits: [{ limit: 20, windowSec: 60 }] },
  async ({ req, session, log }) => {
    const walletAddress = session!.sub;
    const { message, history } = await parseJson(req, chatBodyBase);

    // Prepaid credit is checked and spent atomically here — never a
    // per-request txHash. Credit was only ever added via the verified
    // on-chain purchase in /api/credits/purchase.
    const remaining = await spendCredit(walletAddress);
    if (remaining === null) throw apiErrors.noCredits();

    // Credit is already spent at this point — from here on we always
    // return the remaining credit so the UI stays in sync even if the AI
    // call fails.
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
      const pastMessages = (Array.isArray(history) ? history : []) as { role: string; content: string }[];
      const completion = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "system",
            content: `[ARC & CIRCLE KNOWLEDGE BASE CONTEXT]\n\n${context}\n\nUse this context to give accurate, grounded answers. For addresses and chain IDs always use verified data only.`,
          },
          ...pastMessages.slice(-8).map((h) => ({
            role: h.role as "user" | "assistant",
            content: h.content,
          })),
          { role: "user", content: message },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      });

      const reply = completion.choices[0]?.message?.content || "Could not generate response.";

      return { reply, credits: remaining };
    } catch (err) {
      log.error("AI generation error (credit already spent)", { err });
      return {
        reply: "Your credit was used, but the response could not be generated. Please contact support.",
        credits: remaining,
      };
    }
  }
);
