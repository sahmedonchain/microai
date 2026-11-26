import { describe, it, expect } from "vitest";
import { buildQuoteQuery, buildSwapBody } from "@/lib/swap/proxy";
import type { SwapRecord } from "@/lib/swap/store";

// The request body below was captured from Circle's real swap-kit (v1.9.3) running
// in Node against Arc Mainnet with a throwaway key and all RPC blocked, on
// 2026-11-23. It checks that what the SDK really sends passes MicroAI's proxy rules.
const WALLET = "0xfdf9aED07B7E2Ea0c7242b156F3666dcf5Cbe0e3";
const TREASURY = "0x78c144a76614a8674285129810555c8bca78f044";
const record = { v: 1, id: "x", wallet: WALLET.toLowerCase(), network: "mainnet", from: "USDC", to: "EURC", amountIn: "100000000", expectedOut: "90970000", minOut: "90500000", feeUnits: "100000", feeToken: "input", feeMode: { percentageBps: 10 }, slippageBps: 50, feeRecipient: TREASURY, providerFeeUnits: "19980", gasUsd: null, route: "", status: "QUOTED", createdAt: "", expiresAt: "" } as SwapRecord;
const sdkBody = { tokenInAddress: "0x3600000000000000000000000000000000000000", tokenInChain: "Arc", tokenOutAddress: "0xbef5f6d51cb62b58e6a8f77868681825c6fe21c1", tokenOutChain: "Arc", fromAddress: WALLET, toAddress: WALLET, amount: "100000000", slippageBps: 50 };

describe("what Circle's real SDK sends", () => {
  it("passes the swap proxy rules, and gets the server's fee", () => {
    const out = buildSwapBody(sdkBody, record, TREASURY);
    expect(out.config).toEqual({ customFee: { percentageBps: 10, recipientAddress: TREASURY } });
    expect(out.fromAddress).toBe(record.wallet);
    expect(out.slippageBps).toBe(50);
  });
  it("the same shape as a quote query passes too", () => {
    const q = buildQuoteQuery(new URLSearchParams({ ...sdkBody, slippageBps: "50" }), record);
    expect(q.amount).toBe("100000000");
    expect(q.toAddress).toBe(record.wallet);
  });
  it("rejects the same body for another wallet", () => {
    expect(() => buildSwapBody({ ...sdkBody, fromAddress: "0x" + "11".repeat(20) }, record, TREASURY)).toThrow();
  });
});
