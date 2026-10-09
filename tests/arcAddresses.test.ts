import { describe, it, expect } from "vitest";
import { ethers } from "ethers";
import { ARC_ADDRESSES, describeAddress, getAddress, type AddressEntry } from "@/lib/arcAddresses";
import { ARC_NETWORKS } from "@/lib/arcConfig";
import { knowledgeBase } from "@/lib/knowledge";
import { buildSystemPrompt } from "@/lib/copilotPrompt";

const entries = Object.entries(ARC_ADDRESSES) as [string, AddressEntry][];
const allAddresses = entries.flatMap(([k, e]) => (["mainnet", "testnet"] as const).flatMap((n) => (e[n] ? [{ key: k, network: n, address: e[n]! }] : [])));

describe("address registry", () => {
  it("contains only valid EVM addresses, with valid checksums when mixed-case", () => {
    for (const { key, network, address } of allAddresses) {
      expect(ethers.isAddress(address), `${key}/${network}`).toBe(true);
      if (address !== address.toLowerCase()) expect(ethers.getAddress(address), `${key}/${network}`).toBe(address);
    }
  });

  it("gives every entry a docs source URL", () => {
    for (const [key, e] of entries) expect(e.source, key).toMatch(/^https:\/\/(docs\.arc\.io|developers\.circle\.com)\//);
  });

  it("keeps Mainnet and Testnet apart for the entries that differ", () => {
    for (const key of ["eurc", "usyc", "tokenMessengerV2", "messageTransmitterV2", "gatewayWallet", "gatewayMinter", "fxEscrow"] as const) {
      expect(getAddress(key, "mainnet")!.toLowerCase(), key).not.toBe(getAddress(key, "testnet")!.toLowerCase());
    }
  });

  it("publishes no Mainnet address for the Testnet-only entries", () => {
    for (const key of ["erc8004Identity", "erc8004Reputation", "erc8004Validation", "erc8183AgenticCommerce", "usycTeller", "usycEntitlements"] as const) {
      expect(getAddress(key, "mainnet"), key).toBeUndefined();
      expect(describeAddress(key)).toContain("Mainnet not published");
    }
  });

  it("matches the values on docs.arc.io/arc/references/contract-addresses (snapshot of 2026-10-09)", () => {
    expect(getAddress("tokenMessengerV2", "mainnet")).toBe("0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d");
    expect(getAddress("gatewayWallet", "mainnet")).toBe("0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE");
    expect(getAddress("usyc", "mainnet")).toBe("0x8a5D989Bbb96929F689B0200f435f53dA42bF490");
  });
});

describe("network config", () => {
  it("has the documented chain IDs and matching hex", () => {
    expect(ARC_NETWORKS.mainnet.chainId).toBe(5042);
    expect(ARC_NETWORKS.testnet.chainId).toBe(5042002);
    for (const n of Object.values(ARC_NETWORKS)) expect(n.chainIdHex).toBe("0x" + n.chainId.toString(16));
  });
});

describe("knowledge base and prompts use the registry", () => {
  const testnetOnly = allAddresses.filter((a) => a.network === "testnet" && getAddress(a.key as never, "mainnet") !== a.address && a.address.toLowerCase() !== getAddress(a.key as never, "mainnet")?.toLowerCase());
  const lines = knowledgeBase.flatMap((item) => item.content.split("\n"));

  it("never prints a Testnet-only address without saying Testnet", () => {
    for (const { address } of testnetOnly) {
      for (const line of lines.filter((l) => l.toLowerCase().includes(address.toLowerCase()))) {
        expect(line.toLowerCase(), `${address}: ${line}`).toMatch(/testnet/);
      }
    }
  });

  it("no longer lists the removed unverifiable addresses", () => {
    const text = lines.join("\n");
    expect(text).not.toContain("0xb43db544E2c27092c107639Ad201b3dEfAbcF192"); // TokenMinterV2, not in docs
    expect(text).not.toContain("0x867650F5eAe8df91445971f14d89fd84F0C9a9f8"); // old FxEscrow value, matches neither network
  });

  it("copilot prompt carries both networks and Testnet-only notes", () => {
    const p = buildSystemPrompt("GENERAL");
    expect(p).toContain("5042002");
    expect(p).toContain("0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d");
    expect(p).toContain("Mainnet not published");
  });
});
