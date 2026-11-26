import { ARC_NETWORKS } from "@/lib/arcConfig";
import { rpcCall } from "@/lib/arcRpc";

// Public, read-only chain reads for the pre-checks. No credentials involved.
const url = { url: ARC_NETWORKS.mainnet.rpcUrl };

/** ERC-20 balance of `owner`, in the token's smallest unit. */
export async function tokenBalance(token: string, owner: string): Promise<bigint> {
  const data = "0x70a08231" + owner.slice(2).toLowerCase().padStart(64, "0");
  const out = await rpcCall<string>("eth_call", [{ to: token, data }, "latest"], url);
  return /^0x[0-9a-fA-F]+$/.test(out) ? BigInt(out) : BigInt(0);
}

/** Native balance (USDC, 18 decimals) used to pay gas. */
export async function gasBalance(owner: string): Promise<bigint> {
  const out = await rpcCall<string>("eth_getBalance", [owner, "latest"], url);
  return /^0x[0-9a-fA-F]+$/.test(out) ? BigInt(out) : BigInt(0);
}
