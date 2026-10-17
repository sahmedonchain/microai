import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "events";

// MOCK: node:https and DNS are replaced; this checks how the real transport is configured.
const captured: { opts?: Record<string, unknown> } = {};
vi.mock("https", () => ({
  request: (opts: Record<string, unknown>, cb: (res: unknown) => void) => {
    captured.opts = opts;
    const req = new EventEmitter() as EventEmitter & { end: () => void };
    req.end = () => {
      const res = Object.assign(
        (async function* () {
          yield new TextEncoder().encode("hello");
        })(),
        { statusCode: 200, headers: {}, destroy: () => {} }
      );
      cb(res);
    };
    return req;
  },
}));
const lookups: string[] = [];
vi.mock("dns/promises", () => ({
  lookup: async (host: string) => {
    lookups.push(host);
    return [{ address: "93.184.216.34", family: 4 }];
  },
}));

import { safeFetch } from "@/lib/safeFetch";

describe("real transport configuration", () => {
  it("connects to the validated IP via a pinned lookup, with SNI/Host still the hostname", async () => {
    const res = await safeFetch("https://example.com/path?q=1");
    expect(res.text()).toBe("hello");
    expect(lookups).toEqual(["example.com"]); // resolved exactly once
    const o = captured.opts!;
    expect(o.hostname).toBe("example.com");
    expect(o.servername).toBe("example.com");
    expect(o.port).toBe(443);
    expect(o.method).toBe("GET");
    expect(o.path).toBe("/path?q=1");

    const lookup = o.lookup as (h: string, opts: object, cb: (...a: unknown[]) => void) => void;
    const single = vi.fn();
    lookup("example.com", {}, single);
    expect(single).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    const all = vi.fn();
    lookup("example.com", { all: true }, all);
    expect(all).toHaveBeenCalledWith(null, [{ address: "93.184.216.34", family: 4 }]);
  });
});
