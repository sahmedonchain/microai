import { describe, it, expect } from "vitest";
import { ethers } from "ethers";
import { ARC_ADDRESSES, describeAddress, getAddress, type AddressEntry } from "@/lib/arcAddresses";
import { ARC_NETWORKS } from "@/lib/arcConfig";

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
