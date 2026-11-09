import { z } from "zod";
import { TRACKED_REPOS } from "@/lib/trackedRepos";

// Request-body and query schemas for every API route.

export const TX_HASH = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]{64}$/, "Invalid transaction hash. Must be 0x followed by 64 hex characters.");

export const EVM_ADDRESS = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Invalid address. Must be 0x followed by 40 hex characters.");



export const debugAnalyzeBody = z.object({ txHash: TX_HASH });
export const walletBody = z.object({ address: EVM_ADDRESS });
export const ecosystemSearchBody = z.object({
  query: z.string().trim().min(1, "Query is required.").max(300, "Query must be 300 characters or fewer."),
});
export const githubStatusQuery = z.object({
  repo: z.string().refine((r) => (TRACKED_REPOS as readonly string[]).some((t) => t.toLowerCase() === r.toLowerCase()), "Repo not tracked"),
});
export const newsQuery = z.object({ refresh: z.enum(["1"]).optional() });
export const nonceQuery = z.object({ address: EVM_ADDRESS });
// Public chain reads for the Stats page. The browser never talks to Arc RPC
// itself: it asks this route, which only ever runs these fixed reads.
export const chainQuery = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("network") }),
  z.object({ kind: z.literal("revenue") }),
  z.object({ kind: z.literal("balance"), address: EVM_ADDRESS }),
]);
// MicroAI Verify. A request names an endpoint to check, a transaction to match
// against it, or both. The URL is only ever fetched through safeFetch (https
// only, no private addresses, size and time limits).
const verifyExpect = z.object({
  payTo: EVM_ADDRESS,
  amount: z.string().regex(/^\d{1,30}$/, "amount must be a whole number in the token's smallest unit."),
  asset: EVM_ADDRESS.optional(),
});
// What the person saw after paying. Optional, only used with a transaction hash.
const verifyDelivery = z.object({
  httpStatus: z.number().int("HTTP status must be a whole number.").min(100, "HTTP status must be between 100 and 599.").max(599, "HTTP status must be between 100 and 599."),
  paymentResponse: z.string().trim().max(4096, "PAYMENT-RESPONSE is too long.").optional(),
});
export const verifyBody = z
  .object({
    url: z.string().trim().min(8, "Enter the full https:// URL of the endpoint.").max(2048, "URL is too long.").optional(),
    network: z.enum(["mainnet", "testnet"]).optional(),
    txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Transaction hash must be 0x followed by 64 hex characters.").optional(),
    expect: verifyExpect.optional(),
    delivery: verifyDelivery.optional(),
    // Ask for a shareable link to this result (stored on the server for 30 days).
    share: z.boolean().optional(),
  })
  .superRefine((b, ctx) => {
    if (b.delivery && !b.txHash) ctx.addIssue({ code: "custom", message: "delivery is only used together with a transaction hash." });
    if (!b.url && !b.txHash) ctx.addIssue({ code: "custom", message: "Give the endpoint URL, or a transaction hash with the expected recipient and amount." });
    else if (b.expect && !b.txHash) ctx.addIssue({ code: "custom", message: "expect is only used together with a transaction hash." });
    else if (b.txHash && !b.url && !(b.expect && b.network)) ctx.addIssue({ code: "custom", message: "With a transaction hash and no URL, give expect (payTo and amount) and the network." });
  });
export const sessionPostBody = z.object({
  address: EVM_ADDRESS,
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/, "Invalid signature format."),
  message: z.string().min(1, "Sign-in message is required. Reload the page and sign in again.").max(2000),
});

// Trust API (read-only): the endpoint to check, and optionally which Arc network to expect.
export const trustQuery = z.object({
  url: z
    .string()
    .trim()
    .min(8, "Give the full https:// URL of the endpoint.")
    .max(2048, "URL is too long.")
    .refine((u) => /^https:\/\//i.test(u), "Only https:// URLs can be checked."),
  network: z.enum(["mainnet", "testnet"]).optional(),
});

// Facilitator check (read-only): the facilitator's base address, not a payment.
export const facilitatorQuery = z.object({
  url: z
    .string()
    .trim()
    .min(8, "Give the full https:// address of the facilitator.")
    .max(2048, "URL is too long.")
    .refine((u) => /^https:\/\//i.test(u), "Only https:// URLs can be checked."),
  network: z.enum(["mainnet", "testnet"]).optional(),
});
