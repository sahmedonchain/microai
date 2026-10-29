import { apiErrors, parseJson, withApi } from "@/lib/api";
import { ARC_NETWORKS, USDC_ADDRESS, type ArcNetworkId } from "@/lib/arcConfig";
import { RpcError } from "@/lib/arcRpc";
import { SafeFetchError } from "@/lib/safeFetch";
import { describeFetchError, fetchChallenge } from "@/lib/verify/fetchEndpoint";
import { countFindings, sortFindings, verifyEndpointResponse } from "@/lib/verify/checks";
import { selectPaymentOption } from "@/lib/verify/option";
import { verifyTransaction, type ExpectedPayment } from "@/lib/verify/txVerify";
import type { EndpointResponse, Finding, VerifyReport } from "@/lib/verify/types";
import { verifyBody } from "@/lib/schemas";

// MicroAI Verify: reads an x402 endpoint's 402 answer and checks it against
// what is known about Arc, and/or checks a transaction against what the
// endpoint asked for. It sends no payment and no body, only a GET without
// payment, through the guarded outbound client.

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "invalid";
  }
}

function txResult(network: ArcNetworkId | undefined, txHash: string, findings: Finding[]) {
  const sorted = sortFindings(findings);
  return {
    network,
    txHash,
    explorerUrl: network ? `${ARC_NETWORKS[network].explorerUrl}/tx/${txHash}` : undefined,
    findings: sorted,
    counts: countFindings(sorted),
  };
}

export const POST = withApi(
  {
    name: "verify",
    pause: "verify",
    onLimiterError: "closed",
    auth: "none",
    limits: [
      { limit: 5, windowSec: 60 },
      { limit: 40, windowSec: 86_400 },
      { limit: 2000, windowSec: 86_400, scope: "global" },
    ],
  },
  async ({ req, log }) => {
    const { url, network, txHash, expect } = await parseJson(req, verifyBody);

    let response: EndpointResponse | undefined;
    let report: VerifyReport | undefined;
    if (url) {
      try {
        response = await fetchChallenge(url);
      } catch (err) {
        if (err instanceof SafeFetchError) {
          const problem = describeFetchError(err);
          log.warn("verify fetch refused or failed", { code: err.code, host: hostOf(url) });
          throw problem.kind === "invalid" ? apiErrors.badRequest(problem.message) : apiErrors.upstream(problem.message);
        }
        throw err;
      }
      report = verifyEndpointResponse(response, { expectedNetwork: network });
    }

    let transaction: ReturnType<typeof txResult> | undefined;
    if (txHash) {
      const option = response ? selectPaymentOption(response, network) : undefined;
      const net: ArcNetworkId | undefined = network ?? option?.network;
      let expected: ExpectedPayment | undefined;
      const notes: Finding[] = [];

      if (!net) {
        notes.push({ id: "tx.expected", severity: "warning", title: "No Arc network to check the transaction on", reason: "The endpoint has no valid Arc payment option and no network was given, so there is nothing to compare the transaction with.", fix: 'Add "network": "mainnet" or "testnet", and the expected recipient and amount in "expect".' });
      } else if (expect) {
        expected = { network: net, asset: (expect.asset ?? USDC_ADDRESS).toLowerCase(), payTo: expect.payTo.toLowerCase(), amount: BigInt(expect.amount) };
      } else if (!option) {
        notes.push({ id: "tx.expected", severity: "warning", title: `The endpoint has no valid payment option on ${ARC_NETWORKS[net].name}`, reason: "There is nothing to compare the transaction with. Fix the endpoint first, or give the expected recipient and amount in \"expect\"." });
      } else if (option.batched) {
        notes.push({ id: "tx.batched", severity: "info", title: "Circle Gateway batched payment: transaction not compared", reason: "Payments in this mode are settled in batches, so a single payment may not appear as its own transfer to the recipient. Comparing this transaction would give a misleading result." });
      } else {
        expected = { network: option.network, asset: option.asset, payTo: option.payTo, amount: option.amount };
      }

      if (expected) {
        try {
          const r = await verifyTransaction(txHash, expected);
          transaction = txResult(r.network, r.txHash, r.findings);
        } catch (err) {
          if (err instanceof RpcError) {
            log.warn("verify rpc failed", { network: expected.network });
            throw apiErrors.upstream("Arc RPC is unavailable right now. Try again shortly.");
          }
          throw err;
        }
      } else {
        transaction = txResult(net, txHash, notes);
      }
    }

    return { url, httpStatus: response?.status, report, transaction };
  }
);
