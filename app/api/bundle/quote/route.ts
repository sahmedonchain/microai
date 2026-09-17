import { NextResponse } from "next/server";
import { isValidQueryCount, computeBundleAmount, formatUsdc, MIN_QUERIES, MAX_QUERIES } from "@/lib/pricing";

// Computes the exact USDC amount to approve for a given query count.
// The client never gets to supply a total price directly — it's always
// derived here from the fixed per-query constant.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("queries");
  const queries = raw !== null ? Number(raw) : NaN;

  if (!isValidQueryCount(queries)) {
    return NextResponse.json(
      { error: `queries must be an integer between ${MIN_QUERIES} and ${MAX_QUERIES}` },
      { status: 400 }
    );
  }

  const amount = computeBundleAmount(queries);
  return NextResponse.json({ queries, amount, priceLabel: `$${formatUsdc(amount)} USDC` });
}
