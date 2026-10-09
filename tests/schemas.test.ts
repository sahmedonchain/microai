import { describe, it, expect } from "vitest";
import { copilotBody, githubStatusQuery, purchaseBody, sessionPostBody, walletBody, debugAnalyzeBody } from "@/lib/schemas";

const HASH = "0x" + "a".repeat(64);
const ADDR = "0x" + "b".repeat(40);

describe("request schemas", () => {
  it("accepts and trims a tx hash, rejects malformed ones", () => {
    expect(debugAnalyzeBody.parse({ txHash: ` ${HASH} ` }).txHash).toBe(HASH);
    expect(debugAnalyzeBody.safeParse({ txHash: "0x123" }).success).toBe(false);
    expect(debugAnalyzeBody.safeParse({}).success).toBe(false);
  });

  it("validates wallet addresses", () => {
    expect(walletBody.safeParse({ address: ADDR }).success).toBe(true);
    expect(walletBody.safeParse({ address: ADDR.slice(0, 20) }).success).toBe(false);
  });

  it("bounds the purchase query count to integers 1..1000", () => {
    expect(purchaseBody.safeParse({ txHash: HASH, queries: 1 }).success).toBe(true);
    expect(purchaseBody.safeParse({ txHash: HASH, queries: 1000 }).success).toBe(true);
    for (const queries of [0, 1001, 1.5, "5", null]) expect(purchaseBody.safeParse({ txHash: HASH, queries }).success).toBe(false);
  });

  it("only allows tracked GitHub repos (case-insensitive)", () => {
    expect(githubStatusQuery.safeParse({ repo: "circlefin/arc-escrow" }).success).toBe(true);
    expect(githubStatusQuery.safeParse({ repo: "CIRCLEFIN/ARC-ESCROW" }).success).toBe(true);
    expect(githubStatusQuery.safeParse({ repo: "evil/repo" }).success).toBe(false);
  });

  it("copilot body is either a continuation or a message with a known mode", () => {
    expect(copilotBody.safeParse({ continueId: "abc" }).success).toBe(true);
    expect(copilotBody.safeParse({ message: "hi", mode: "CONTRACT" }).success).toBe(true);
    expect(copilotBody.safeParse({ message: "hi", mode: "NOPE" }).success).toBe(false);
    expect(copilotBody.safeParse({ message: "" }).success).toBe(false);
    expect(copilotBody.safeParse({ message: "x".repeat(4001) }).success).toBe(false);
  });

  it("session POST needs address, 65-byte signature, optional message", () => {
    const signature = "0x" + "c".repeat(130);
    expect(sessionPostBody.safeParse({ address: ADDR, signature, message: "m" }).success).toBe(true);
    expect(sessionPostBody.safeParse({ address: ADDR, signature: "0x12" }).success).toBe(false);
  });
});
