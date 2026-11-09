import { describe, expect, it } from "vitest";
import { HISTORY_MAX, addEntry, labelFor, parseHistory, removeEntry, type HistoryEntry } from "@/lib/verify/history";

const NOW = Date.parse("2026-11-10T00:00:00Z");
const id = (n: number) => String(n).padStart(22, "a");
const entry = (n: number, over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: id(n),
  createdAt: "2026-11-09T00:00:00Z",
  expiresAt: "2026-12-09T00:00:00Z",
  label: "example.com",
  verdict: "No problems found",
  deleteToken: id(n + 1000),
  ...over,
});

describe("parseHistory", () => {
  it("returns [] for null, empty, junk, non-arrays and oversized input", () => {
    expect(parseHistory(null, NOW)).toEqual([]);
    expect(parseHistory("", NOW)).toEqual([]);
    expect(parseHistory("{not json", NOW)).toEqual([]);
    expect(parseHistory('{"a":1}', NOW)).toEqual([]);
    expect(parseHistory("[" + "1,".repeat(60_000) + "1]", NOW)).toEqual([]);
  });

  it("keeps valid entries and drops malformed ones", () => {
    const raw = JSON.stringify([entry(1), { id: "short", deleteToken: "x" }, null, "str", entry(2, { label: "" }), entry(3, { id: "has spaces and ! chars  " })]);
    expect(parseHistory(raw, NOW).map((e) => e.id)).toEqual([id(1)]);
  });

  it("drops expired entries", () => {
    const raw = JSON.stringify([entry(1, { expiresAt: "2026-11-01T00:00:00Z" }), entry(2)]);
    expect(parseHistory(raw, NOW).map((e) => e.id)).toEqual([id(2)]);
  });

  it("drops entries with an unparseable date", () => {
    expect(parseHistory(JSON.stringify([entry(1, { expiresAt: "not a date" })]), NOW)).toEqual([]);
  });

  it("does not pass through unknown fields", () => {
    const raw = JSON.stringify([{ ...entry(1), extra: "<script>", __proto__: { x: 1 } }]);
    const [e] = parseHistory(raw, NOW);
    expect(Object.keys(e).sort()).toEqual(["createdAt", "deleteToken", "expiresAt", "id", "label", "verdict"]);
  });

  it("caps the list", () => {
    const raw = JSON.stringify(Array.from({ length: 50 }, (_, i) => entry(i)));
    expect(parseHistory(raw, NOW)).toHaveLength(HISTORY_MAX);
  });
});

describe("addEntry / removeEntry", () => {
  it("puts the newest first and does not duplicate", () => {
    const list = addEntry(addEntry([], entry(1)), entry(2));
    expect(list.map((e) => e.id)).toEqual([id(2), id(1)]);
    expect(addEntry(list, entry(1)).map((e) => e.id)).toEqual([id(1), id(2)]);
  });

  it("caps at the maximum, dropping the oldest", () => {
    let list: HistoryEntry[] = [];
    for (let i = 0; i < HISTORY_MAX + 5; i++) list = addEntry(list, entry(i));
    expect(list).toHaveLength(HISTORY_MAX);
    expect(list[0].id).toBe(id(HISTORY_MAX + 4));
  });

  it("removes by id", () => {
    expect(removeEntry([entry(1), entry(2)], id(1)).map((e) => e.id)).toEqual([id(2)]);
  });
});

describe("labelFor", () => {
  it("uses the host for a URL", () => expect(labelFor({ url: "https://api.example.com/x?y=1" })).toBe("api.example.com"));
  it("falls back to a short tx hash", () => expect(labelFor({ txHash: "0x" + "ab".repeat(32) })).toBe("0xabababab…ababab"));
  it("falls back to a generic label", () => {
    expect(labelFor({})).toBe("Verify report");
    expect(labelFor({ url: "not a url" })).toBe("Verify report");
  });
});
