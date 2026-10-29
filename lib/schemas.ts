import { z } from "zod";
import { MAX_QUERIES, MIN_QUERIES } from "@/lib/pricing";
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

export const MAX_MESSAGE_LENGTH = 4000;

const chatMessage = z.string().trim().min(1, "Message is required").max(MAX_MESSAGE_LENGTH, `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);

export const debugAnalyzeBody = z.object({ txHash: TX_HASH });
export const walletBody = z.object({ address: EVM_ADDRESS });
// `queries` is optional: when it is omitted (payment recovery) the server works
// out the credit count from the amount that was actually paid.
export const purchaseBody = z.object({
  txHash: TX_HASH,
  queries: z.number().int().min(MIN_QUERIES).max(MAX_QUERIES, `queries must be an integer between ${MIN_QUERIES} and ${MAX_QUERIES}.`).optional(),
});
export const ecosystemSearchBody = z.object({
  query: z.string().trim().min(1, "Query is required.").max(300, "Query must be 300 characters or fewer."),
});
export const githubStatusQuery = z.object({
  repo: z.string().refine((r) => (TRACKED_REPOS as readonly string[]).some((t) => t.toLowerCase() === r.toLowerCase()), "Repo not tracked"),
});
export const newsQuery = z.object({ refresh: z.enum(["1"]).optional() });
export const copilotModes = ["ARCHITECT", "CONTRACT", "USDC", "CIRCLE", "DEPLOY", "AUDIT", "SIMULATE", "DEBUG", "MIGRATE", "GENERAL"] as const;
export const copilotBody = z.union([
  z.object({ continueId: z.string().min(1).max(100) }),
  z.object({ message: chatMessage, mode: z.enum(copilotModes).optional(), history: z.unknown().optional() }),
]);
export const chatBodyBase = z.object({ message: chatMessage, history: z.unknown().optional() });
export const nonceQuery = z.object({ address: EVM_ADDRESS });
// Public chain reads for the Stats page. The browser never talks to Arc RPC
// itself: it asks this route, which only ever runs these fixed reads.
export const chainQuery = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("network") }),
  z.object({ kind: z.literal("revenue") }),
  z.object({ kind: z.literal("balance"), address: EVM_ADDRESS }),
]);
// MicroAI Verify: the endpoint to check. The URL is only ever fetched through
// safeFetch (https only, no private addresses, size and time limits).
export const verifyBody = z.object({
  url: z.string().trim().min(8, "Enter the full https:// URL of the endpoint.").max(2048, "URL is too long."),
  network: z.enum(["mainnet", "testnet"]).optional(),
});
export const sessionPostBody = z.object({
  address: EVM_ADDRESS,
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/, "Invalid signature format."),
  message: z.string().min(1, "Sign-in message is required. Reload the page and sign in again.").max(2000),
});
