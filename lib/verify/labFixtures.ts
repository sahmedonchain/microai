import { ARC_ADDRESSES } from "@/lib/arcAddresses";
import { USDC_ADDRESS } from "@/lib/arcConfig";

// Test fixtures for MicroAI Verify: endpoints that answer 402 on purpose, each
// with one known mistake (or none). They exist so the checker can be proven
// against a real HTTP endpoint. They are not services and take no payment: all
// use Arc Testnet or invalid values, and the description says so.

const TESTNET = "eip155:5042002";
const DUMMY_RECIPIENT = "0x1111111111111111111111111111111111111111";

function option(over: Record<string, unknown> = {}) {
  return {
    scheme: "exact",
    network: TESTNET,
    amount: "10000",
    asset: USDC_ADDRESS,
    payTo: DUMMY_RECIPIENT,
    maxTimeoutSeconds: 300,
    extra: { name: "USDC", version: "2" },
    ...over,
  };
}

export interface LabCase {
  id: string;
  /** What the mistake is. Shown in docs and tests. */
  mistake: string;
  /** Header value for PAYMENT-REQUIRED, or undefined to build it from the payload. */
  headerOverride?: string;
  accepts: unknown[];
}

export const LAB_CASES: LabCase[] = [
  { id: "good", mistake: "none", accepts: [option()] },
  { id: "decimals18", mistake: "amount written with 18 decimals instead of 6", accepts: [option({ amount: "1000000000000000000" })] },
  {
    id: "testnet-address-on-mainnet",
    mistake: "Testnet EURC address used on the Mainnet network",
    accepts: [option({ network: "eip155:5042", asset: ARC_ADDRESSES.eurc.testnet })],
  },
  { id: "wrong-chain-id", mistake: "chain id that looks like Arc but is not", accepts: [option({ network: "eip155:50420" })] },
  { id: "bad-recipient", mistake: "recipient is the USDC token contract itself", accepts: [option({ payTo: USDC_ADDRESS })] },
  { id: "malformed-header", mistake: "PAYMENT-REQUIRED header is not base64", headerOverride: "this-is-not-base64!!", accepts: [option()] },
];

export function findLabCase(id: string): LabCase | undefined {
  return LAB_CASES.find((c) => c.id === id);
}

export interface LabAnswer {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export function buildLabAnswer(c: LabCase): LabAnswer {
  const payload = {
    x402Version: 2,
    error: "Payment required",
    resource: { description: "MicroAI Verify test fixture. Not a real service. Do not pay." },
    accepts: c.accepts,
  };
  const json = JSON.stringify(payload);
  return {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "PAYMENT-REQUIRED": c.headerOverride ?? Buffer.from(json).toString("base64"),
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
    body: json,
  };
}
