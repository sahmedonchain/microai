import { ApiError, apiErrors, parseJson, withApi } from "@/lib/api";
import { RpcError } from "@/lib/arcRpc";
import { gasBalance, tokenBalance } from "@/lib/swap/chain";
import { providerFee } from "@/lib/swap/validate";
import { MIN_GAS_WEI, QUOTE_TTL_SEC, SWAP_SLIPPAGE_BPS, SWAP_TOKENS, isSwapToken } from "@/lib/swap/config";
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

    const cfg = swapServerConfig()!;
    const tokenIn = SWAP_TOKENS[b.fromToken];
    const tokenOut = SWAP_TOKENS[b.toToken];
    const t0 = Date.now();
    // The quote and the wallet pre-checks do not depend on each other, so they run together.
    const [circleResult, balances] = await Promise.all([
      circleCall("quote", { query: quoteQuery({ tokenIn: tokenIn.address, tokenOut: tokenOut.address, wallet: session!.sub, amount: units.toString(), slippageBps: SWAP_SLIPPAGE_BPS }) }).then(
        (r) => ({ r, ms: Date.now() - t0 }),
        (err: unknown) => ({ err })
      ),
      Promise.all([tokenBalance(tokenIn.address, session!.sub), gasBalance(session!.sub)]).then(
        (v) => ({ v, ms: Date.now() - t0 }),
        (err: unknown) => ({ err })
      ),
    ]);
    if ("err" in balances) {
      if (balances.err instanceof RpcError) throw apiErrors.upstream("Arc RPC is unavailable right now, so your balance could not be checked. Try again shortly.");
      throw balances.err;
    }
    if (balances.v[0] < units) throw apiErrors.badRequest(`Insufficient ${b.fromToken} balance for this swap.`);
    if (balances.v[1] < MIN_GAS_WEI) throw apiErrors.badRequest("Not enough USDC in your wallet to pay network gas. Keep at least 0.02 USDC.");

    if ("err" in circleResult) {
      if (circleResult.err instanceof CircleError) throw apiErrors.upstream(circleResult.err.message);
      throw circleResult.err;
    }
    if (circleResult.r.status !== 200) {
      log.warn("swap quote refused", { status: circleResult.r.status });
      throw apiErrors.upstream(circleResult.r.status === 400 || circleResult.r.status === 404 ? "No route was found for this swap right now. Try a different amount." : "The swap service is unavailable right now. Try again shortly.");
    }
    const quote = readQuote(circleResult.r.text);
    if (!quote) throw apiErrors.upstream("The swap service gave an answer MicroAI could not read. Try again shortly.");

    const fee = planFee(units);
    let expected: bigint;
    let minOut: bigint;
    if (quote.feeToken === "output") {
      // A fee taken from the output comes off what the user receives.
      expected = quote.estimatedAmount > fee.units ? quote.estimatedAmount - fee.units : BigInt(0);
      minOut = quote.minAmount > fee.units ? quote.minAmount - fee.units : minOutFor(expected);
    } else {
      // A fee taken from the input leaves less to swap. Circle's estimate is for the full amount, so it is scaled to what is left.
      const net = units - fee.units;
      expected = (quote.estimatedAmount * net) / units;
      minOut = (quote.minAmount * net) / units;
    }
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
      feeRecipient: cfg.treasury,
      providerFeeUnits: providerFee(units, fee.units).toString(),
      gasUsd: quote.gasUsd,
      route: quote.route,
      status: "QUOTED",
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + QUOTE_TTL_SEC * 1000).toISOString(),
    };
    await saveSwap(record);
    return { quote: quoteView(record), timings: { quoteMs: circleResult.ms, balanceMs: balances.ms, totalMs: Date.now() - t0 } };
  }
);
