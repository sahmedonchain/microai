import { randomUUID } from "crypto";
import Groq from "groq-sdk";
import { ApiError, apiErrors, parseJson, withApi } from "@/lib/api";
import { getRedis } from "@/lib/redis";
import { getCredit, spendCredit } from "@/lib/credits";
import { buildSystemPrompt, detectMode, type Mode } from "@/lib/copilotPrompt";
import { copilotBody } from "@/lib/schemas";
import { createLogger } from "@/lib/logger";

// A full contract + deploy + frontend answer takes 20-40s to generate.
export const maxDuration = 60;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
    createLogger({ route: "copilot" }).error("continuation save failed", { err });
    return undefined;
  }
}

export const POST = withApi(
  { name: "copilot", auth: "required", limits: [{ limit: 10, windowSec: 60 }] },
  async ({ req, session, log }) => {
    const walletAddress = session!.sub;
    const body = await parseJson(req, copilotBody);

    // --- Continue a cut-off answer: no credit is spent -------------------
    if ("continueId" in body) {
      const state = await getRedis().getdel<ContinuationState>(continuationKey(body.continueId));
      if (!state || state.wallet !== walletAddress) {
        throw apiErrors.gone("This answer can no longer be continued. Ask again.");
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
        return {
          reply: text,
          credits: await getCredit(walletAddress),
          mode: state.mode,
          truncated,
          continueId,
        };
      } catch (err) {
        log.error("continuation error", { err });
        // Give the user another try with the same state; nothing was charged.
        const continueId = await saveContinuation(state);
        throw new ApiError(502, "upstream_unavailable", "Could not continue the answer. Try again.", { extra: { continueId } });
      }
    }

    // --- New request: spends one credit ----------------------------------
    const { message } = body;
    const remaining = await spendCredit(walletAddress);
    if (remaining === null) throw apiErrors.noCredits();

    // An explicit mode from the UI wins; keyword detection is the fallback.
    const mode: Mode = body.mode ?? detectMode(message);

    // Credit is already spent — always return remaining credit and mode so
    // the UI stays in sync even if the AI call fails.
    try {
      const { text, truncated } = await generate([
        { role: "system", content: buildSystemPrompt(mode) },
        { role: "user", content: message },
      ]);
      const continueId = truncated ? await saveContinuation({ wallet: walletAddress, mode, message, reply: text, n: 0 }) : undefined;
      return {
        reply: text || "Could not generate response.",
        credits: remaining,
        mode,
        truncated,
        continueId,
      };
    } catch (err) {
      log.error("AI generation error (credit already spent)", { err });
      return {
        reply: "Your credit was used, but the response could not be generated. Please contact support.",
        credits: remaining,
        mode,
      };
    }
  }
);
