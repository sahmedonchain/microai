import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getRedis } from "@/lib/redis";
import type { DeliveryVerdict } from "./delivery";
import type { Finding, Severity, VerifyReport } from "./types";

// Shareable Verify reports.
//
// Safety rules, because a stored report is served from MicroAI's own domain:
//   - Only the server's own check result is ever stored. The browser cannot post
//     report content, so nobody can mint a fake "passed" report under our name.
//   - A report is created only when the person asks for a link.
//   - The id is 128 random bits, so links cannot be guessed. Reports are served
//     noindex and no-store.
//   - Every string is length-capped and the whole record is size-capped.
//   - Reports expire after 30 days. The creator gets a delete token, kept only
//     as a SHA-256 hash, so a report can be removed early.
//   - Stored text may include words returned by the checked endpoint, so the page
//     tells readers to treat it as untrusted, and never renders the URL as a link.

export const REPORT_TTL_SEC = 30 * 86_400;
const MAX_RECORD_CHARS = 100_000;
const REPORT_ID = /^[A-Za-z0-9_-]{22}$/;
const DELETE_TOKEN = /^[A-Za-z0-9_-]{22}$/;

export interface SharedTx {
  network?: "mainnet" | "testnet";
  txHash: string;
  explorerUrl?: string;
  findings: Finding[];
  counts: Record<Severity, number>;
}

/** The server's check result, as stored and shown on a shared page. */
export interface SharedResult {
  url?: string;
  httpStatus?: number;
  report?: VerifyReport;
  transaction?: SharedTx;
  delivery?: DeliveryVerdict;
}

interface StoredRecord {
  v: 1;
  createdAt: string;
  result: SharedResult;
  /** SHA-256 hex of the delete token. */
  deleteHash: string;
}

export interface SavedReport {
  id: string;
  deleteToken: string;
  expiresAt: string;
}

export interface LoadedReport {
  createdAt: string;
  expiresAt: string;
  result: SharedResult;
}

const key = (id: string) => `microai:vreport:${id}`;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const rand = () => randomBytes(16).toString("base64url");
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export const isReportId = (id: unknown): id is string => typeof id === "string" && REPORT_ID.test(id);
export const isDeleteToken = (t: unknown): t is string => typeof t === "string" && DELETE_TOKEN.test(t);

function cleanFinding(f: Finding): Finding {
  return {
    id: cut(String(f.id), 80),
    severity: f.severity,
    title: cut(String(f.title), 200),
    reason: cut(String(f.reason), 600),
    ...(f.evidence ? { evidence: cut(String(f.evidence), 600) } : {}),
    ...(f.fix ? { fix: cut(String(f.fix), 600) } : {}),
  };
}

const SEVERITIES = new Set<Severity>(["ok", "info", "warning", "error"]);
const validFinding = (f: Finding) => f && typeof f === "object" && SEVERITIES.has(f.severity);

/**
 * Copies the result field by field, dropping anything unexpected and capping
 * every string. Returns null when the result is too large to store.
 */
export function sanitizeResult(r: SharedResult): SharedResult | null {
  const out: SharedResult = {};
  if (r.url) out.url = cut(String(r.url), 2048);
  if (typeof r.httpStatus === "number") out.httpStatus = r.httpStatus;
  if (r.report) {
    out.report = {
      ...(r.report.expectedNetwork ? { expectedNetwork: r.report.expectedNetwork } : {}),
      findings: r.report.findings.filter(validFinding).slice(0, 100).map(cleanFinding),
      counts: r.report.counts,
      checked: r.report.checked.slice(0, 30).map((c) => cut(String(c), 300)),
      notChecked: r.report.notChecked.slice(0, 30).map((c) => cut(String(c), 300)),
    };
  }
  if (r.transaction) {
    out.transaction = {
      ...(r.transaction.network ? { network: r.transaction.network } : {}),
      txHash: cut(String(r.transaction.txHash), 70),
      ...(r.transaction.explorerUrl ? { explorerUrl: cut(String(r.transaction.explorerUrl), 200) } : {}),
      findings: r.transaction.findings.filter(validFinding).slice(0, 100).map(cleanFinding),
      counts: r.transaction.counts,
    };
  }
  if (r.delivery) {
    out.delivery = {
      status: r.delivery.status,
      title: cut(String(r.delivery.title), 200),
      reason: cut(String(r.delivery.reason), 600),
      ...(r.delivery.fix ? { fix: cut(String(r.delivery.fix), 600) } : {}),
      evidence: r.delivery.evidence.slice(0, 10).map((e) => cut(String(e), 300)),
      notes: r.delivery.notes.slice(0, 10).map((n) => cut(String(n), 400)),
    };
  }
  return JSON.stringify(out).length > MAX_RECORD_CHARS ? null : out;
}

/** Stores the result under a fresh random id. Returns null if it cannot be stored. */
export async function saveReport(result: SharedResult, now: Date = new Date()): Promise<SavedReport | null> {
  const clean = sanitizeResult(result);
  if (!clean) return null;
  const deleteToken = rand();
  const record: StoredRecord = { v: 1, createdAt: now.toISOString(), result: clean, deleteHash: sha256(deleteToken) };
  const redis = getRedis();
  for (let attempt = 0; attempt < 2; attempt++) {
    const id = rand();
    const ok = await redis.set(key(id), record, { nx: true, ex: REPORT_TTL_SEC });
    if (ok) return { id, deleteToken, expiresAt: new Date(now.getTime() + REPORT_TTL_SEC * 1000).toISOString() };
  }
  return null;
}

function readRecord(raw: unknown): StoredRecord | null {
  let v: unknown = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const r = v as Partial<StoredRecord>;
  if (r.v !== 1 || typeof r.createdAt !== "string" || typeof r.deleteHash !== "string" || !r.result || typeof r.result !== "object") return null;
  return r as StoredRecord;
}

export async function loadReport(id: string): Promise<LoadedReport | null> {
  if (!isReportId(id)) return null;
  const rec = readRecord(await getRedis().get(key(id)));
  if (!rec) return null;
  const expiresAt = new Date(new Date(rec.createdAt).getTime() + REPORT_TTL_SEC * 1000).toISOString();
  return { createdAt: rec.createdAt, expiresAt, result: rec.result };
}

/** True when the report existed and the token was right. Missing and wrong look the same. */
export async function deleteReport(id: string, token: string): Promise<boolean> {
  if (!isReportId(id) || !isDeleteToken(token)) return false;
  const redis = getRedis();
  const rec = readRecord(await redis.get(key(id)));
  if (!rec) return false;
  const a = Buffer.from(sha256(token), "hex");
  const b = Buffer.from(rec.deleteHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  await redis.del(key(id));
  return true;
}
