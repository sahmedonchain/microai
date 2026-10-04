import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  getPendingSubmissions,
  getApprovedSubmissions,
  approveSubmission,
  rejectSubmission,
  deleteApprovedSubmission,
} from "@/lib/community";

const MIN_KEY_LENGTH = 12;

// Fails closed: if COMMUNITY_ADMIN_KEY is unset or too short, every request
// is treated as unauthorized rather than silently allowing access.
function isAuthorized(req: Request): boolean {
  const expected = process.env.COMMUNITY_ADMIN_KEY;
  if (!expected || expected.length < MIN_KEY_LENGTH) return false;

  const provided = req.headers.get("x-admin-key");
  if (!provided) return false;

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [pending, approved] = await Promise.all([getPendingSubmissions(), getApprovedSubmissions()]);
  return NextResponse.json({ pending, approved });
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { action?: unknown; id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { action, id } = body;
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  if (action === "approve") {
    const ok = await approveSubmission(id);
    if (!ok) return NextResponse.json({ error: "Pending submission not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  if (action === "reject") {
    const ok = await rejectSubmission(id);
    if (!ok) return NextResponse.json({ error: "Pending submission not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  if (action === "delete") {
    const ok = await deleteApprovedSubmission(id);
    if (!ok) return NextResponse.json({ error: "Approved submission not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action must be approve, reject, or delete." }, { status: 400 });
}
