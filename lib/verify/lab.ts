import { ARC_ADDRESSES } from "@/lib/arcAddresses";
import { ARC_NETWORKS } from "@/lib/arcConfig";

// The Testnet lab: small payments on Arc Testnet whose correct verdict is known
// in advance, so MicroAI Verify can be shown judging each one. Testnet only, no
// real money. The recipients are fixed lab addresses nobody owns.

/** The recipient the lab endpoint (/api/lab/x402/good) asks to be paid. */
export const LAB_RECIPIENT = "0x1111111111111111111111111111111111111111";
/** A different address, for the wrong-recipient scenario. */
export const LAB_OTHER_RECIPIENT = "0x2222222222222222222222222222222222222222";
/** What the lab endpoint asks for: 0.01 USDC in the token's smallest unit. */
export const LAB_PRICE_UNITS = "10000";

export const TESTNET = ARC_NETWORKS.testnet;
export const TESTNET_USDC = ARC_ADDRESSES.usdc.testnet;
export const TESTNET_EURC = ARC_ADDRESSES.eurc.testnet;

export interface LabScenario {
  id: string;
  title: string;
  /** What this test payment does. */
  does: string;
  token: "USDC" | "EURC";
  /** Smallest units (6 decimals). */
  units: string;
  to: string;
  /** What Verify should say about it. */
  expected: string;
  severity: "ok" | "warning" | "error";
}

export const LAB_SCENARIOS: LabScenario[] = [
  { id: "exact", title: "The correct payment", does: "Sends exactly 0.01 USDC to the address the lab endpoint asks for.", token: "USDC", units: LAB_PRICE_UNITS, to: LAB_RECIPIENT, expected: "Passed: Paid exactly 0.01 USDC to the recipient", severity: "ok" },
  { id: "under", title: "Paying too little", does: "Sends 0.005 USDC, half of the price.", token: "USDC", units: "5000", to: LAB_RECIPIENT, expected: "Error: Paid less than the endpoint asked for", severity: "error" },
  { id: "over", title: "Paying too much", does: "Sends 0.02 USDC, double the price.", token: "USDC", units: "20000", to: LAB_RECIPIENT, expected: "Warning: Paid more than the endpoint asked for", severity: "warning" },
  { id: "recipient", title: "Paying the wrong address", does: "Sends the right amount of USDC to a different address.", token: "USDC", units: LAB_PRICE_UNITS, to: LAB_OTHER_RECIPIENT, expected: "Error: The payment went to a different recipient", severity: "error" },
  { id: "token", title: "Paying in the wrong token", does: "Sends 0.01 EURC instead of USDC (needs test EURC from the faucet).", token: "EURC", units: LAB_PRICE_UNITS, to: LAB_RECIPIENT, expected: "Error: The recipient was paid in a different token", severity: "error" },
];

/** ABI-encodes ERC-20 transfer(address,uint256) as transaction data. */
export function encodeErc20Transfer(to: string, units: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(to)) throw new Error("Invalid address");
  if (!/^\d+$/.test(units)) throw new Error("Invalid amount");
  const hex = BigInt(units).toString(16);
  if (hex.length > 64) throw new Error("Amount too large");
  return "0xa9059cbb" + to.slice(2).toLowerCase().padStart(64, "0") + hex.padStart(64, "0");
}

export function tokenAddress(token: "USDC" | "EURC"): string {
  return token === "USDC" ? TESTNET_USDC : TESTNET_EURC;
}

/** The wallet_addEthereumChain parameters for Arc Testnet. */
export const TESTNET_CHAIN_PARAMS = {
  chainId: TESTNET.chainIdHex,
  chainName: TESTNET.name,
  nativeCurrency: TESTNET.nativeCurrency,
  rpcUrls: [TESTNET.rpcUrl],
  blockExplorerUrls: [TESTNET.explorerUrl],
};

/** A /verify link that fills in a check and, with run=1, starts it. */
export function verifyLink(origin: string, opts: { txHash: string; network: "mainnet" | "testnet"; useEndpoint: boolean }): string {
  const q = new URLSearchParams();
  if (opts.useEndpoint) q.set("url", `${origin}/api/lab/x402/good`);
  else {
    q.set("to", LAB_RECIPIENT);
    q.set("amount", "0.01");
  }
  q.set("tx", opts.txHash);
  q.set("network", opts.network);
  q.set("run", "1");
  return `/verify?${q.toString()}`;
}

/** Turns a wallet error into a plain sentence. Wallets follow EIP-1193 error codes. */
export function walletErrorMessage(err: unknown): string {
  const e = err as { code?: number; message?: string } | null;
  switch (e?.code) {
    case 4001:
      return "You rejected the request in your wallet.";
    case 4100:
      return "Your wallet has not approved this site for the selected account. Click Connect wallet again, approve the account and the Arc Testnet switch, then try once more.";
    case -32002:
      return "Your wallet already has a request waiting. Open the wallet, finish or reject it, then try again.";
    case 4902:
      return "Your wallet does not know Arc Testnet yet. Approve adding the network when it asks.";
    default:
      return (e?.message || "Something went wrong.").slice(0, 200);
  }
}
