import { ApiError, apiErrors, parseJson, withApi } from "@/lib/api";
import { QUOTE_TTL_SEC, SWAP_SLIPPAGE_BPS, SWAP_TOKENS, isSwapToken } from "@/lib/swap/config";
import { CircleError, circleCall, quoteQuery, readQuote } from "@/lib/swap/circle";
import { LIMIT_MESSAGES, checkAmount, minOutFor, planFee, toUnits } from "@/lib/swap/math";
import { quoteBody } from "@/lib/swap/schemas";
import { swapServerConfig } from "@/lib/swap/server-config";
import { newSwapId, saveSwap, usedToday, type SwapRecord } from "@/lib/swap/store";
import { quoteView } from "@/lib/swap/view";

// Quote for USDC <-> EURC. Nothing is sent or signed: the quote is fetched with
// the server's key, the fee and limits are worked out here, and the result is
// remembered so the confirm step can only run exactly what was shown.
export const POST = withApi(
  {
    name: "swap-quote",
    auth: "required",
    onLimiterError: "closed",
    limits: [
      { limit: 10, windowSec: 60 },
      { limit: 100, windowSec: 86_400 },
    ],
  },
  async ({ req, session, log }) => {
    if (!swapServerConfig()) throw new ApiError(503, "upstream_unavailable", "Swap is not available yet.");
    const b = await parseJson(req, quoteBody);
    if (!isSwapToken(b.fromToken) || !isSwapToken(b.toToken)) throw apiErrors.badRequest("Currently MicroAI supports USDC ↔ EURC swaps only.");
    if (b.fromToken === b.toToken) throw apiErrors.badRequest("Pick two different tokens.");
    const units = toUnits(b.amount);
    if (units === null) throw apiErrors.badRequest("Enter an amount such as 100 or 12.5 (at most 6 decimals).");
    const problem = checkAmount(units, await usedToday(session!.sub));
    if (problem) throw apiErrors.badRequest(LIMIT_MESSAGES[problem]);

    const tokenIn = SWAP_TOKENS[b.fromToken];
    const tokenOut = SWAP_TOKENS[b.toToken];
    let quote;
    try {
      const r = await circleCall("quote", { query: quoteQuery({ tokenIn: tokenIn.address, tokenOut: tokenOut.address, wallet: session!.sub, amount: units.toString(), slippageBps: SWAP_SLIPPAGE_BPS }) });
      if (r.status !== 200) {
        log.warn("swap quote refused", { status: r.status });
        throw apiErrors.upstream(r.status === 400 || r.status === 404 ? "No route was found for this swap right now. Try a different amount." : "The swap service is unavailable right now. Try again shortly.");
      }
      quote = readQuote(r.text);
    } catch (err) {
      if (err instanceof CircleError) throw apiErrors.upstream(err.message);
      throw err;
    }
    if (!quote) throw apiErrors.upstream("The swap service gave an answer MicroAI could not read. Try again shortly.");

    const fee = planFee(units);
    // A fee taken from the output comes off what the user receives.
    const off = quote.feeToken === "output" ? fee.units : BigInt(0);
    const expected = quote.estimatedAmount > off ? quote.estimatedAmount - off : BigInt(0);
    const minOut = quote.minAmount > off ? quote.minAmount - off : minOutFor(expected);
    const now = Date.now();
    const record: SwapRecord = {
      v: 1,
      id: newSwapId(),
      wallet: session!.sub,
      network: "mainnet",
      from: b.fromToken,
      to: b.toToken,
      amountIn: units.toString(),
      expectedOut: expected.toString(),
      minOut: minOut.toString(),
      feeUnits: fee.units.toString(),
      feeToken: quote.feeToken,
      feeMode: fee.mode,
      slippageBps: SWAP_SLIPPAGE_BPS,
      status: "QUOTED",
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + QUOTE_TTL_SEC * 1000).toISOString(),
    };
    await saveSwap(record);
    return { quote: quoteView(record) };
  }
);
