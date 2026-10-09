import { describe, it, expect } from "vitest";
import { buildSiweMessage, parseSiweMessage, validateSiweFields, SIWE_STATEMENT, type SiweFields } from "@/lib/siwe";

const NOW = Date.parse("2026-10-09T12:00:00.000Z");
const base: SiweFields = {
  domain: "microai.example",
  address: "0x4fD87e600D703c0c05C01096B8b3451192E54F29",
  statement: SIWE_STATEMENT,
  uri: "https://microai.example",
  version: "1",
  chainId: 5042,
  nonce: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
  issuedAt: "2026-10-09T12:00:00.000Z",
  expirationTime: "2026-10-09T12:05:00.000Z",
};
const expectations = { domain: "microai.example", uri: "https://microai.example", chainId: 5042, now: NOW };

describe("EIP-4361 message", () => {
  it("builds the exact EIP-4361 layout", () => {
    expect(buildSiweMessage(base)).toBe(
      [
        "microai.example wants you to sign in with your Ethereum account:",
        "0x4fD87e600D703c0c05C01096B8b3451192E54F29",
        "",
        SIWE_STATEMENT,
        "",
        "URI: https://microai.example",
        "Version: 1",
        "Chain ID: 5042",
        "Nonce: a1b2c3d4e5f60718293a4b5c6d7e8f90",
        "Issued At: 2026-10-09T12:00:00.000Z",
        "Expiration Time: 2026-10-09T12:05:00.000Z",
      ].join("\n")
    );
  });

  it("round-trips through the parser", () => {
    expect(parseSiweMessage(buildSiweMessage(base))).toEqual(base);
  });

  it("rejects malformed or padded messages", () => {
    const good = buildSiweMessage(base);
    expect(parseSiweMessage("")).toBeNull();
    expect(parseSiweMessage(good + "\nResources:\n- https://evil.example")).toBeNull();
    expect(parseSiweMessage(good.replace("Chain ID: 5042", "Chain ID: abc"))).toBeNull();
    expect(parseSiweMessage(good.replace(base.address, "0x123"))).toBeNull();
    expect(parseSiweMessage(good.replace(base.nonce, "short"))).toBeNull();
    expect(parseSiweMessage(good.replace("wants you to sign in with your Ethereum account:", "wants you to do something else:"))).toBeNull();
  });
});

describe("validateSiweFields", () => {
  it("accepts a fresh message for this domain and chain", () => {
    expect(validateSiweFields(base, expectations)).toBeNull();
  });
  it("rejects a different domain", () => {
    expect(validateSiweFields({ ...base, domain: "evil.example" }, expectations)).toMatch(/different domain/);
  });
  it("rejects a different URI", () => {
    expect(validateSiweFields({ ...base, uri: "https://evil.example" }, expectations)).toMatch(/URI/);
  });
  it("rejects the wrong chain (including Ethereum mainnet and Arc Testnet)", () => {
    expect(validateSiweFields({ ...base, chainId: 1 }, expectations)).toMatch(/different chain/);
    expect(validateSiweFields({ ...base, chainId: 5042002 }, expectations)).toMatch(/different chain/);
  });
  it("rejects expired messages", () => {
    expect(validateSiweFields(base, { ...expectations, now: NOW + 5 * 60_000 })).toMatch(/expired/);
  });
  it("rejects a message issued in the future", () => {
    expect(validateSiweFields({ ...base, issuedAt: "2026-10-09T13:00:00.000Z", expirationTime: "2026-10-09T13:05:00.000Z" }, expectations)).toMatch(/future/);
  });
  it("rejects over-long lifetimes and bad versions/statements", () => {
    expect(validateSiweFields({ ...base, expirationTime: "2026-10-09T12:30:00.000Z" }, expectations)).toMatch(/too long/);
    expect(validateSiweFields({ ...base, version: "2" }, expectations)).toMatch(/version/);
    expect(validateSiweFields({ ...base, statement: "Send me all your USDC" }, expectations)).toMatch(/statement/);
  });
});
