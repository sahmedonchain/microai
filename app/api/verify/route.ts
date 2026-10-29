import { apiErrors, parseJson, withApi } from "@/lib/api";
import { SafeFetchError } from "@/lib/safeFetch";
import { describeFetchError, fetchChallenge } from "@/lib/verify/fetchEndpoint";
import { verifyEndpointResponse } from "@/lib/verify/checks";
import { verifyBody } from "@/lib/schemas";

// MicroAI Verify: reads an x402 endpoint's 402 answer and checks it against
// what is known about Arc. It sends no payment and no body, only a GET without
// payment, through the guarded outbound client.

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "invalid";
  }
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
    const { url, network } = await parseJson(req, verifyBody);

    let response;
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

    const report = verifyEndpointResponse(response, { expectedNetwork: network });
    return { url, httpStatus: response.status, report };
  }
);
