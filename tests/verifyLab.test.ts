import { describe, it, expect } from "vitest";
import { LAB_SCENARIOS, LAB_RECIPIENT, LAB_OTHER_RECIPIENT, LAB_PRICE_UNITS, TESTNET_USDC, TESTNET_EURC, TESTNET_CHAIN_PARAMS, encodeErc20Transfer, tokenAddress, verifyLink, walletErrorMessage } from "@/lib/verify/lab";
import { parsePrefill } from "@/lib/verify/ui";
import { verifyTransaction, type TxReceipt } from "@/lib/verify/txVerify";
import { findLabCase, buildLabAnswer } from "@/lib/verify/labFixtures";
import { verifyEndpointResponse } from "@/lib/verify/checks";
import { ERC20_TRANSFER_TOPIC } from "@/lib/arcConfig";

describe("encodeErc20Transfer", () => {
  it("encodes transfer(address,uint256) as 4 + 32 + 32 bytes", () => {
    const data = encodeErc20Transfer(LAB_RECIPIENT, "10000");
    expect(data).toBe("0xa9059cbb" + "0".repeat(24) + "1".repeat(40) + "0".repeat(60) + "2710");
    expect(data.length).toBe(2 + 8 + 64 + 64);
  });

  it("lower-cases the address and handles the largest amounts", () => {
    const upper = "0xAbCdEf0123456789aBcDeF0123456789AbCdEf01";
    expect(encodeErc20Transfer(upper, "1")).toContain(upper.slice(2).toLowerCase());
    expect(encodeErc20Transfer(LAB_RECIPIENT, "115792089237316195423570985008687907853269984665640564039457584007913129639935").length).toBe(2 + 8 + 128);
  });

  it.each([["0x123", "1"], ["not an address", "1"], [LAB_RECIPIENT, "-1"], [LAB_RECIPIENT, "1.5"], [LAB_RECIPIENT, ""], [LAB_RECIPIENT, "115792089237316195423570985008687907853269984665640564039457584007913129639936"]])("rejects %j %j", (to, units) => {
    expect(() => encodeErc20Transfer(to, units)).toThrow();
  });
});

describe("lab scenarios", () => {
  it("uses the Testnet token addresses from the registry and only Testnet chain parameters", () => {
    expect(tokenAddress("USDC")).toBe(TESTNET_USDC);
    expect(tokenAddress("EURC")).toBe(TESTNET_EURC);
    expect(TESTNET_CHAIN_PARAMS.chainId).toBe("0x4cef52");
    expect(TESTNET_CHAIN_PARAMS.rpcUrls[0]).toContain("testnet");
  });

  it("has five distinct scenarios with amounts well under a cent's worth of real value", () => {
    expect(new Set(LAB_SCENARIOS.map((s) => s.id)).size).toBe(5);
    for (const s of LAB_SCENARIOS) expect(Number(s.units)).toBeLessThanOrEqual(20000);
  });

  it("only ever pays the two fixed lab addresses", () => {
    for (const s of LAB_SCENARIOS) expect([LAB_RECIPIENT, LAB_OTHER_RECIPIENT]).toContain(s.to);
  });

  it("the lab endpoint asks for the amount and recipient the scenarios are built around", () => {
    const a = buildLabAnswer(findLabCase("good")!);
    const accepts = JSON.parse(a.body).accepts[0];
    expect(accepts.amount).toBe(LAB_PRICE_UNITS);
    expect(accepts.payTo).toBe(LAB_RECIPIENT);
    expect(accepts.network).toBe("eip155:5042002");
  });

  it("each scenario's promised verdict is what Verify's transaction check really gives", async () => {
    const HASH = "0x" + "ab".repeat(32);
    const pad = (a: string) => "0x" + "0".repeat(24) + a.slice(2);
    const asked = JSON.parse(buildLabAnswer(findLabCase("good")!).body).accepts[0];
    // The endpoint's own ask is what the transaction is compared with, as in /api/verify.
    const expected = { network: "testnet" as const, asset: asked.asset.toLowerCase(), payTo: asked.payTo.toLowerCase(), amount: BigInt(asked.amount) };
    const titles: Record<string, string> = {};
    for (const s of LAB_SCENARIOS) {
      const receipt: TxReceipt = {
        transactionHash: HASH,
        status: "0x1",
        blockNumber: "0x10",
        logs: [
          {
            address: tokenAddress(s.token),
            topics: [ERC20_TRANSFER_TOPIC, pad("0x" + "9".repeat(40)), pad(s.to)],
            data: "0x" + BigInt(s.units).toString(16).padStart(64, "0"),
          },
        ],
      };
      const r = await verifyTransaction(HASH, expected, async () => receipt);
      const judged = r.findings.find((f) => f.id.startsWith("tx.") && f.id !== "tx.status" && f.id !== "tx.sender")!;
      titles[s.id] = `${judged.severity}: ${judged.title}`;
      expect(judged.severity, s.id).toBe(s.severity);
      // The text shown on the lab page must match the real title word for word.
      expect(s.expected.toLowerCase(), s.id).toContain(judged.title.toLowerCase().replace(/^paid exactly .* to the recipient$/, "paid exactly 0.01 usdc to the recipient"));
    }
    expect(Object.keys(titles)).toHaveLength(5);
  });

  it("the same Testnet payment checked against Mainnet is caught as the wrong network", async () => {
    const HASH = "0x" + "cd".repeat(32);
    const receipt: TxReceipt = { transactionHash: HASH, status: "0x1", blockNumber: "0x1", logs: [] };
    const r = await verifyTransaction(
      HASH,
      { network: "mainnet", asset: TESTNET_USDC.toLowerCase(), payTo: LAB_RECIPIENT, amount: BigInt(LAB_PRICE_UNITS) },
      async (_h, net) => (net === "testnet" ? receipt : null)
    );
    expect(r.findings[0].title).toBe("Transaction is on Arc Testnet, not Arc Mainnet");
  });
});

describe("verifyLink and parsePrefill", () => {
  const HASH = "0x" + "ab".repeat(32);

  it("builds a link that parsePrefill reads back (endpoint form)", () => {
    const link = verifyLink("https://microai.example", { txHash: HASH, network: "testnet", useEndpoint: true });
    const p = parsePrefill(link.slice(link.indexOf("?")));
    expect(p).toEqual({ url: "https://microai.example/api/lab/x402/good", tx: HASH, network: "testnet", run: true });
  });

  it("builds a link that parsePrefill reads back (expect form)", () => {
    const link = verifyLink("https://microai.example", { txHash: HASH, network: "mainnet", useEndpoint: false });
    const p = parsePrefill(link.slice(link.indexOf("?")));
    expect(p).toEqual({ tx: HASH, network: "mainnet", to: LAB_RECIPIENT, amount: "0.01", run: true });
  });

  it("ignores anything that does not look valid and never runs without run=1", () => {
    const p = parsePrefill("?url=http://insecure.example&tx=0x12&network=solana&to=abc&amount=-1");
    expect(p).toEqual({ run: false });
    expect(parsePrefill("?url=https://a.example/x").run).toBe(false);
    expect(parsePrefill("").run).toBe(false);
  });

  it("the lab endpoint is itself fine for the Verify engine", () => {
    const a = buildLabAnswer(findLabCase("good")!);
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(a.headers)) headers[k.toLowerCase()] = v;
    expect(verifyEndpointResponse({ status: a.status, headers, body: a.body }).counts.error).toBe(0);
  });
});

describe("walletErrorMessage", () => {
  it("explains the EIP-1193 codes in plain words", () => {
    expect(walletErrorMessage({ code: 4001 })).toBe("You rejected the request in your wallet.");
    expect(walletErrorMessage({ code: 4100, message: "The requested account and/or method has not been authorized by the user." })).toContain("Click Connect wallet again");
    expect(walletErrorMessage({ code: -32002 })).toContain("already has a request waiting");
    expect(walletErrorMessage({ code: 4902 })).toContain("Arc Testnet");
  });

  it("falls back to the wallet's own message, shortened, and never throws", () => {
    expect(walletErrorMessage(new Error("boom"))).toBe("boom");
    expect(walletErrorMessage({ message: "x".repeat(500) }).length).toBe(200);
    expect(walletErrorMessage(null)).toBe("Something went wrong.");
    expect(walletErrorMessage(undefined)).toBe("Something went wrong.");
  });
});
