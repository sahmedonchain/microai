import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import Groq from "groq-sdk";
import { Redis } from "@upstash/redis";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { getCredit, spendCredit } from "@/lib/credits";
import { checkRateLimit } from "@/lib/rateLimit";
import { buildSystemPrompt, detectMode, isMode, type Mode } from "@/lib/copilotPrompt";

// A full contract + deploy + frontend answer takes 20-40s to generate.
export const maxDuration = 60;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MAX_MESSAGE_LENGTH = 4000;
const COPILOT_RATE_LIMIT = 10; // requests
const COPILOT_RATE_WINDOW_MS = 60_000; // per minute, per wallet

// gpt-oss is a reasoning model: reasoning tokens count against the output
// limit. The old 2000-token cap cut long answers off mid-sentence
// (finish_reason "length"). A complete contract + deploy + frontend answer
// needs ~4000, so leave generous headroom and keep reasoning short.
const MAX_OUTPUT_TOKENS = 8000;

// A cut-off answer can be continued for free, once per stored state and at
// most MAX_CONTINUATIONS times per paid request.
const MAX_CONTINUATIONS = 3;
const CONTINUATION_TTL_SECONDS = 15 * 60;

interface ContinuationState {
  wallet: string;
  mode: Mode;
  message: string;
  reply: string; // everything generated so far for this answer
  n: number; // continuations already used
}

let redisClient: Redis | null = null;
function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redisClient;
}

function continuationKey(id: string) {
  return `microai:copilot:cont:${id}`;
}

async function generate(messages: { role: "system" | "user" | "assistant"; content: string }[]) {
  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages,
    temperature: 0.1,
    max_completion_tokens: MAX_OUTPUT_TOKENS,
    reasoning_effort: "low",
  });
  const choice = completion.choices[0];
  return {
    text: choice?.message?.content || "",
    truncated: choice?.finish_reason === "length",
  };
}

// Remember a cut-off answer so the user can continue it without paying again.
// The state is server-side and consumed with GETDEL, so a continuation id
// cannot be replayed, forged, or used by another wallet.
async function saveContinuation(state: ContinuationState): Promise<string | undefined> {
  if (state.n >= MAX_CONTINUATIONS) return undefined;
  try {
    const id = randomUUID();
    await getRedis().set(continuationKey(id), state, { ex: CONTINUATION_TTL_SECONDS });
    return id;
  } catch (err) {
    console.error("Copilot continuation save failed:", err);
    return undefined;
  }
}

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

    const body = await req.json();

    // --- Continue a cut-off answer: no credit is spent -------------------
    if (typeof body?.continueId === "string") {
      const state = await getRedis().getdel<ContinuationState>(continuationKey(body.continueId));
      if (!state || state.wallet !== walletAddress) {
        return NextResponse.json({ error: "This answer can no longer be continued. Ask again." }, { status: 410 });
      }
      try {
        const { text, truncated } = await generate([
          { role: "system", content: buildSystemPrompt(state.mode) },
          { role: "user", content: state.message },
          { role: "assistant", content: state.reply },
          {
            role: "user",
            content:
              "Your previous answer was cut off by the length limit. Continue exactly where it stopped, character for character, without repeating anything already written and without any preamble. If you stopped inside a code block, continue the raw code directly: do NOT open a new code fence at the start, and close the block with a closing fence when that code ends.",
          },
        ]);
        const continueId = truncated
          ? await saveContinuation({ ...state, reply: state.reply + text, n: state.n + 1 })
          : undefined;
        return NextResponse.json({
          reply: text,
          credits: await getCredit(walletAddress),
          mode: state.mode,
          truncated,
          continueId,
        });
      } catch (err) {
        console.error("Copilot continuation error:", err);
        // Give the user another try with the same state; nothing was charged.
        const continueId = await saveContinuation(state);
        return NextResponse.json(
          { error: "Could not continue the answer. Try again.", continueId },
          { status: 502 }
        );
      }
    }

    // --- New request: spends one credit ----------------------------------
    const message = body?.message;
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

    // An explicit mode from the UI wins; keyword detection is the fallback.
    const mode: Mode = isMode(body?.mode) ? body.mode : detectMode(message);

    // Credit is already spent — always return remaining credit and mode so
    // the UI stays in sync even if the AI call fails.
    try {
      const { text, truncated } = await generate([
        { role: "system", content: buildSystemPrompt(mode) },
        { role: "user", content: message },
      ]);
      const continueId = truncated ? await saveContinuation({ wallet: walletAddress, mode, message, reply: text, n: 0 }) : undefined;
      return NextResponse.json({
        reply: text || "Could not generate response.",
        credits: remaining,
        mode,
        truncated,
        continueId,
      });
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
