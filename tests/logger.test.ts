import { describe, it, expect, vi } from "vitest";
import { createLogger, maskAddress, sanitizeLogValue } from "@/lib/logger";

describe("logger", () => {
  it("masks wallet addresses inside strings and nested fields", () => {
    const a = "0x4fd87e600d703c0c05c01096b8b3451192e54f29";
    expect(maskAddress(a)).toBe("0x4fd8...4f29");
    expect(sanitizeLogValue({ path: `/addresses/${a}/x`, nested: { wallet: a } })).toEqual({
      path: "/addresses/0x4fd8...4f29/x",
      nested: { wallet: "0x4fd8...4f29" },
    });
  });

  it("redacts secrets by key name", () => {
    const out = sanitizeLogValue({ apiKey: "k", Authorization: "Bearer x", sessionToken: "t", signature: "0xabc", ok: "fine" });
    expect(out).toEqual({ apiKey: "[redacted]", Authorization: "[redacted]", sessionToken: "[redacted]", signature: "[redacted]", ok: "fine" });
  });

  it("emits one JSON line with level, message and bound fields", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    createLogger({ route: "x" }).error("boom", { err: new Error("failed for 0x4fd87e600d703c0c05c01096b8b3451192e54f29") });
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line).toMatchObject({ level: "error", msg: "boom", route: "x" });
    expect(line.err.message).toContain("0x4fd8...4f29");
    expect(typeof line.ts).toBe("string");
  });
});
