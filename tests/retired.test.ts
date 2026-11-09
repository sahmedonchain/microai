import { readdirSync, readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GET as chatGet, POST as chatPost } from "@/app/api/chat/route";
import { POST as copilotPost } from "@/app/api/copilot/route";
import { POST as purchasePost } from "@/app/api/credits/purchase/route";
import { GET as balanceGet } from "@/app/api/credits/balance/route";
import { POST as historyPost } from "@/app/api/payment-history/route";

const call = (h: (r: Request) => Response | Promise<Response>, method: string) => h(new Request("https://microai.example/api/x", { method, body: method === "POST" ? "{}" : undefined }));

describe("retired routes (credits, Chat, Copilot)", () => {
  it.each([
    ["chat GET", chatGet, "GET"],
    ["chat POST", chatPost, "POST"],
    ["copilot", copilotPost, "POST"],
    ["credits purchase", purchasePost, "POST"],
    ["credits balance", balanceGet, "GET"],
    ["payment history", historyPost, "POST"],
  ] as const)("%s answers 410 Gone with no-store", async (_n, handler, method) => {
    const res = await call(handler, method);
    expect(res.status).toBe(410);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await res.json()).code).toBe("gone");
  });

  it("the retired route files import no credit, payment, AI or Redis code", () => {
    for (const p of ["chat", "copilot", "credits/purchase", "credits/balance", "payment-history"]) {
      const src = readFileSync(`app/api/${p}/route.ts`, "utf8");
      const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
      expect(imports, p).toEqual(["@/lib/retired"]);
    }
  });

  it("the credit and chat code is gone", () => {
    for (const p of ["lib/credits.ts", "lib/usedTx.ts", "lib/purchaseVerification.ts", "app/chat", "app/credits", "app/build", "app/grants"]) {
      expect(existsSync(p), p).toBe(false);
    }
  });

  it("no page, component or lib calls the retired APIs", () => {
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === "api" ? [] : walk(`${d}/${e.name}`)) : [`${d}/${e.name}`]));
    for (const f of [...walk("app"), ...walk("lib")]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/\/api\/(chat|copilot|credits|payment-history)\b/);
    }
  });
});
