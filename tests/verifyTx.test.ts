import { describe, it, expect } from "vitest";
import { verifyTransaction, type ExpectedPayment, type ReceiptFetcher, type TxReceipt } from "@/lib/verify/txVerify";
import { ARC_ADDRESSES } from "@/lib/arcAddresses";
import { ERC20_TRANSFER_TOPIC, USDC_ADDRESS, type ArcNetworkId } from "@/lib/arcConfig";
import type { Finding } from "@/lib/verify/types";

// MOCK: receipts are supplied by a fake fetcher; nothing touches the chain.

const HASH = "0x" + "ab".repeat(32);
const USDC = USDC_ADDRESS.toLowerCase();
const EURC = ARC_ADDRESSES.eurc.mainnet.toLowerCase();
const PAYEE = "0x1111111111111111111111111111111111111111";
const PAYER = "0x2222222222222222222222222222222222222222";
const ELSE = "0x3333333333333333333333333333333333333333";

const pad = (a: string) => "0x" + "0".repeat(24) + a.slice(2);
const log = (token: string, from: string, to: string, value: string, over: Record<string, unknown> = {}) => ({
  address: token,
  topics: [ERC20_TRANSFER_TOPIC, pad(from), pad(to)],
  data: "0x" + BigInt(value).toString(16).padStart(64, "0"),
  ...over,
});
const receipt = (logs: unknown[], over: Partial<TxReceipt> = {}): TxReceipt => ({ transactionHash: HASH, status: "0x1", blockNumber: "0x10", logs: logs as TxReceipt["logs"], ...over });

const want = (over: Partial<ExpectedPayment> = {}): ExpectedPayment => ({ network: "mainnet", asset: USDC, payTo: PAYEE, amount: BigInt("10000"), ...over });
const fetcherFor = (byNet: Partial<Record<ArcNetworkId, TxReceipt | null | "throw">>): ReceiptFetcher => async (_hash, net) => {
  const v = byNet[net];
  if (v === "throw") throw new Error("rpc down");
  return v ?? null;
};

const byId = (fs: Finding[], id: string) => fs.filter((f) => f.id === id);
const sevs = (fs: Finding[], id: string) => byId(fs, id).map((f) => f.severity);

describe("verifyTransaction: matching payments", () => {
  it("an exact payment to the recipient has no errors and no warnings", async () => {
    const r = await verifyTransaction(HASH, want(), fetcherFor({ mainnet: receipt([log(USDC, PAYER, PAYEE, "10000")]) }));
    expect(r.findings.some((f) => f.severity === "error" || f.severity === "warning")).toBe(false);
    expect(sevs(r.findings, "tx.amount")).toEqual(["ok"]);
    expect(byId(r.findings, "tx.amount")[0].title).toBe("Paid exactly 0.01 USDC to the recipient");
    expect(sevs(r.findings, "tx.status")).toEqual(["ok"]);
    expect(sevs(r.findings, "tx.sender")).toEqual(["info"]);
  });

  it("links to the right explorer for the network", async () => {
    const main = await verifyTransaction(HASH, want(), fetcherFor({ mainnet: receipt([log(USDC, PAYER, PAYEE, "10000")]) }));
    expect(main.explorerUrl).toBe(`https://explorer.arc.io/tx/${HASH}`);
    const test = await verifyTransaction(HASH, want({ network: "testnet" }), fetcherFor({ testnet: receipt([log(USDC, PAYER, PAYEE, "10000")]) }));
    expect(test.explorerUrl).toBe(`https://explorer.testnet.arc.io/tx/${HASH}`);
  });

  it("two transfers to the recipient are added together", async () => {
    const r = await verifyTransaction(HASH, want(), fetcherFor({ mainnet: receipt([log(USDC, PAYER, PAYEE, "4000"), log(USDC, PAYER, PAYEE, "6000")]) }));
    expect(sevs(r.findings, "tx.amount")).toEqual(["ok"]);
  });

  it("ignores transfers to others when the recipient was also paid", async () => {
    const r = await verifyTransaction(HASH, want(), fetcherFor({ mainnet: receipt([log(USDC, PAYER, ELSE, "999"), log(USDC, PAYER, PAYEE, "10000")]) }));
    expect(sevs(r.findings, "tx.amount")).toEqual(["ok"]);
  });
});

describe("verifyTransaction: amount mistakes", () => {
  it("paying less is an error with both numbers", async () => {
    const r = await verifyTransaction(HASH, want(), fetcherFor({ mainnet: receipt([log(USDC, PAYER, PAYEE, "9000")]) }));
    const f = byId(r.findings, "tx.amount")[0];
    expect(f.severity).toBe("error");
    expect(f.evidence).toContain("paid 0.009");
    expect(f.evidence).toContain("required 0.01");
  });

  it("paying more is a warning", async () => {
    const r = await verifyTransaction(HASH, want(), fetcherFor({ mainnet: receipt([log(USDC, PAYER, PAYEE, "10001")]) }));
    expect(sevs(r.findings, "tx.amount")).toEqual(["warning"]);
  });

  it("a required amount 10^12 times the paid one is caught as an 18-decimal price", async () => {
    const r = await verifyTransaction(HASH, want({ amount: BigInt("10000000000000000") }), fetcherFor({ mainnet: receipt([log(USDC, PAYER, PAYEE, "10000")]) }));
    const f = byId(r.findings, "tx.amount")[0];
    expect(f.severity).toBe("error");
    expect(f.title).toContain("10^12");
    expect(f.fix).toContain('"10000"');
  });
});

describe("verifyTransaction: wrong destination or token", () => {
  it("a payment to someone else is an error that names where it went", async () => {
    const r = await verifyTransaction(HASH, want(), fetcherFor({ mainnet: receipt([log(USDC, PAYER, ELSE, "10000")]) }));
    const f = byId(r.findings, "tx.recipient")[0];
    expect(f.severity).toBe("error");
    expect(f.reason).toContain("0x3333...3333");
  });

  it("paying the recipient in another token is an error", async () => {
    const r = await verifyTransaction(HASH, want(), fetcherFor({ mainnet: receipt([log(EURC, PAYER, PAYEE, "10000")]) }));
    expect(sevs(r.findings, "tx.token")).toEqual(["error"]);
    expect(byId(r.findings, "tx.token")[0].title).toBe("The recipient was paid in a different token");
  });

  it("a successful transaction with no token transfer is an error", async () => {
    const r = await verifyTransaction(HASH, want(), fetcherFor({ mainnet: receipt([]) }));
    expect(sevs(r.findings, "tx.token")).toEqual(["error"]);
    expect(byId(r.findings, "tx.token")[0].title).toContain("No ");
  });

  it("removed logs and malformed data are not counted", async () => {
    const r = await verifyTransaction(
      HASH,
      want(),
      fetcherFor({ mainnet: receipt([log(USDC, PAYER, PAYEE, "10000", { removed: true }), { ...log(USDC, PAYER, PAYEE, "10000"), data: "0xzz" }, { ...log(USDC, PAYER, PAYEE, "10000"), topics: [ERC20_TRANSFER_TOPIC] }]) })
    );
    expect(sevs(r.findings, "tx.token")).toEqual(["error"]);
  });
});

describe("verifyTransaction: the transaction itself", () => {
  it("a failed transaction is an error and no amount is judged", async () => {
    const r = await verifyTransaction(HASH, want(), fetcherFor({ mainnet: receipt([log(USDC, PAYER, PAYEE, "10000")], { status: "0x0" }) }));
    expect(sevs(r.findings, "tx.status")).toEqual(["error"]);
    expect(byId(r.findings, "tx.amount")).toHaveLength(0);
  });

  it("an unknown hash is a warning, not an error", async () => {
    const r = await verifyTransaction(HASH, want(), fetcherFor({}));
    expect(sevs(r.findings, "tx.found")).toEqual(["warning"]);
  });

  it("a hash that exists only on the other network is caught as a wrong-network payment", async () => {
    const r = await verifyTransaction(HASH, want({ network: "mainnet" }), fetcherFor({ testnet: receipt([log(USDC, PAYER, PAYEE, "10000")]) }));
    const f = byId(r.findings, "tx.network")[0];
    expect(f.severity).toBe("error");
    expect(f.title).toBe("Transaction is on Arc Testnet, not Arc Mainnet");
    expect(f.evidence).toContain("explorer.testnet.arc.io");
  });

  it("an error from the other network's node does not hide the not-found warning", async () => {
    const r = await verifyTransaction(HASH, want(), fetcherFor({ testnet: "throw" }));
    expect(sevs(r.findings, "tx.found")).toEqual(["warning"]);
  });

  it("an error from the main network's node is passed up", async () => {
    await expect(verifyTransaction(HASH, want(), fetcherFor({ mainnet: "throw" }))).rejects.toThrow("rpc down");
  });

  it("a receipt for a different hash is rejected", async () => {
    const r = await verifyTransaction(HASH, want(), fetcherFor({ mainnet: receipt([log(USDC, PAYER, PAYEE, "10000")], { transactionHash: "0x" + "cd".repeat(32) }) }));
    expect(sevs(r.findings, "tx.found")).toEqual(["error"]);
    expect(byId(r.findings, "tx.amount")).toHaveLength(0);
  });

  it("a receipt without a block is a warning", async () => {
    const r = await verifyTransaction(HASH, want(), fetcherFor({ mainnet: receipt([], { blockNumber: undefined }) }));
    expect(sevs(r.findings, "tx.found")).toEqual(["warning"]);
  });
});
