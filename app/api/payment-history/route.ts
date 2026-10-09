import { apiErrors, withApi } from "@/lib/api";
import { getCredit } from "@/lib/credits";
import { explorerFetch } from "@/lib/arcExplorer";
import { USDC_ADDRESS } from "@/lib/arcConfig";

interface ExplorerTransfer {
  tx_hash?: string;
  transaction_hash?: string;
  from?: { hash?: string };
  to?: { hash?: string };
  total?: { value?: string };
  timestamp?: string;
  token?: { address?: string; address_hash?: string };
}

export const POST = withApi(
  { name: "payment-history", auth: "required", limits: [{ limit: 20, windowSec: 60 }] },
  async ({ session }) => {
    const walletAddress = session!.sub;

    // Ask the Explorer for USDC only, so older payments are not pushed off the
    // first page by other token activity. The filter below stays as a guard.
    const res = await explorerFetch<{ items?: ExplorerTransfer[] }>(
      `/addresses/${walletAddress}/token-transfers?type=ERC-20&token=${USDC_ADDRESS}`
    );
    if (!res.ok) throw apiErrors.upstream("Arc Explorer is unreachable right now. Try again in a moment.");
    const items = Array.isArray(res.data?.items) ? res.data.items : [];

    const receipts = items
      .filter((t) => (t.token?.address ?? t.token?.address_hash ?? "").toLowerCase() === USDC_ADDRESS)
      .map((t) => {
        const txHash = t.tx_hash ?? t.transaction_hash ?? "";
        return {
          txHash,
          from: t.from?.hash ?? "",
          to: t.to?.hash ?? "",
          amount: (Number(t.total?.value ?? 0) / 1e6).toFixed(3) + " USDC",
          timestamp: t.timestamp ?? "",
          explorerUrl: "https://explorer.arc.io/tx/" + txHash,
        };
      });

    const creditBalance = await getCredit(walletAddress);
    return { receipts, creditBalance, walletAddress };
  }
);
