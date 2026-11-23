import { describe, it, expect } from "vitest";
import { parseSwapCommand } from "@/lib/swap/parse";
import { checkAmount, fromUnits, minOutFor, planFee, toUnits } from "@/lib/swap/math";

describe("swap command parser", () => {
  it.each([
    ["100 USDC to EURC", "100", "USDC", "EURC"],
    ["100 USDC থেকে EURC করো", "100", "USDC", "EURC"],
    ["Convert 100 USDC to EURC", "100", "USDC", "EURC"],
    ["Swap 100 USDC for EURC", "100", "USDC", "EURC"],
    ["50 EURC to USDC", "50", "EURC", "USDC"],
    ["50 EURC থেকে USDC করো", "50", "EURC", "USDC"],
    ["Swap 50 EURC for USDC", "50", "EURC", "USDC"],
    ["100 usdc থেকে eurc করো", "100", "USDC", "EURC"],
    ["swap 1,250.5 USDC to EURC", "1250.5", "USDC", "EURC"],
  ])("%s", (text, amount, from, to) => {
    expect(parseSwapCommand(text)).toEqual({ kind: "swap", amount, from, to });
  });

  it("asks when the amount is missing", () => {
    expect(parseSwapCommand("USDC to EURC")).toMatchObject({ kind: "clarify", question: "How much USDC would you like to swap to EURC?" });
  });
  it("asks when the target token is missing", () => {
    expect(parseSwapCommand("swap 100 USDC")).toMatchObject({ kind: "clarify" });
  });
  it("refuses other tokens", () => {
    expect(parseSwapCommand("100 USDC to USDT")).toEqual({ kind: "unsupported", message: "Currently MicroAI supports USDC ↔ EURC swaps only." });
    expect(parseSwapCommand("swap 5 DAI for EURC").kind).toBe("unsupported");
  });
  it("ignores ordinary chat and rejects same-token swaps", () => {
    expect(parseSwapCommand("hello there")).toEqual({ kind: "none" });
    expect(parseSwapCommand("")).toEqual({ kind: "none" });
    expect(parseSwapCommand("100 USDC to USDC").kind).toBe("clarify");
  });
  it("does not accept more than 6 decimals", () => {
    expect(parseSwapCommand("1.1234567 USDC to EURC").kind).toBe("clarify");
  });
});

describe("swap math", () => {
  it("converts units both ways", () => {
    expect(toUnits("100")).toBe(BigInt(100_000_000));
    expect(toUnits("0.000001")).toBe(BigInt(1));
    expect(toUnits("1.1234567")).toBeNull();
    expect(toUnits("-1")).toBeNull();
    expect(fromUnits(BigInt(99_800_000))).toBe("99.8");
    expect(fromUnits(BigInt(1))).toBe("0.000001");
  });
  it("fee is 0.10% with a $0.01 minimum", () => {
    expect(planFee(BigInt(1_000_000_000))).toEqual({ units: BigInt(1_000_000), mode: { percentageBps: 10 } });
    expect(planFee(BigInt(5_000_000))).toEqual({ units: BigInt(10_000), mode: { amount: "10000" } });
    expect(planFee(BigInt(10_000_000)).mode).toEqual({ percentageBps: 10 });
  });
  it("slippage floor is 0.50% under the estimate", () => {
    expect(minOutFor(BigInt(100_000_000))).toBe(BigInt(99_500_000));
  });
  it("enforces min, max and daily limits", () => {
    expect(checkAmount(BigInt(999_999))).toBe("below_min");
    expect(checkAmount(BigInt(1_000_000))).toBeNull();
    expect(checkAmount(BigInt(1_000_000_001))).toBe("above_max");
    expect(checkAmount(BigInt(1_000_000_000), BigInt(4_500_000_000))).toBe("daily_exceeded");
    expect(checkAmount(BigInt(500_000_000), BigInt(4_500_000_000))).toBeNull();
  });
});
