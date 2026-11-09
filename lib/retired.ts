import { NextResponse } from "next/server";

// Routes that were switched off for good. They answer 410 Gone with no side
// effects, so old clients and bookmarks get a clear message instead of an error.
export function gone(): NextResponse {
  return NextResponse.json(
    { error: "This feature has been retired. MicroAI now focuses on Verify, Debug, Wallet and Stats.", code: "gone" },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}
