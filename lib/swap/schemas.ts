import { z } from "zod";
import { TX_HASH } from "@/lib/schemas";

export const quoteBody = z.object({
  amount: z.string().trim().min(1).max(24),
  fromToken: z.string().trim().min(2).max(10).transform((s) => s.toUpperCase()),
  toToken: z.string().trim().min(2).max(10).transform((s) => s.toUpperCase()),
});
export const executeBody = z.object({ quoteId: z.string().regex(/^[A-Za-z0-9_-]{22}$/), confirm: z.boolean() });
export const submitBody = z.object({ quoteId: z.string().regex(/^[A-Za-z0-9_-]{22}$/), txHash: TX_HASH });
