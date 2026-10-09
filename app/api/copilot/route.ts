import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Groq from "groq-sdk";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { spendCredit } from "@/lib/credits";
import { checkRateLimit } from "@/lib/rateLimit";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MAX_MESSAGE_LENGTH = 4000;
const COPILOT_RATE_LIMIT = 10; // requests
const COPILOT_RATE_WINDOW_MS = 60_000; // per minute, per wallet

type Mode =
  | "ARCHITECT"
  | "CONTRACT"
  | "USDC"
  | "CIRCLE"
  | "DEPLOY"
  | "AUDIT"
  | "SIMULATE"
  | "DEBUG"
  | "MIGRATE"
  | "GENERAL";

// Order matters: first match wins, so more specific intents come first.
const MODE_PATTERNS: [Mode, RegExp][] = [
  ["AUDIT", /\b(audit|vulnerab\w*|security review|reentran\w*|exploit|attack surface)\b/i],
  ["MIGRATE", /\b(migrat\w*|port (this|my)|move (from|to)|from (ethereum|polygon|base|solana|arbitrum|optimism)\b.*\bto arc)\b/i],
  ["DEBUG", /\b(debug|error|revert\w*|fail(s|ed|ing)?|bug|stack ?trace|exception|not working|broken)\b/i],
  ["SIMULATE", /\b(simulate|simulation|dry[- ]run|estimate gas|gas estimate|eth_call|fork test|what happens if)\b/i],
  ["DEPLOY", /\b(deploy\w*|hardhat|foundry|forge|verify contract|constructor args|mainnet launch)\b/i],
  ["CIRCLE", /\b(circle|cctp|gateway|developer[- ]controlled|modular wallets?|bridge|cross[- ]chain|app kit)\b/i],
  ["USDC", /\b(usdc|eurc|stablecoin|transfer(From)?|permit|approve|allowance|payment|erc-?20)\b/i],
  ["CONTRACT", /\b(smart contract|solidity|contract|erc-?8004|erc-?8183|erc-?721|erc-?1155|escrow|modifier|openzeppelin)\b/i],
  ["ARCHITECT", /\b(architect\w*|system design|design a|how should i (build|structure)|stack|infrastructure|diagram|high[- ]level)\b/i],
];

function detectMode(message: string): Mode {
  for (const [mode, pattern] of MODE_PATTERNS) {
    if (pattern.test(message)) return mode;
  }
  return "GENERAL";
}

const BASE_PROMPT = `
You are MicroAI Copilot — an AI Software Engineer for the Arc blockchain.
You help developers design, write, deploy, audit and debug production-grade software on Arc using USDC, EURC and Circle products.

VERIFIED ARC FACTS (the ONLY addresses and parameters you may use):
- Arc Mainnet chain ID: 5042 (0x13b2)
- RPC: https://rpc.mainnet.arc.io
- USDC: 0x3600000000000000000000000000000000000000 (6 decimals as ERC-20)
- EURC: 0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1
- CCTP TokenMessengerV2: 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA
- ERC-8004: AI agent identity and reputation standard
- ERC-8183: job lifecycle standard (escrow, deliverables, USDC settlement)

HARD RULES:
1. NEVER guess or invent addresses, chain IDs, RPC URLs or ABIs. Use only the verified values above.
2. If you need an address that is not listed, use a clearly named placeholder (e.g. TOKEN_ADDRESS_TODO) and tell the user to confirm it at docs.arc.io or developers.circle.com.
3. Code must be complete, compilable and use current best practices (Solidity ^0.8.x, viem/ethers v6 for TypeScript).
4. State assumptions explicitly. Flag anything unverified.
5. Be concise and technical. No filler.
`;

const MODE_FORMATS: Record<Mode, string> = {
  ARCHITECT: `MODE: ARCHITECT
Output format:
**Architecture Overview** — 2-3 lines
**Components** — bullet list (on-chain / off-chain / data)
**Data Flow** — numbered steps, include USDC/EURC flow where relevant
**Diagram** — ASCII diagram in a code block
**Trade-offs and Risks**
**Next Steps**`,
  CONTRACT: `MODE: CONTRACT
Output format:
**Contract Design** — purpose, roles, state, events
**Solidity Code** — one complete \`solidity\` block with SPDX header, NatSpec, custom errors, events
**Usage Notes** — how to call it, ERC-8004 / ERC-8183 integration points if relevant
**Tests to Write** — short list`,
  USDC: `MODE: USDC
Output format:
**Key Facts** — USDC/EURC address, decimals (6), native-vs-ERC-20 decimal caveat if relevant
**Code** — complete TypeScript (viem) and/or Solidity block; always handle 6-decimal amounts explicitly
**Pitfalls** — approvals, rounding, decimals`,
  CIRCLE: `MODE: CIRCLE
Output format:
**Product Fit** — which Circle product (CCTP, Gateway, Developer-Controlled Wallets, Modular Wallets, App Kit) and why
**Flow** — numbered steps; for CCTP use the verified TokenMessengerV2 address
**Code** — complete TypeScript block
**Docs** — developers.circle.com and docs.arc.io pointers`,
  DEPLOY: `MODE: DEPLOY
Output format:
**Prerequisites** — tooling, env vars, funded deployer
**Config** — hardhat or foundry config with chain ID 5042 and RPC https://rpc.mainnet.arc.io
**Deploy Script** — complete code block
**Verification and Post-Deploy Checks** — checklist
**Rollback / Safety Notes**`,
  AUDIT: `MODE: AUDIT
Output format:
**Summary** — one-paragraph risk assessment
**Findings** — each as: [SEVERITY: Critical/High/Medium/Low/Info] Title — Location — Issue — Fix (with patched code)
**Checks Passed**
**Recommendations**
State clearly that this is an automated review, not a substitute for a professional audit.`,
  SIMULATE: `MODE: SIMULATE
Output format:
**Scenario** — restate inputs and assumptions
**Simulation Method** — eth_call / fork / unit test approach against https://rpc.mainnet.arc.io
**Code** — complete script or test block
**Expected Outcome** — step-by-step state changes, gas notes
Never present estimates as real on-chain results.`,
  DEBUG: `MODE: DEBUG
Output format:
**Root Cause** — most likely cause in 1-2 lines
**Evidence** — what in the input points to it
**Fix** — corrected code in a block
**How to Verify** — exact commands or checks
**Other Possible Causes** — ranked, brief`,
  MIGRATE: `MODE: MIGRATE
Output format:
**Migration Summary** — source chain vs Arc differences that matter
**Changes Required** — table or list: address swaps (use verified Arc addresses), chain ID 5042, RPC, decimals, gas/fee model
**Migrated Code** — complete block
**Cutover Plan** — ordered steps with rollback
**Risks**`,
  GENERAL: `MODE: GENERAL
Output format:
**Answer** — direct and complete
**Code** — only if useful, complete block
**Docs** — docs.arc.io / developers.circle.com pointers`,
};

export async function POST(req: Request) {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    const session = token ? verifySessionToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: "session_required" }, { status: 401 });
    }
    const walletAddress = session.sub;

    if (!checkRateLimit(`copilot:${walletAddress}`, COPILOT_RATE_LIMIT, COPILOT_RATE_WINDOW_MS)) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down and try again shortly." },
        { status: 429 }
      );
    }

    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` },
        { status: 400 }
      );
    }

    const remaining = await spendCredit(walletAddress);
    if (remaining === null) {
      return NextResponse.json({ error: "no_credits" }, { status: 402 });
    }

    const mode = detectMode(message);

    // Credit is already spent — always return remaining credit and mode so
    // the UI stays in sync even if the AI call fails.
    try {
      const completion = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: `${BASE_PROMPT}\n${MODE_FORMATS[mode]}` },
          { role: "user", content: message },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      });

      const reply = completion.choices[0]?.message?.content || "Could not generate response.";
      return NextResponse.json({ reply, credits: remaining, mode });
    } catch (err) {
      console.error("Copilot AI generation error (credit already spent):", err);
      return NextResponse.json({
        reply: "Your credit was used, but the response could not be generated. Please contact support.",
        credits: remaining,
        mode,
      });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ reply: "Server error occurred." }, { status: 500 });
  }
}
