import { CLAIM_AND_CREDIT_SCRIPT } from "@/lib/usedTx";

// MOCK: in-memory stand-in for @upstash/redis, covering only the commands the
// app uses. Tests that use this are mock-based unit/integration tests; they
// say nothing about real Upstash behaviour (latency, REST serialisation).
type Entry = { value: unknown; expiresAt: number | null };

export class FakeRedis {
  private store = new Map<string, Entry>();
  private zsets = new Map<string, Map<string, number>>();
  private zExpires = new Map<string, number>();

  private live(key: string): Entry | undefined {
    const e = this.store.get(key);
    if (e && e.expiresAt !== null && e.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return e;
  }

  private liveZ(key: string): Map<string, number> | undefined {
    const exp = this.zExpires.get(key);
    if (exp !== undefined && exp <= Date.now()) {
      this.zsets.delete(key);
      this.zExpires.delete(key);
    }
    return this.zsets.get(key);
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const e = this.live(key);
    return e ? (structuredClone(e.value) as T) : null;
  }

  async set(key: string, value: unknown, opts: { nx?: boolean; ex?: number; px?: number } = {}) {
    if (opts.nx && this.live(key)) return null;
    const ttl = opts.ex !== undefined ? opts.ex * 1000 : opts.px;
    this.store.set(key, { value: structuredClone(value), expiresAt: ttl !== undefined ? Date.now() + ttl : null });
    return "OK";
  }

  async getdel<T = unknown>(key: string): Promise<T | null> {
    const v = await this.get<T>(key);
    this.store.delete(key);
    return v;
  }

  async del(...keys: string[]) {
    let n = 0;
    for (const k of keys) {
      if (this.store.delete(k)) n++;
      if (this.zsets.delete(k)) n++;
    }
    return n;
  }

  async incrby(key: string, by: number) {
    const e = this.live(key);
    const next = (typeof e?.value === "number" ? e.value : 0) + by;
    this.store.set(key, { value: next, expiresAt: e?.expiresAt ?? null });
    return next;
  }
  incr(key: string) { return this.incrby(key, 1); }
  decr(key: string) { return this.incrby(key, -1); }

  // Emulates CLAIM_AND_CREDIT_SCRIPT in JS (no Lua interpreter here). Runs without
  // awaiting, so it is atomic like the real script. Tests can set `evalFailure`
  // to simulate a timeout: "before" = script never ran, "after" = it ran but the reply was lost.
  evalFailure: "before" | "after" | null = null;
  async eval(script: string, keys: string[], args: string[]) {
    if (script !== CLAIM_AND_CREDIT_SCRIPT) throw new Error("FakeRedis.eval: unknown script");
    if (this.evalFailure === "before") throw new Error("redis timeout");
    const existing = this.live(keys[0]);
    let result: [number, unknown];
    if (existing) {
      result = [0, typeof existing.value === "string" ? existing.value : JSON.stringify(existing.value)];
    } else {
      this.store.set(keys[0], { value: JSON.parse(args[0]), expiresAt: null });
      const cur = this.live(keys[1]);
      const next = (typeof cur?.value === "number" ? cur.value : 0) + Number(args[1]);
      this.store.set(keys[1], { value: next, expiresAt: null });
      result = [1, next];
    }
    if (this.evalFailure === "after") throw new Error("redis timeout");
    return result;
  }

  async expire(key: string, seconds: number) {
    const e = this.live(key);
    if (!e) return 0;
    e.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async persist(key: string) {
    const e = this.live(key);
    if (!e || e.expiresAt === null) return 0;
    e.expiresAt = null;
    return 1;
  }

  async ttl(key: string) {
    const e = this.live(key);
    if (!e) return -2;
    return e.expiresAt === null ? -1 : Math.ceil((e.expiresAt - Date.now()) / 1000);
  }

  async scan(cursor: string | number, opts: { match?: string; count?: number } = {}) {
    const pattern = new RegExp("^" + (opts.match ?? "*").replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
    const all = [...this.store.keys()].filter((k) => this.live(k) && pattern.test(k));
    const start = Number(cursor);
    const count = opts.count ?? 10;
    const page = all.slice(start, start + count);
    const next = start + count >= all.length ? "0" : String(start + count);
    return [next, page] as [string, string[]];
  }

  async zadd(key: string, entry: { score: number; member: string }) {
    const z = this.liveZ(key) ?? new Map<string, number>();
    z.set(entry.member, entry.score);
    this.zsets.set(key, z);
    return 1;
  }
  async zremrangebyscore(key: string, min: number, max: number) {
    const z = this.liveZ(key);
    if (!z) return 0;
    let n = 0;
    for (const [m, s] of z) if (s >= min && s <= max) { z.delete(m); n++; }
    return n;
  }
  async zcard(key: string) { return this.liveZ(key)?.size ?? 0; }
  async zrem(key: string, member: string) { return this.liveZ(key)?.delete(member) ? 1 : 0; }
  async zrange(key: string, start: number, stop: number, opts: { withScores?: boolean } = {}) {
    const z = this.liveZ(key);
    if (!z) return [];
    const sorted = [...z.entries()].sort((a, b) => a[1] - b[1]).slice(start, stop === -1 ? undefined : stop + 1);
    return opts.withScores ? sorted.flatMap(([m, s]) => [m, s]) : sorted.map(([m]) => m);
  }
  async pexpire(key: string, ms: number) {
    if (!this.zsets.has(key)) return 0;
    this.zExpires.set(key, Date.now() + ms);
    return 1;
  }

  multi() {
    const ops: Array<() => Promise<unknown>> = [];
    const chain = {
      zremrangebyscore: (k: string, a: number, b: number) => (ops.push(() => this.zremrangebyscore(k, a, b)), chain),
      zadd: (k: string, e: { score: number; member: string }) => (ops.push(() => this.zadd(k, e)), chain),
      zcard: (k: string) => (ops.push(() => this.zcard(k)), chain),
      zrange: (k: string, a: number, b: number, o?: { withScores?: boolean }) => (ops.push(() => this.zrange(k, a, b, o)), chain),
      pexpire: (k: string, ms: number) => (ops.push(() => this.pexpire(k, ms)), chain),
      exec: async () => {
        const out: unknown[] = [];
        for (const op of ops) out.push(await op());
        return out;
      },
    };
    return chain;
  }

  // test helpers
  keys() { return [...this.store.keys()]; }
  clear() { this.store.clear(); this.zsets.clear(); this.zExpires.clear(); }
}

export function makeFakeRedis() {
  return new FakeRedis();
}
