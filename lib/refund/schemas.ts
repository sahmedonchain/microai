import { z } from "zod";
import { EVM_ADDRESS, TX_HASH } from "@/lib/schemas";
import { REFUND_REASONS } from "./types";

const UNITS = z.string().regex(/^[1-9]\d{0,29}$/, "Amount must be a whole number of USDC units (6 decimals), above zero.");
const NET = z.enum(["mainnet", "testnet"]);
const text = (max: number) => z.string().trim().max(max, `Must be ${max} characters or fewer.`);

export const deliveryCheckBody = z.object({
  network: NET,
  txHash: TX_HASH,
  payTo: EVM_ADDRESS,
  resourceUrl: z.string().trim().min(8).max(2048).refine((u) => /^https:\/\//i.test(u), "Only https:// resource URLs."),
  /** Omit when the service gave no response at all. */
  httpStatus: z.number().int().min(100).max(599).optional(),
  /** The response body the caller received. Only its hash and the checked fields are kept. */
  responseBody: z.string().max(200_000).optional(),
  rule: z
    .object({
      expectedStatus: z.number().int().min(100).max(599).optional(),
      mustContain: z.array(text(200).min(1)).max(10).optional(),
      requiredJsonFields: z.array(z.string().trim().regex(/^[\w-]{1,40}(\.[\w-]{1,40}){0,5}$/, "Use dot paths such as data.items.")).max(20).optional(),
    })
    .default({}),
});

export const createCaseBody = z.object({
  network: NET,
  txHash: TX_HASH,
  payTo: EVM_ADDRESS,
  reason: z.enum(REFUND_REASONS),
  statement: text(1000).min(10, "Say what went wrong in at least 10 characters."),
  deliveryCheckId: z.string().regex(/^[A-Za-z0-9_-]{22}$/).optional(),
  /** Smallest USDC units. Default: the whole payment. */
  requestedAmount: UNITS.optional(),
});

export const approveBody = z.object({ amount: UNITS.optional(), message: text(1000).optional() });
export const rejectBody = z.object({ reason: text(1000).min(5, "Give a reason of at least 5 characters.") });
export const settleBody = z.object({ txHash: TX_HASH });
