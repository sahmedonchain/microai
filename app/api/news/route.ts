import { NextResponse } from "next/server";
import { getNewsPayload } from "@/lib/news";

export async function GET() {
  const payload = await getNewsPayload();
  return NextResponse.json(payload);
}
