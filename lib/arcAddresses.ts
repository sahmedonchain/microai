// Verified Arc address registry. Every entry names its network and the docs
// page it was taken from. Nothing here may be guessed: if a value cannot be
// confirmed on a docs page, leave it out (the AI prompts then say
// "verify in Arc docs").
//
// Verified 2026-10-09 against:
//   CONTRACTS  https://docs.arc.io/arc/references/contract-addresses
//   ERC8004    https://docs.arc.io/arc/tutorials/register-your-first-ai-agent
//   ERC8183    https://docs.arc.io/arc/tutorials/create-your-first-erc-8183-job
//   USYC       https://developers.circle.com/tokenized/usyc/smart-contracts

import { ARC_NETWORKS, type ArcNetworkId } from "./arcConfig";

const CONTRACTS = "https://docs.arc.io/arc/references/contract-addresses";
const ERC8004 = "https://docs.arc.io/arc/tutorials/register-your-first-ai-agent";
const ERC8183 = "https://docs.arc.io/arc/tutorials/create-your-first-erc-8183-job";
const USYC_DOCS = "https://developers.circle.com/tokenized/usyc/smart-contracts";

export interface AddressEntry {
  label: string;
  decimals?: number;
  source: string;
  mainnet?: string;
  testnet?: string;
}

export const ARC_ADDRESSES = {
  usdc: {
    label: "USDC (ERC-20 interface)",
    decimals: 6,
    source: CONTRACTS,
    mainnet: "0x3600000000000000000000000000000000000000",
    testnet: "0x3600000000000000000000000000000000000000",
  },
  eurc: {
    label: "EURC",
    decimals: 6,
    source: CONTRACTS,
    mainnet: "0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1",
    testnet: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  },
  usyc: {
    label: "USYC",
    decimals: 6,
    source: CONTRACTS,
    mainnet: "0x8a5D989Bbb96929F689B0200f435f53dA42bF490",
    testnet: "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C",
  },
  tokenMessengerV2: {
    label: "CCTP TokenMessengerV2 (domain 26)",
    source: CONTRACTS,
    mainnet: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
    testnet: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
  },
  messageTransmitterV2: {
    label: "CCTP MessageTransmitterV2 (domain 26)",
    source: CONTRACTS,
    mainnet: "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64",
    testnet: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
  },
  gatewayWallet: {
    label: "Gateway Wallet (domain 26)",
    source: CONTRACTS,
    mainnet: "0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE",
    testnet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
  },
  gatewayMinter: {
    label: "Gateway Minter (domain 26)",
    source: CONTRACTS,
    mainnet: "0x2222222d7164433c4C09B0b0D809a9b52C04C205",
    testnet: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B",
  },
  multicall3: {
    label: "Multicall3",
    source: CONTRACTS,
    mainnet: "0xcA11bde05977b3631167028862bE2a173976CA11",
    testnet: "0xcA11bde05977b3631167028862bE2a173976CA11",
  },
  permit2: {
    label: "Permit2",
    source: CONTRACTS,
    mainnet: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    testnet: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  },
  fxEscrow: {
    label: "StableFX FxEscrow",
    source: CONTRACTS,
    mainnet: "0xe2E5F173576B513d994073CCbDaCBE027d43DFe6",
    testnet: "0xd68256f4D69C6BbEcB873D8588AE0Dc6B8E22E10",
  },
  // Testnet only: the docs publish no Mainnet address for these.
  erc8004Identity: {
    label: "ERC-8004 IdentityRegistry",
    source: ERC8004,
    testnet: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  },
  erc8004Reputation: {
    label: "ERC-8004 ReputationRegistry",
    source: ERC8004,
    testnet: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
  },
  erc8004Validation: {
    label: "ERC-8004 ValidationRegistry",
    source: ERC8004,
    testnet: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272",
  },
  erc8183AgenticCommerce: {
    label: "ERC-8183 AgenticCommerce",
    source: ERC8183,
    testnet: "0x0747EEf0706327138c69792bF28Cd525089e4583",
  },
  usycTeller: {
    label: "USYC Teller",
    source: USYC_DOCS,
    testnet: "0x9fdF14c5B14173D74C08Af27AebFf39240dC105A",
  },
  usycEntitlements: {
    label: "USYC Entitlements",
    source: USYC_DOCS,
    testnet: "0xcc205224862c7641930c87679e98999d23c26113",
  },
} as const satisfies Record<string, AddressEntry>;

export type AddressKey = keyof typeof ARC_ADDRESSES;

export function getAddress(key: AddressKey, network: ArcNetworkId): string | undefined {
  return (ARC_ADDRESSES[key] as AddressEntry)[network];
}

// "label: Mainnet 0x... | Testnet 0x..." with an explicit note for entries that
// exist on one network only. Used by the AI prompts and the knowledge base so
// every address they print carries its network.
export function describeAddress(key: AddressKey): string {
  const e = ARC_ADDRESSES[key] as AddressEntry;
  const parts: string[] = [];
  if (e.mainnet && e.testnet && e.mainnet.toLowerCase() === e.testnet.toLowerCase()) {
    parts.push(`${e.mainnet} (Mainnet and Testnet)`);
  } else {
    parts.push(e.mainnet ? `Mainnet ${e.mainnet}` : "Mainnet not published in the Arc docs (verify in Arc docs)");
    if (e.testnet) parts.push(`Testnet ${e.testnet}`);
  }
  return `${e.label}: ${parts.join(" | ")}`;
}

export function describeAddresses(keys: readonly AddressKey[]): string {
  return keys.map((k) => `- ${describeAddress(k)}`).join("\n");
}

export const ALL_ADDRESS_KEYS = Object.keys(ARC_ADDRESSES) as AddressKey[];

export function networkSummary(): string {
  const m = ARC_NETWORKS.mainnet;
  const t = ARC_NETWORKS.testnet;
  return [
    `- ${m.name}: chain ID ${m.chainId} (${m.chainIdHex}). RPC ${m.rpcUrl}. Explorer ${m.explorerUrl}.`,
    `- ${t.name}: chain ID ${t.chainId} (${t.chainIdHex}). RPC ${t.rpcUrl}. Explorer ${t.explorerUrl}. Faucet ${t.faucetUrl}.`,
  ].join("\n");
}
