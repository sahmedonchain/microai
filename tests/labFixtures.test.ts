import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/lab/x402/[case]/route";
import { LAB_CASES, buildLabAnswer } from "@/lib/verify/labFixtures";
import { verifyEndpointResponse } from "@/lib/verify/checks";
import type { VerifyReport } from "@/lib/verify/types";

// The fixtures are the five self-made broken endpoints (plus one good one) from
// the Verify v1 proof list. These tests run each one through the check engine
// exactly as the HTTP route serves it.

function served(id: string) {
  const a = buildLabAnswer(LAB_CASES.find((c) => c.id === id)!);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(a.headers)) headers[k.toLowerCase()] = v;
  return { status: a.status, headers, body: a.body };
}
const report = (id: string): VerifyReport => verifyEndpointResponse(served(id));
const errorIds = (r: VerifyReport) => r.findings.filter((f) => f.severity === "error").map((f) => f.id);

describe("lab fixtures through the check engine", () => {
  it("good: no errors and no warnings", () => {
    const r = report("good");
    expect(r.counts.error + r.counts.warning).toBe(0);
  });

  it("decimals18 is caught as an amount error", () => {
    const r = report("decimals18");
    expect(errorIds(r)).toEqual(["accepts[0].amount"]);
    expect(r.findings[0].title).toContain("18 decimals");
  });

  it("testnet-address-on-mainnet is caught as an asset error", () => {
    const r = report("testnet-address-on-mainnet");
    expect(errorIds(r)).toEqual(["accepts[0].asset"]);
    expect(r.findings[0].title).toBe("Arc Testnet address used on Arc Mainnet");
  });

  it("wrong-chain-id is caught as a network error", () => {
    expect(errorIds(report("wrong-chain-id"))).toEqual(["accepts[0].network"]);
  });

  it("bad-recipient is caught as a recipient error", () => {
    expect(errorIds(report("bad-recipient"))).toContain("accepts[0].payTo");
  });

  it("malformed-header is caught as a header error", () => {
    expect(errorIds(report("malformed-header"))).toContain("header");
  });

  it("every broken fixture has at least one error, the good one has none", () => {
    for (const c of LAB_CASES) {
      const errors = report(c.id).counts.error;
      if (c.id === "good") expect(errors).toBe(0);
      else expect(errors, c.id).toBeGreaterThan(0);
    }
  });
});

describe("GET /api/lab/x402/[case]", () => {
  const call = (id: string) => GET(new Request(`https://microai.example/api/lab/x402/${id}`), { params: Promise.resolve({ case: id }) });

  it("answers 402 with a decodable PAYMENT-REQUIRED header and a do-not-pay note", async () => {
    const res = await call("good");
    expect(res.status).toBe(402);
    const decoded = JSON.parse(Buffer.from(res.headers.get("payment-required")!, "base64").toString("utf8"));
    expect(decoded.x402Version).toBe(2);
    expect(decoded.resource.description).toContain("Do not pay");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("every fixture asks for Testnet or invalid values, never a real Mainnet payment", () => {
    for (const c of LAB_CASES) {
      const accepts = c.accepts as { network: string; payTo: string }[];
      for (const a of accepts) {
        const mainnetAndValid = a.network === "eip155:5042" && /^0x1111/.test(a.payTo);
        // The only fixture on the Mainnet network pairs it with a wrong-network asset (an error case).
        if (mainnetAndValid) expect(c.id).toBe("testnet-address-on-mainnet");
      }
    }
  });

  it("answers 404 for an unknown fixture", async () => {
    const res = await call("nope");
    expect(res.status).toBe(404);
  });
});
