// Single source of truth for Arc network parameters.
// Source: https://docs.arc.io/arc/references/connect-to-arc (verified 2026-10-09).
// Safe to import from client and server code (no secrets).

export type ArcNetworkId = "mainnet" | "testnet";

export interface ArcNetwork {
  id: ArcNetworkId;
  name: string;
  chainId: number;
  chainIdHex: string;
  rpcUrl: string;
  explorerUrl: string;
  explorerApiUrl: string;
  // Gas is paid in USDC. The native balance uses 18 decimals; the USDC ERC-20
  // interface uses 6 (see lib/arcAddresses.ts).
  nativeCurrency: { name: string; symbol: string; decimals: number };
  faucetUrl?: string;
}

export const ARC_NETWORKS: Record<ArcNetworkId, ArcNetwork> = {
  mainnet: {
    id: "mainnet",
    name: "Arc Mainnet",
    chainId: 5042,
    chainIdHex: "0x13b2",
    rpcUrl: "https://rpc.mainnet.arc.io",
    explorerUrl: "https://explorer.arc.io",
    explorerApiUrl: "https://explorer.arc.io/api/v2",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  },
  testnet: {
    id: "testnet",
    name: "Arc Testnet",
    chainId: 5042002,
    chainIdHex: "0x4cef52",
    rpcUrl: "https://rpc.testnet.arc.io",
    explorerUrl: "https://explorer.testnet.arc.io",
    explorerApiUrl: "https://explorer.testnet.arc.io/api/v2",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
    faucetUrl: "https://faucet.circle.com",
  },
};

// MicroAI runs on Mainnet.
export const ARC_MAINNET = ARC_NETWORKS.mainnet;

// USDC ERC-20 interface (6 decimals), same address on both networks.
export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

// Wallet that receives credit purchases. Public by design.
export const PAYMENT_RECEIVER = "0x78C144A76614A8674285129810555C8bCa78f044";

// keccak256("Transfer(address,address,uint256)")
export const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
