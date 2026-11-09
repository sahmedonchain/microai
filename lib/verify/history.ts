// The person's own list of shared reports, kept only in their browser
// (localStorage). Nothing about it is stored on the server: the server knows a
// report by its random id, not who made it. The delete token is kept here so
// the person can remove a report early.

export const HISTORY_KEY = "microai_verify_history";
export const HISTORY_MAX = 20;

const ID = /^[A-Za-z0-9_-]{22}$/;

export interface HistoryEntry {
  id: string;
  /** ISO time the report was created. */
  createdAt: string;
  /** ISO time the link stops working. */
  expiresAt: string;
  /** Short name for the list: the endpoint's host, or a shortened transaction hash. */
  label: string;
  /** The verdict text at that time. */
  verdict: string;
  deleteToken: string;
}

const isIso = (s: unknown): s is string => typeof s === "string" && s.length <= 40 && !Number.isNaN(Date.parse(s));
const str = (s: unknown, max: number): s is string => typeof s === "string" && s.length > 0 && s.length <= max;

function valid(e: unknown): e is HistoryEntry {
  if (!e || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  return typeof o.id === "string" && ID.test(o.id) && typeof o.deleteToken === "string" && ID.test(o.deleteToken) && isIso(o.createdAt) && isIso(o.expiresAt) && str(o.label, 120) && str(o.verdict, 120);
}

/** Reads the stored list. Anything malformed or already expired is dropped. */
export function parseHistory(raw: string | null, now: number = Date.now()): HistoryEntry[] {
  if (!raw || raw.length > 100_000) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .filter(valid)
    .filter((e) => Date.parse(e.expiresAt) > now)
    .slice(0, HISTORY_MAX)
    .map((e) => ({ id: e.id, createdAt: e.createdAt, expiresAt: e.expiresAt, label: e.label, verdict: e.verdict, deleteToken: e.deleteToken }));
}

/** Newest first, no duplicates, capped. */
export function addEntry(list: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [entry, ...list.filter((e) => e.id !== entry.id)].slice(0, HISTORY_MAX);
}

export function removeEntry(list: HistoryEntry[], id: string): HistoryEntry[] {
  return list.filter((e) => e.id !== id);
}

/** A short list label from what was checked. */
export function labelFor(input: { url?: string; txHash?: string }): string {
  if (input.url) {
    try {
      return new URL(input.url).hostname.slice(0, 100);
    } catch {
      /* fall through */
    }
  }
  if (input.txHash) return `${input.txHash.slice(0, 10)}…${input.txHash.slice(-6)}`;
  return "Verify report";
}
