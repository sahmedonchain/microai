import { describe, it, expect } from "vitest";
import { verifyEndpointResponse, formatUnits } from "@/lib/verify/checks";
import { parseResponse } from "@/lib/verify/x402";
import { PAYMENT_RECEIVER, USDC_ADDRESS } from "@/lib/arcConfig";
import type { EndpointResponse, VerifyReport } from "@/lib/verify/types";

// These tests feed captured 402 answers to the pure check engine. Nothing here
// touches the network, Redis or the chain.

const EURC_MAINNET = "0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1";
const EURC_TESTNET = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";

const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");

function entry(over: Record<string, unknown> = {}) {
  return {
    scheme: "exact",
    network: "eip155:5042",
    amount: "10000",
    asset: USDC_ADDRESS,
    payTo: PAYMENT_RECEIVER,
    maxTimeoutSeconds: 300,
    extra: { name: "USD Coin", version: "2" },
    ...over,
  };
}

const v2 = (accepts: unknown[]) => ({ x402Version: 2, accepts });

function res(payload: unknown, o: { status?: number; header?: boolean; body?: boolean } = {}): EndpointResponse {
  const { status = 402, header = true, body = false } = o;
  return { status, headers: header ? { "PAYMENT-REQUIRED": enc(payload) } : {}, body: body ? JSON.stringify(payload) : "" };
}

const ids = (r: VerifyReport, id: string) => r.findings.filter((f) => f.id === id);
const severities = (r: VerifyReport, id: string) => ids(r, id).map((f) => f.severity);
const one = (r: VerifyReport, id: string) => {
  const found = ids(r, id);
  expect(found.length).toBeGreaterThan(0);
  return found[0];
};

describe("good configurations", () => {
  it("a correct Mainnet option has no errors and no warnings", () => {
    const r = verifyEndpointResponse(res(v2([entry()])));
    expect(r.counts.error).toBe(0);
    expect(r.counts.warning).toBe(0);
    expect(severities(r, "accepts[0].amount")).toEqual(["ok"]);
    expect(one(r, "accepts[0].amount").title).toBe("Amount is 0.01 USDC");
  });

  it("a correct Testnet option has no errors and no warnings", () => {
    const r = verifyEndpointResponse(res(v2([entry({ network: "eip155:5042002" })])));
    expect(r.counts.error + r.counts.warning).toBe(0);
    expect(one(r, "accepts[0].network").title).toBe("Network is Arc Testnet");
  });

  it("accepts url-safe base64 in the header", () => {
    const urlSafe = enc(v2([entry()])).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const r = verifyEndpointResponse({ status: 402, headers: { "payment-required": urlSafe }, body: "" });
    expect(r.counts.error).toBe(0);
  });

  it("a Base option next to a good Arc option is fine; the Base one is only noted", () => {
    const r = verifyEndpointResponse(res(v2([entry({ network: "eip155:8453" }), entry()])));
    expect(r.counts.error + r.counts.warning).toBe(0);
    expect(severities(r, "accepts[0].network")).toEqual(["info"]);
    expect(ids(r, "accepts[0].asset")).toHaveLength(0);
  });

  it("matching Mainnet expectation passes", () => {
    const r = verifyEndpointResponse(res(v2([entry()])), { expectedNetwork: "mainnet" });
    expect(r.counts.error).toBe(0);
  });
});

describe("response format", () => {
  it("HTTP 200 means no payment was asked for (warning)", () => {
    const r = verifyEndpointResponse({ status: 200, headers: {}, body: "{}" });
    expect(severities(r, "status")).toEqual(["warning"]);
  });

  it("HTTP 404 is an error", () => {
    const r = verifyEndpointResponse({ status: 404, headers: {}, body: "not found" });
    expect(severities(r, "status")).toEqual(["error"]);
  });

  it("no header and a non-x402 body is an error", () => {
    const r = verifyEndpointResponse({ status: 402, headers: {}, body: "pay me" });
    expect(severities(r, "requirements")).toEqual(["error"]);
  });

  it("a header that is not base64 is an error", () => {
    const r = verifyEndpointResponse({ status: 402, headers: { "PAYMENT-REQUIRED": "{not base64!}" }, body: "" });
    expect(severities(r, "header")).toEqual(["error"]);
  });

  it("base64 that is not JSON is an error", () => {
    const r = verifyEndpointResponse({ status: 402, headers: { "PAYMENT-REQUIRED": Buffer.from("hello").toString("base64") }, body: "" });
    expect(one(r, "header").title).toBe("PAYMENT-REQUIRED header is not valid JSON");
  });

  it("v2 requirements only in the body is a warning", () => {
    const r = verifyEndpointResponse(res(v2([entry()]), { header: false, body: true }));
    expect(severities(r, "header")).toEqual(["warning"]);
    expect(r.counts.error).toBe(0);
  });

  it("v1 is flagged as legacy and its fields are not checked", () => {
    const body = JSON.stringify({ x402Version: 1, accepts: [{ maxAmountRequired: "1" }] });
    const r = verifyEndpointResponse({ status: 402, headers: {}, body });
    expect(severities(r, "version")).toEqual(["warning"]);
    expect(r.findings.some((f) => f.id.startsWith("accepts["))).toBe(false);
  });

  it("a missing x402Version is a warning", () => {
    const r = verifyEndpointResponse(res({ accepts: [entry()] }));
    expect(severities(r, "version")).toEqual(["warning"]);
  });

  it("an empty accepts list is an error", () => {
    const r = verifyEndpointResponse(res(v2([])));
    expect(severities(r, "accepts")).toEqual(["error"]);
  });

  it("header and body that disagree are a warning", () => {
    const other = v2([entry({ amount: "99999" })]);
    const r = verifyEndpointResponse({ status: 402, headers: { "PAYMENT-REQUIRED": enc(v2([entry()])) }, body: JSON.stringify(other) });
    expect(severities(r, "header-body")).toEqual(["warning"]);
  });

  it("parseResponse reads the header first", () => {
    const { parsed } = parseResponse(res(v2([entry()])));
    expect(parsed?.source).toBe("header");
    expect(parsed?.version).toBe(2);
  });
});

describe("network", () => {
  it('"arc" instead of a chain id is an error', () => {
    const r = verifyEndpointResponse(res(v2([entry({ network: "arc" })])));
    expect(severities(r, "accepts[0].network")).toEqual(["error"]);
  });

  it("a chain id that looks like Arc but is not is an error", () => {
    const r = verifyEndpointResponse(res(v2([entry({ network: "eip155:50420" })])));
    expect(one(r, "accepts[0].network").title).toBe("Chain id looks like Arc but is not");
  });

  it("only a non-Arc option gives a warning that nothing was verified", () => {
    const r = verifyEndpointResponse(res(v2([entry({ network: "eip155:8453" })])));
    expect(severities(r, "network")).toEqual(["warning"]);
  });

  it("asking for Mainnet when only Testnet is offered is an error", () => {
    const r = verifyEndpointResponse(res(v2([entry({ network: "eip155:5042002" })])), { expectedNetwork: "mainnet" });
    expect(severities(r, "network")).toEqual(["error"]);
    expect(one(r, "network").fix).toContain("5042");
  });
});

describe("asset", () => {
  it("a Testnet EURC address on Mainnet is caught as a network mix-up", () => {
    const r = verifyEndpointResponse(res(v2([entry({ asset: EURC_TESTNET })])));
    const f = one(r, "accepts[0].asset");
    expect(f.severity).toBe("error");
    expect(f.title).toBe("Arc Testnet address used on Arc Mainnet");
    expect(f.fix).toContain(USDC_ADDRESS);
  });

  it("EURC on the right network is a warning, not USDC", () => {
    const r = verifyEndpointResponse(res(v2([entry({ asset: EURC_MAINNET })])));
    expect(severities(r, "accepts[0].asset")).toEqual(["warning"]);
  });

  it("an unknown contract is a warning", () => {
    const r = verifyEndpointResponse(res(v2([entry({ asset: "0x1111111111111111111111111111111111111111" })])));
    expect(severities(r, "accepts[0].asset")).toEqual(["warning"]);
  });

  it("an invalid asset is an error", () => {
    const r = verifyEndpointResponse(res(v2([entry({ asset: "0x123" })])));
    expect(severities(r, "accepts[0].asset")).toEqual(["error"]);
  });

  it("the zero address as asset is an error", () => {
    const r = verifyEndpointResponse(res(v2([entry({ asset: "0x0000000000000000000000000000000000000000" })])));
    expect(severities(r, "accepts[0].asset")).toEqual(["error"]);
  });
});

describe("amount", () => {
  it("1e18 is caught as an 18-decimal amount, with the fix", () => {
    const r = verifyEndpointResponse(res(v2([entry({ amount: "1000000000000000000" })])));
    const f = one(r, "accepts[0].amount");
    expect(f.severity).toBe("error");
    expect(f.title).toContain("18 decimals");
    expect(f.reason).toContain("1,000,000,000,000 USDC");
    expect(f.fix).toContain('"1000000"');
  });

  it('"0.01" is an error: smallest units are whole numbers', () => {
    const r = verifyEndpointResponse(res(v2([entry({ amount: "0.01" })])));
    expect(severities(r, "accepts[0].amount")).toEqual(["error"]);
  });

  it("a JSON number is a warning, not an error", () => {
    const r = verifyEndpointResponse(res(v2([entry({ amount: 10000 })])));
    expect(severities(r, "accepts[0].amount")).toEqual(["warning", "ok"]);
  });

  it("a missing amount is an error", () => {
    const e = entry();
    delete (e as Record<string, unknown>).amount;
    const r = verifyEndpointResponse(res(v2([e])));
    expect(severities(r, "accepts[0].amount")).toEqual(["error"]);
  });

  it("zero is a warning", () => {
    const r = verifyEndpointResponse(res(v2([entry({ amount: "0" })])));
    expect(severities(r, "accepts[0].amount")).toEqual(["warning"]);
  });

  it("5,000 USDC per call is a warning", () => {
    const r = verifyEndpointResponse(res(v2([entry({ amount: "5000000000" })])));
    expect(severities(r, "accepts[0].amount")).toEqual(["warning"]);
  });

  it("formatUnits formats 6 and 18 decimals", () => {
    expect(formatUnits(BigInt("10000"), 6)).toBe("0.01");
    expect(formatUnits(BigInt("1000000"), 6)).toBe("1");
    expect(formatUnits(BigInt("1000000000000000000"), 18)).toBe("1");
    expect(formatUnits(BigInt("1000000000000000000"), 6)).toBe("1,000,000,000,000");
  });
});

describe("recipient", () => {
  it("the zero address is an error", () => {
    const r = verifyEndpointResponse(res(v2([entry({ payTo: "0x0000000000000000000000000000000000000000" })])));
    expect(severities(r, "accepts[0].payTo")).toEqual(["error"]);
  });

  it("the token contract itself is an error", () => {
    const r = verifyEndpointResponse(res(v2([entry({ payTo: USDC_ADDRESS })])));
    expect(severities(r, "accepts[0].payTo")).toEqual(["error"]);
  });

  it("an invalid address is an error", () => {
    const r = verifyEndpointResponse(res(v2([entry({ payTo: "0xabc" })])));
    expect(severities(r, "accepts[0].payTo")).toEqual(["error"]);
  });

  it("a bad checksum is a warning on top of the ok format check", () => {
    const flipped = PAYMENT_RECEIVER.replace(/[a-fA-F]/, (c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()));
    expect(flipped).not.toBe(PAYMENT_RECEIVER);
    const r = verifyEndpointResponse(res(v2([entry({ payTo: flipped })])));
    expect(severities(r, "accepts[0].payTo")).toEqual(["warning", "ok"]);
  });
});

describe("timeout, scheme and report shape", () => {
  it("a missing maxTimeoutSeconds is an error", () => {
    const e = entry();
    delete (e as Record<string, unknown>).maxTimeoutSeconds;
    const r = verifyEndpointResponse(res(v2([e])));
    expect(severities(r, "accepts[0].maxTimeoutSeconds")).toEqual(["error"]);
  });

  it("1 second is a warning and 3 days is a warning", () => {
    expect(severities(verifyEndpointResponse(res(v2([entry({ maxTimeoutSeconds: 1 })]))), "accepts[0].maxTimeoutSeconds")).toEqual(["warning"]);
    expect(severities(verifyEndpointResponse(res(v2([entry({ maxTimeoutSeconds: 259200 })]))), "accepts[0].maxTimeoutSeconds")).toEqual(["warning"]);
  });

  it("a Circle Gateway batched option is explained, not flagged", () => {
    const r = verifyEndpointResponse(res(v2([entry({ extra: { name: "GatewayWalletBatched", version: "1" }, maxTimeoutSeconds: 604900 })])));
    expect(severities(r, "accepts[0].scheme")).toEqual(["info"]);
    expect(r.counts.error + r.counts.warning).toBe(0);
  });

  it("an unknown scheme is a warning", () => {
    const r = verifyEndpointResponse(res(v2([entry({ scheme: "upto" })])));
    expect(severities(r, "accepts[0].scheme")).toEqual(["warning"]);
  });

  it("findings are sorted errors first and counts add up", () => {
    const r = verifyEndpointResponse(res(v2([entry({ amount: "1000000000000000000", payTo: "0xabc", maxTimeoutSeconds: 1 })])));
    const order = r.findings.map((f) => f.severity);
    const rank = { error: 0, warning: 1, info: 2, ok: 3 } as const;
    expect([...order].sort((a, b) => rank[a] - rank[b])).toEqual(order);
    expect(r.counts.error + r.counts.warning + r.counts.info + r.counts.ok).toBe(r.findings.length);
  });

  it("every report says what was and was not checked, and sends no payment", () => {
    const r = verifyEndpointResponse(res(v2([entry()])));
    expect(r.checked.length).toBeGreaterThan(0);
    expect(r.notChecked.join(" ")).toContain("No payment was sent");
  });
});

// A multi-chain seller of the kind that exists on Arc today: one 402 that
// offers the same price on many networks, EVM and not, plus a Circle Gateway
// batched option with a window of about 7 days. The shape follows the public
// manifest of agent402.tools; the non-Arc asset values are placeholders.
describe("a multi-chain seller with a Gateway batched option", () => {
  const SELLER = "0xaBF4FAbd7c416fB67202E5f9002389Fc75e2a9D0";
  const multi = () => [
    entry({ network: "eip155:8453", amount: "1000", asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", payTo: SELLER, maxTimeoutSeconds: 60, extra: { name: "USD Coin", version: "2" } }),
    entry({ network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", amount: "1000", asset: "placeholder-solana-mint", payTo: "placeholder-solana-address", extra: {} }),
    entry({ network: "stellar:pubnet", amount: "1000", asset: "placeholder-stellar-asset", payTo: "placeholder-stellar-address", extra: {} }),
    entry({ network: "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k", amount: "1000", asset: "placeholder-algorand-asset", payTo: "placeholder-algorand-address", extra: {} }),
    entry({ network: "eip155:5042", amount: "1000", payTo: SELLER, maxTimeoutSeconds: 60, extra: { name: "USDC", version: "2" } }),
    entry({ network: "eip155:5042", amount: "1000", payTo: SELLER, maxTimeoutSeconds: 604900, extra: { name: "GatewayWalletBatched", version: "1", verifyingContract: "0x77777777dcc4d5a8b6e418fd04d8997ef11000ee" } }),
  ];

  it("raises no error and no warning for any option", () => {
    const r = verifyEndpointResponse(res(v2(multi())));
    expect(r.counts.error).toBe(0);
    expect(r.counts.warning).toBe(0);
  });

  it("notes the non-Arc networks (EVM and not) instead of calling them wrong", () => {
    const r = verifyEndpointResponse(res(v2(multi())));
    for (const i of [0, 1, 2, 3]) expect(severities(r, `accepts[${i}].network`)).toEqual(["info"]);
    expect(one(r, "accepts[1].network").title).toBe("Not an Arc network");
  });

  it("checks both Arc options and treats a 7-day window as normal for Gateway batching", () => {
    const r = verifyEndpointResponse(res(v2(multi())), { expectedNetwork: "mainnet" });
    expect(severities(r, "accepts[4].network")).toEqual(["ok"]);
    expect(severities(r, "accepts[5].scheme")).toEqual(["info"]);
    expect(one(r, "accepts[5].maxTimeoutSeconds").title).toBe("Timeout is 7.0 days");
    expect(severities(r, "accepts[5].maxTimeoutSeconds")).toEqual(["ok"]);
  });

  it("a Gateway batched option with a 4-day window gets a hedged warning", () => {
    const short = entry({ extra: { name: "GatewayWalletBatched", version: "1" }, maxTimeoutSeconds: 345600 });
    const r = verifyEndpointResponse(res(v2([short])));
    const f = one(r, "accepts[0].maxTimeoutSeconds");
    expect(f.severity).toBe("warning");
    expect(f.title).toBe("Timeout may be too short for Gateway batching");
    expect(f.reason).toContain("report");
    expect(f.fix).toContain("604800");
  });

  it("a long window on a plain exact option is still flagged", () => {
    const r = verifyEndpointResponse(res(v2([entry({ maxTimeoutSeconds: 604900 })])));
    expect(severities(r, "accepts[0].maxTimeoutSeconds")).toEqual(["warning"]);
  });
});

describe("network spelling", () => {
  it('v1-style names such as "base-sepolia" are an error', () => {
    const r = verifyEndpointResponse(res(v2([entry({ network: "base-sepolia" })])));
    expect(severities(r, "accepts[0].network")).toEqual(["error"]);
  });

  it("an eip155 id that is not a number is an error", () => {
    const r = verifyEndpointResponse(res(v2([entry({ network: "eip155:abc" })])));
    expect(one(r, "accepts[0].network").title).toBe("Chain id is not a number");
  });

  it("only non-Arc networks give a note per option and one warning that nothing was verified", () => {
    const r = verifyEndpointResponse(res(v2([entry({ network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" })])));
    expect(severities(r, "accepts[0].network")).toEqual(["info"]);
    expect(severities(r, "network")).toEqual(["warning"]);
    expect(r.counts.error).toBe(0);
  });
});
