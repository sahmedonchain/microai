import { AbiCoder, Interface, id } from "ethers";
import { describe, expect, it } from "vitest";
import { decodeFunction, decodeLogs, decodeRevertData, diagnose, isX402Settlement, normalizeRevert, type DiagnoseInput, type RevertInfo } from "@/lib/debug/diagnose";

const coder = AbiCoder.defaultAbiCoder();
const sel = (s: string) => id(s).slice(0, 10);
const errorString = (msg: string) => sel("Error(string)") + coder.encode(["string"], [msg]).slice(2);
const panic = (code: number) => sel("Panic(uint256)") + coder.encode(["uint256"], [code]).slice(2);
const ADDR = "0x" + "ab".repeat(20);
const ADDR2 = "0x" + "cd".repeat(20);
const NONCE = "0x" + "11".repeat(32);
const AUTH_INPUT = sel("transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)") + "00".repeat(8);

describe("decodeFunction", () => {
  it("names known selectors and says unknown for the rest", () => {
    expect(decodeFunction(sel("transfer(address,uint256)") + "00")).toBe("transfer(address,uint256)");
    expect(decodeFunction(AUTH_INPUT)).toMatch(/^transferWithAuthorization\(/);
    expect(decodeFunction("0xdeadbeef00")).toBe("unknown");
    expect(decodeFunction(undefined)).toBe("unknown");
    expect(decodeFunction("0x12")).toBe("unknown");
  });
  it("recognises x402 settlement calls only", () => {
    expect(isX402Settlement(AUTH_INPUT)).toBe(true);
    expect(isX402Settlement(sel("transfer(address,uint256)"))).toBe(false);
    expect(isX402Settlement(undefined)).toBe(false);
  });
});

describe("decodeRevertData", () => {
  it("decodes Error(string)", () => {
    expect(decodeRevertData(errorString("FiatTokenV2: authorization is expired"))).toEqual({ kind: "message", message: "FiatTokenV2: authorization is expired" });
  });
  it("decodes Panic(uint256) with its meaning", () => {
    expect(decodeRevertData(panic(0x11))).toEqual({ kind: "panic", code: "0x11", meaning: "arithmetic overflow or underflow" });
    expect(decodeRevertData(panic(0x99))).toMatchObject({ kind: "panic", meaning: "unknown panic code" });
  });
  it("decodes a known custom error with its arguments", () => {
    const iface = new Interface(["error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)"]);
    const data = iface.encodeErrorResult("ERC20InsufficientBalance", [ADDR, 5, 10]);
    const r = decodeRevertData(data);
    expect(r).toMatchObject({ kind: "custom", selector: data.slice(0, 10), name: "ERC20InsufficientBalance" });
    const args = (r as { args: Record<string, string> }).args;
    expect(Object.values(args).map((v) => v.toLowerCase())).toEqual([ADDR, "5", "10"]);
  });
  it("reports an unknown custom error by selector only", () => {
    expect(decodeRevertData("0xdeadbeef")).toEqual({ kind: "custom", selector: "0xdeadbeef" });
  });
  it("handles empty, malformed and truncated data without throwing", () => {
    expect(decodeRevertData("0x")).toEqual({ kind: "empty" });
    expect(decodeRevertData("")).toEqual({ kind: "empty" });
    expect(decodeRevertData("not hex")).toEqual({ kind: "none" });
    expect(decodeRevertData(sel("Error(string)") + "00")).toMatchObject({ kind: "custom" });
  });
});

describe("normalizeRevert", () => {
  it("takes hex, plain text, or an object holding either", () => {
    expect(normalizeRevert(errorString("boom"))).toEqual({ kind: "message", message: "boom" });
    expect(normalizeRevert("execution reverted: nope")).toEqual({ kind: "message", message: "execution reverted: nope" });
    expect(normalizeRevert({ raw: errorString("boom") })).toEqual({ kind: "message", message: "boom" });
    expect(normalizeRevert({ message: "hi" })).toEqual({ kind: "message", message: "hi" });
  });
  it("treats junk as no reason", () => {
    for (const v of [undefined, null, "", "  ", 5, [], {}]) expect(normalizeRevert(v)).toEqual({ kind: "none" });
  });
  it("caps long messages", () => {
    const out = normalizeRevert("x".repeat(5000));
    expect(out.kind === "message" && out.message.length).toBe(300);
  });
});

describe("decodeLogs", () => {
  const iface = new Interface([
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)",
    "event Transfer721(address indexed from, address indexed to, uint256 indexed id)",
  ]);
  const log = (name: string, args: unknown[]) => {
    const e = iface.encodeEventLog(name, args);
    return { address: ADDR, topics: e.topics, data: e.data };
  };

  it("decodes ERC-20 Transfer and EIP-3009 AuthorizationUsed", () => {
    const r = decodeLogs([log("Transfer", [ADDR, ADDR2, 1000]), log("AuthorizationUsed", [ADDR, NONCE])]);
    expect(r.events.map((e) => e.name)).toEqual(["Transfer", "AuthorizationUsed"]);
    expect(Object.values(r.events[0].args).map((v) => v.toLowerCase())).toEqual([ADDR, ADDR2, "1000"]);
    expect(Object.values(r.events[1].args).map((v) => v.toLowerCase())).toContain(NONCE);
    expect(r.unknown).toBe(0);
  });
  it("counts logs it does not know instead of guessing", () => {
    const r = decodeLogs([{ address: ADDR, topics: ["0x" + "99".repeat(32)], data: "0x" }, log("Transfer721", [ADDR, ADDR2, 7]), { topics: [] }]);
    expect(r.events).toEqual([]);
    expect(r.unknown).toBe(3);
  });
  it("caps the number of logs it reads", () => {
    const many = Array.from({ length: 200 }, () => log("Transfer", [ADDR, ADDR2, 1]));
    expect(decodeLogs(many).events).toHaveLength(50);
  });
});

describe("diagnose", () => {
  const base = (over: Partial<DiagnoseInput> = {}): DiagnoseInput => ({ result: "failure", status: "error", revert: { kind: "none" } as RevertInfo, events: [], ...over });
  const top = (d: ReturnType<typeof diagnose>) => d.map((x) => `${x.confidence}:${x.id}`);

  it("a successful ordinary transaction has nothing to diagnose", () => {
    expect(diagnose(base({ result: "success", status: "ok" }))).toEqual([]);
  });

  it("a successful settlement confirms the authorization was used, and says nothing about delivery being confirmed", () => {
    const d = diagnose(base({ result: "success", status: "ok", events: [{ name: "AuthorizationUsed", address: ADDR, args: { authorizer: ADDR2, nonce: NONCE } }] }));
    expect(top(d)).toEqual(["confirmed:x402.settled"]);
    expect(d[0].detail).toMatch(/does not confirm that a service delivered/);
  });

  it.each([
    ["FiatTokenV2: authorization is not yet valid", "auth.not_yet_valid"],
    ["FiatTokenV2: authorization is expired", "auth.expired"],
    ["FiatTokenV2: authorization is used or canceled", "auth.used"],
    ["FiatTokenV2: invalid signature", "auth.bad_signature"],
    ["FiatTokenV2: caller must be the payee", "auth.payee"],
  ])("a settlement that reverts with %s is confirmed as %s", (message, idExpected) => {
    const d = diagnose(base({ revert: { kind: "message", message }, rawInput: AUTH_INPUT }));
    expect(top(d)).toContain(`confirmed:${idExpected}`);
    expect(d.find((x) => x.id === idExpected)!.evidence[0]).toContain(message);
  });

  it("the same message on a non-settlement call is not read as an x402 finding", () => {
    const d = diagnose(base({ revert: { kind: "message", message: "authorization is expired" }, rawInput: sel("transfer(address,uint256)") }));
    expect(top(d)).toEqual(["confirmed:revert.message"]);
  });

  it("a balance message and the ERC-20 custom errors are confirmed", () => {
    expect(top(diagnose(base({ revert: { kind: "message", message: "ERC20: transfer amount exceeds balance" } })))).toEqual(["confirmed:revert.balance"]);
    expect(top(diagnose(base({ revert: { kind: "custom", selector: "0x1", name: "ERC20InsufficientBalance", args: { balance: "1", needed: "2" } } })))).toEqual(["confirmed:revert.erc20_balance"]);
    expect(top(diagnose(base({ revert: { kind: "custom", selector: "0x1", name: "ERC20InsufficientAllowance" } })))).toEqual(["confirmed:revert.erc20_allowance"]);
  });

  it("a panic is confirmed with its code", () => {
    const d = diagnose(base({ revert: { kind: "panic", code: "0x11", meaning: "arithmetic overflow or underflow" } }));
    expect(top(d)).toEqual(["confirmed:revert.panic"]);
    expect(d[0].evidence).toEqual(["panic code: 0x11"]);
  });

  it("an unnamed custom error is unknown, not guessed", () => {
    expect(top(diagnose(base({ revert: { kind: "custom", selector: "0xdeadbeef" } })))).toEqual(["unknown:revert.custom_unknown"]);
  });

  it("near-total gas use with no reason is only PROBABLE out of gas", () => {
    const d = diagnose(base({ revert: { kind: "empty" }, gasUsed: "99000", gasLimit: "100000" }));
    expect(top(d)).toEqual(["probable:gas.probable"]);
  });
  it("low gas use or a real revert reason never produces an out-of-gas guess", () => {
    expect(top(diagnose(base({ gasUsed: "50000", gasLimit: "100000" })))).toEqual(["unknown:revert.no_reason"]);
    expect(top(diagnose(base({ revert: { kind: "message", message: "nope" }, gasUsed: "100000", gasLimit: "100000" })))).toEqual(["confirmed:revert.message"]);
  });
  it("out of gas is confirmed only when the Explorer says so", () => {
    expect(top(diagnose(base({ result: "out of gas" })))).toEqual(["confirmed:gas.out"]);
  });

  it("a failure with no information says the cause is unknown", () => {
    expect(top(diagnose(base()))).toEqual(["unknown:revert.no_reason"]);
  });
  it("an unexplained settlement failure adds x402 context, but as unknown", () => {
    const d = diagnose(base({ revert: { kind: "empty" }, rawInput: AUTH_INPUT }));
    expect(top(d)).toEqual(["unknown:revert.no_reason", "unknown:x402.context"]);
  });

  it("every confirmed finding carries evidence", () => {
    const cases: Partial<DiagnoseInput>[] = [
      { revert: { kind: "message", message: "m" } },
      { revert: { kind: "panic", code: "0x01", meaning: "assert failed" } },
      { revert: { kind: "custom", selector: "0x1", name: "ERC20InsufficientAllowance", args: { a: "1" } } },
      { result: "out of gas" },
    ];
    for (const c of cases) for (const x of diagnose(base(c))) if (x.confidence === "confirmed") expect(x.evidence.length, x.id).toBeGreaterThan(0);
  });
});
