import { apiErrors, parseQuery, withApi } from "@/lib/api";
import { rpcCall, RpcError } from "@/lib/arcRpc";
import { ARC_ADDRESSES } from "@/lib/arcAddresses";
import { PAYMENT_RECEIVER, USDC_ADDRESS } from "@/lib/arcConfig";
import { chainQuery } from "@/lib/schemas";

// Read-only chain data for the Stats page. Fixed reads only: block height, gas
// price, chain id, the receiver's USDC balance, and token balances for one
// address. No arbitrary RPC method or parameter is ever forwarded.
const EURC_ADDRESS = ARC_ADDRESSES.eurc.mainnet;

const balanceOfData = (address: string) => "0x70a08231" + address.slice(2).toLowerCase().padStart(64, "0");
const tokenBalance = (token: string, holder: string) =>
  rpcCall<string>("eth_call", [{ to: token, data: balanceOfData(holder) }, "latest"]);

export const GET = withApi(
  { name: "chain", limits: [{ limit: 90, windowSec: 60 }] },
  async ({ req }) => {
    const q = parseQuery(req, chainQuery);
    try {
      if (q.kind === "network") {
        const [blockHex, gasPriceHex, chainIdHex] = await Promise.all([
          rpcCall<string>("eth_blockNumber"),
          rpcCall<string>("eth_gasPrice"),
          rpcCall<string>("eth_chainId"),
        ]);
        return { blockHex, gasPriceHex, chainIdHex };
      }
      if (q.kind === "revenue") {
        return { usdcHex: await tokenBalance(USDC_ADDRESS, PAYMENT_RECEIVER) };
      }
      const [usdcHex, eurcHex, nativeHex] = await Promise.all([
        tokenBalance(USDC_ADDRESS, q.address),
        tokenBalance(EURC_ADDRESS, q.address),
        rpcCall<string>("eth_getBalance", [q.address, "latest"]),
      ]);
      return { usdcHex, eurcHex, nativeHex };
    } catch (err) {
      if (err instanceof RpcError) throw apiErrors.upstream("Arc RPC is unavailable right now. Try again shortly.");
      throw err;
    }
  }
);
