import { ARC_NETWORKS } from "@/lib/arcConfig";
import { b64ToUtf8 } from "./b64";
import { checkEip3009Signature } from "./signature";
import { verifyEndpointResponse, NETWORK_BY_CHAIN } from "./checks";
import type { Finding, Severity, VerifyReport } from "./types";

// x402 payload inspector. PURE and OFFLINE: it decodes headers that a person
// pastes and compares them with each other. It never makes a network call, never
// stores anything, and never verifies a signature or a settlement.
//
// Why offline matters: a PAYMENT-SIGNATURE is a signed authorization to move
// money. Until it is settled, whoever holds it could submit it. So it must not
// leave the browser. This file has no imports that can reach the network, and a
// test checks that.

const MAX_INPUT_CHARS = 16_384;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const BYTES32 = /^0x[0-9a-fA-F]{64}$/;
const HEX = /^0x[0-9a-fA-F]+$/;
const DECIMAL = /^\d+$/;

export interface InspectInput {
  paymentRequired?: string;
  paymentSignature?: string;
  paymentResponse?: string;
  /** Injected for tests. */
  now?: Date;
}

export type StepState = "ok" | "problem" | "missing" | "unverified";
export interface LifecycleStep {
  id: "requested" | "signed" | "settled" | "delivered";
  label: string;
  state: StepState;
  note: string;
}

export interface AuthorizationView {
  from?: string;
  to?: string;
  value?: string;
  validAfter?: string;
  validBefore?: string;
  nonce?: string;
  signature?: string;
}

export interface InspectResult {
  findings: Finding[];
  /** Same shape as a Verify report, so the same result view can show it. */
  report: VerifyReport;
  lifecycle: LifecycleStep[];
  authorization?: AuthorizationView;
  settlement?: { success?: boolean; transaction?: string; network?: string; payer?: string; errorReason?: string };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const low = (s: string | undefined) => s?.toLowerCase();

// ---------------------------------------------------------------- decoding

/** Accepts the bare value, "NAME: value", base64 or base64url, or plain JSON. */
function decodeEnvelope(raw: string, label: string, out: Finding[]): Obj | undefined {
  let t = raw.trim();
  if (!t) return undefined;
  if (t.length > MAX_INPUT_CHARS) {
    out.push({ id: `${label}.size`, severity: "error", title: `${label} is too large`, reason: `Real payment headers are far smaller than ${MAX_INPUT_CHARS} characters, so this was not decoded.` });
    return undefined;
  }
  t = t.replace(/^[A-Za-z-]+\s*:\s*/, "");
  let json: string | undefined;
  if (t.startsWith("{")) json = t;
  else if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(t)) {
    try {
      json = b64ToUtf8(t);
    } catch {
      json = undefined;
    }
  }
  let parsed: unknown;
  try {
    parsed = json === undefined ? undefined : JSON.parse(json);
  } catch {
    parsed = undefined;
  }
  if (!isObj(parsed)) {
    out.push({
      id: `${label}.decode`,
      severity: "error",
      title: `${label} could not be decoded`,
      reason: "It should be base64-encoded JSON (or the JSON itself). What was pasted is neither.",
      fix: "Paste only the header value, without quotes.",
    });
    return undefined;
  }
  return parsed;
}

const sev = (f: Finding[]): Record<Severity, number> => {
  const c: Record<Severity, number> = { ok: 0, info: 0, warning: 0, error: 0 };
  for (const x of f) c[x.severity]++;
  return c;
};

// Facilitator reason codes seen in the x402 EVM "exact" flow. Unknown codes are
// shown as they are, never guessed at.
// Error codes listed in the x402 v2 specification (specs/x402-specification-v2.md).
// Unknown codes are shown as they are, never guessed at.
const REASONS: Record<string, string> = {
  insufficient_funds: "The payer does not hold enough of the token for this payment.",
  invalid_exact_evm_payload_signature: "The signature does not match the authorization. It was signed for different data, or by a different account.",
  invalid_exact_evm_payload_authorization_valid_before: "The authorization has expired (validBefore is in the past). Request a new quote and sign again.",
  invalid_exact_evm_payload_authorization_valid_after: "The authorization is not valid yet (validAfter is in the future).",
  invalid_exact_evm_payload_authorization_value_mismatch: "The authorized amount does not match the amount the requirements ask for.",
  invalid_exact_evm_payload_recipient_mismatch: "The authorization pays someone other than the payTo address in the requirements.",
  invalid_network: "The payment names a network the service does not accept.",
  invalid_payload: "The payment payload is malformed or missing required fields.",
  invalid_payment_requirements: "The payment requirements the payload answers are malformed or not the ones the service issued.",
  invalid_scheme: "The payment names a scheme that does not match the requirements.",
  unsupported_scheme: "The payment uses a scheme the service does not support.",
  invalid_x402_version: "The x402 version is not one the service accepts (v2 uses x402Version 2).",
  invalid_transaction_state: "The settlement transaction ended in a state that cannot be accepted, for example it reverted.",
  unexpected_verify_error: "The facilitator failed while verifying, for a reason it did not classify. Try again, and ask the facilitator operator if it repeats.",
  unexpected_settle_error: "The facilitator failed while settling, for a reason it did not classify. The payment may or may not have been broadcast: check the chain before paying again.",
  settlement_pending: "Not a failure yet. The settlement transaction was broadcast and may still confirm. Check the transaction hash on the chain.",
  permit2_allowance_required: "The payer must first approve Permit2 for this token before this payment can settle.",
};
export const explainReason = (code: string): string | undefined => REASONS[code];

// ------------------------------------------------------------------ inspect

// Permit2 payments (asset transfer method "permit2"), used for `exact` with tokens
// that lack EIP-3009, and for `upto`. Field names follow the exact-EVM scheme spec.
// The signature is NOT verified: it needs the Permit2 contract's own domain.
function inspectPermit2(p2: Obj, signature: string | undefined, accepted: Obj | undefined, want: Obj | undefined, scheme: string | undefined, nowSec: number, out: Finding[]): void {
  const permitted = isObj(p2.permitted) ? p2.permitted : undefined;
  const witness = isObj(p2.witness) ? p2.witness : undefined;
  const num = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined);
  const from = str(p2.from), token = str(permitted?.token), amount = num(permitted?.amount), spender = str(p2.spender);
  const nonce = num(p2.nonce), deadline = num(p2.deadline), to = str(witness?.to), validAfter = num(witness?.validAfter);

  out.push({ id: "payload.kind", severity: "info", title: scheme === "upto" ? "Permit2 payment (upto)" : "Permit2 payment", reason: "This payment uses a Permit2 authorization instead of an EIP-3009 one. The signature is not verified here, because it needs the Permit2 contract's signing domain." });

  for (const [k, v] of [["from", from], ["spender", spender], ["permitted.token", token], ["witness.to", to]] as const) {
    if (!v || !ADDRESS.test(v)) out.push({ id: `payload.${k}`, severity: "error", title: `${k} is not a valid address`, reason: `permit2Authorization.${k} must be a 0x address of 40 hex digits.`, evidence: `${k}: ${String(v).slice(0, 60)}` });
  }
  if (!amount || !DECIMAL.test(amount)) out.push({ id: "payload.value", severity: "error", title: "permitted.amount is not a whole number", reason: "The amount must be an integer in the token's smallest unit.", evidence: `amount: ${String(amount).slice(0, 40)}` });
  if (!nonce || !DECIMAL.test(nonce)) out.push({ id: "payload.nonce", severity: "error", title: "nonce is not a number", reason: "A Permit2 nonce is an unsigned integer.", evidence: `nonce: ${String(nonce).slice(0, 80)}` });
  if (!signature || !HEX.test(signature)) out.push({ id: "payload.signature", severity: "error", title: "No readable signature", reason: "The payload has no 0x hex signature, so it cannot be submitted." });

  if (deadline && DECIMAL.test(deadline)) {
    if (Number(deadline) <= nowSec) out.push({ id: "payload.validBefore", severity: "error", title: "The authorization has expired", reason: "deadline is in the past, so a facilitator will reject it.", evidence: `deadline: ${deadline} (${new Date(Number(deadline) * 1000).toISOString()})`, fix: "Request a new quote and sign again." });
    else out.push({ id: "payload.validBefore", severity: "ok", title: "Not expired", reason: "deadline is still in the future.", evidence: `deadline: ${new Date(Number(deadline) * 1000).toISOString()}` });
  } else out.push({ id: "payload.validBefore", severity: "error", title: "deadline is missing or invalid", reason: "A Permit2 authorization needs a numeric deadline." });
  if (validAfter && DECIMAL.test(validAfter) && Number(validAfter) > nowSec) out.push({ id: "payload.validAfter", severity: "warning", title: "Not valid yet", reason: "witness.validAfter is in the future.", evidence: `validAfter: ${validAfter}` });

  const net = str(accepted?.network);
  const m = net ? /^eip155:(\d+)$/.exec(net) : null;
  if (accepted) {
    if (!m) out.push({ id: "payload.network", severity: "warning", title: "Accepted network is not an eip155 id", reason: "The payload names no Arc network, so it cannot be tied to Arc.", evidence: `accepted.network: ${JSON.stringify(net)}` });
    else if (!NETWORK_BY_CHAIN.has(Number(m[1]))) out.push({ id: "payload.network", severity: "info", title: "Not an Arc network", reason: "MicroAI inspects Arc only.", evidence: `accepted.network: ${net}` });
    else out.push({ id: "payload.network", severity: "ok", title: `Payment is for ${ARC_NETWORKS[NETWORK_BY_CHAIN.get(Number(m[1]))!].name}`, reason: "The accepted network is an Arc network.", evidence: `accepted.network: ${net}` });
  }

  if (!want) {
    out.push({ id: "match.missing", severity: "info", title: "Add the PAYMENT-REQUIRED header to compare", reason: "Without the service's requirements, the payload is only checked on its own." });
    return;
  }
  const payTo = str(want.payTo), asset = str(want.asset), wantAmount = num(want.amount);
  if (payTo && to) {
    if (low(payTo) === low(to)) out.push({ id: "match.payTo", severity: "ok", title: "Pays the requested recipient", reason: "witness.to equals payTo.", evidence: `to: ${to}` });
    else out.push({ id: "match.payTo", severity: "error", title: "Pays a different recipient", reason: "witness.to is not the payTo address in the requirements. The service would not accept it.", evidence: `payTo: ${payTo}\nto: ${to}`, fix: "Sign again for the payTo address in the requirements." });
  }
  if (asset && token) {
    if (low(asset) === low(token)) out.push({ id: "match.asset", severity: "ok", title: "Authorizes the requested token", reason: "permitted.token equals asset.", evidence: `token: ${token}` });
    else out.push({ id: "match.asset", severity: "error", title: "Authorizes a different token", reason: "permitted.token is not the asset in the requirements.", evidence: `asset: ${asset}\ntoken: ${token}` });
  }
  if (wantAmount && amount && DECIMAL.test(wantAmount) && DECIMAL.test(amount)) {
    const a2 = BigInt(amount), w = BigInt(wantAmount);
    if (scheme === "upto") {
      // For upto the buyer authorizes a maximum and the seller charges actual usage. How the
      // requirements amount relates to that maximum is defined by the scheme spec, which
      // MicroAI does not check, so this is a note and not a verdict.
      out.push({ id: "match.amount", severity: a2 < w ? "warning" : "info", title: a2 < w ? "Authorizes less than the requirements amount" : "upto: the authorized amount is a maximum", reason: a2 < w ? "The authorized maximum is below the amount in the requirements." : "With the upto scheme the seller charges actual usage up to this maximum, so it is not compared for equality.", evidence: `requirements: ${wantAmount}\nauthorized maximum: ${amount}` });
    } else if (a2 === w) out.push({ id: "match.amount", severity: "ok", title: "Authorizes the requested amount", reason: "permitted.amount equals the amount in the requirements.", evidence: `amount: ${amount}` });
    else out.push({ id: "match.amount", severity: a2 < w ? "error" : "warning", title: a2 < w ? "Authorizes less than asked" : "Authorizes more than asked", reason: a2 < w ? "The service would reject it as underpaid." : "The payer would authorize more than the service asked for.", evidence: `asked: ${wantAmount}\nauthorized: ${amount}`, fix: "Sign for exactly the amount in the requirements." });
  }
  if (accepted && str(accepted.network) && str(want.network) && accepted.network !== want.network) out.push({ id: "match.network", severity: "error", title: "Different network than requested", reason: "The payer accepted another network than the one in the requirements.", evidence: `asked: ${str(want.network)}\npaid for: ${str(accepted.network)}` });
}


export function inspectPayload(input: InspectInput): InspectResult {
  const now = input.now ?? new Date();
  const findings: Finding[] = [];
  const checked: string[] = [];
  const notChecked: string[] = [
    "The signature itself (it is not verified here, so a payload can look right and still be invalid)",
    "Whether the payer has the funds, or whether the authorization was already used",
    "Whether anything was settled on-chain. Check the transaction in Verify.",
    "Whether the service delivered anything",
  ];

  // 1. Requirements (what the service asked for)
  let accepts: Obj[] = [];
  let requirementsOk = false;
  if (input.paymentRequired?.trim()) {
    checked.push("PAYMENT-REQUIRED: format, network, asset, amount, payTo (the same checks as Verify)");
    const decoded = decodeEnvelope(input.paymentRequired, "PAYMENT-REQUIRED", findings);
    if (decoded) {
      const rep = verifyEndpointResponse({ status: 402, headers: { "payment-required": input.paymentRequired.trim().replace(/^[A-Za-z-]+\s*:\s*/, "") }, body: "" });
      findings.push(...rep.findings);
      if (Array.isArray(decoded.accepts)) accepts = decoded.accepts.filter(isObj);
      // The v2 spec makes `resource` (with a url) a required part of PaymentRequired.
      if (decoded.x402Version === 2 && !(isObj(decoded.resource) && typeof decoded.resource.url === "string" && decoded.resource.url)) {
        findings.push({ id: "requirements.resource", severity: "warning", title: "resource.url is missing", reason: "In x402 v2, PaymentRequired must describe the protected resource with a resource object that has a url. Some clients may reject this response.", fix: 'Add "resource": { "url": "<the paid URL>" } to the PaymentRequired object.' });
      }
      requirementsOk = accepts.length > 0 && !rep.findings.some((f) => f.severity === "error");
    }
  }

  // 2. Signed payload (what the payer authorized)
  let auth: AuthorizationView | undefined;
  let payloadSeen = false;
  let payloadProblem = false;
  let signatureChecked = false;
  let signatureMatches = false;
  const before = findings.length;
  if (input.paymentSignature?.trim()) {
    payloadSeen = true;
    checked.push("PAYMENT-SIGNATURE: version, network, authorization fields, expiry, signature (EIP-3009), match with the requirements");
    const p = decodeEnvelope(input.paymentSignature, "PAYMENT-SIGNATURE", findings);
    if (p) {
      if (p.x402Version !== 2) {
        findings.push({ id: "payload.version", severity: "warning", title: p.x402Version === 1 ? "Payment uses legacy x402 v1" : "x402Version is not 2", reason: "MicroAI inspects the v2 format. Fields below may not apply.", evidence: `x402Version: ${JSON.stringify(p.x402Version)}` });
      }
      const inner = isObj(p.payload) ? p.payload : p;
      const a = isObj(inner.authorization) ? inner.authorization : undefined;
      const accepted = isObj(p.accepted) ? p.accepted : undefined;
      const want = accepts.length ? (accepted ? accepts.find((o) => o.network === accepted.network && low(str(o.asset)) === low(str(accepted.asset))) ?? accepts[0] : accepts[0]) : undefined;
      if (!accepted) {
        findings.push({ id: "payload.accepted", severity: "warning", title: "accepted is missing", reason: "In x402 v2 the payload must carry accepted, the payment requirements the payer chose. Without it a facilitator cannot tell which option was paid.", fix: "Include the chosen requirements object as accepted." });
      }
      const scheme = str(accepted?.scheme) ?? str(want?.scheme);
      const nowSec = Math.floor(now.getTime() / 1000);
      const p2 = isObj(inner.permit2Authorization) ? inner.permit2Authorization : undefined;
      if (!a && p2) {
        inspectPermit2(p2, str(inner.signature), accepted, want, scheme, nowSec, findings);
      } else if (!a) {
        findings.push(
          isObj(inner.delegation) || str(isObj(accepted?.extra) ? (accepted!.extra as Obj).assetTransferMethod : undefined) === "erc7710"
            ? { id: "payload.kind", severity: "info", title: "ERC-7710 delegation payment", reason: "The spec verifies these only by simulating redeemDelegations on-chain, which MicroAI does not do. Its fields were not checked." }
            : { id: "payload.authorization", severity: "error", title: "No authorization found", reason: "An exact EVM payment carries an authorization (from, to, value, validAfter, validBefore, nonce) and a signature, or a permit2Authorization. None was found." }
        );
      } else {
        auth = {
          from: str(a.from), to: str(a.to), value: str(a.value) ?? (typeof a.value === "number" ? String(a.value) : undefined),
          validAfter: str(a.validAfter) ?? (typeof a.validAfter === "number" ? String(a.validAfter) : undefined),
          validBefore: str(a.validBefore) ?? (typeof a.validBefore === "number" ? String(a.validBefore) : undefined),
          nonce: str(a.nonce), signature: str(inner.signature),
        };
        for (const k of ["from", "to"] as const) {
          if (!auth[k] || !ADDRESS.test(auth[k]!)) findings.push({ id: `payload.${k}`, severity: "error", title: `${k} is not a valid address`, reason: `authorization.${k} must be a 0x address of 40 hex digits.`, evidence: `${k}: ${String(a[k]).slice(0, 60)}` });
        }
        if (!auth.value || !DECIMAL.test(auth.value)) findings.push({ id: "payload.value", severity: "error", title: "value is not a whole number", reason: "authorization.value must be an integer in the token's smallest unit.", evidence: `value: ${String(a.value).slice(0, 40)}` });
        if (!auth.nonce || !BYTES32.test(auth.nonce)) findings.push({ id: "payload.nonce", severity: "error", title: "nonce is not 32 bytes", reason: "An EIP-3009 nonce is a random 32-byte value (0x plus 64 hex digits). It is what stops the same authorization being used twice.", evidence: `nonce: ${String(a.nonce).slice(0, 80)}` });
        if (!auth.signature || !HEX.test(auth.signature)) findings.push({ id: "payload.signature", severity: "error", title: "No readable signature", reason: "The payload has no 0x hex signature, so it cannot be submitted.", });
        else if (auth.signature.length !== 132) findings.push({ id: "payload.signature", severity: "info", title: "Signature is not 65 bytes", reason: "A normal account signature is 65 bytes. Smart-wallet signatures can be longer, so this is only a note." });

        // time window
        if (auth.validBefore && DECIMAL.test(auth.validBefore)) {
          if (Number(auth.validBefore) <= nowSec) findings.push({ id: "payload.validBefore", severity: "error", title: "The authorization has expired", reason: "validBefore is in the past, so a facilitator will reject it.", evidence: `validBefore: ${auth.validBefore} (${new Date(Number(auth.validBefore) * 1000).toISOString()})`, fix: "Request a new quote and sign again." });
          else findings.push({ id: "payload.validBefore", severity: "ok", title: "Not expired", reason: "validBefore is still in the future.", evidence: `validBefore: ${new Date(Number(auth.validBefore) * 1000).toISOString()}` });
        }
        if (auth.validAfter && DECIMAL.test(auth.validAfter) && Number(auth.validAfter) > nowSec) findings.push({ id: "payload.validAfter", severity: "warning", title: "Not valid yet", reason: "validAfter is in the future.", evidence: `validAfter: ${auth.validAfter}` });

        // Signature: recover the signer offline and compare it with `from`.
        const extra = isObj(accepted?.extra) ? (accepted!.extra as Obj) : isObj(want?.extra) ? (want!.extra as Obj) : undefined;
        const chain = /^eip155:(\d+)$/.exec(str(accepted?.network) ?? str(want?.network) ?? "");
        const asset = str(accepted?.asset) ?? str(want?.asset);
        const fieldsOk = auth.from && ADDRESS.test(auth.from) && auth.to && ADDRESS.test(auth.to) && auth.value && DECIMAL.test(auth.value) && auth.validAfter && DECIMAL.test(auth.validAfter) && auth.validBefore && DECIMAL.test(auth.validBefore) && auth.nonce && BYTES32.test(auth.nonce) && auth.signature && HEX.test(auth.signature);
        if (fieldsOk && chain && asset && ADDRESS.test(asset)) {
          signatureChecked = true;
          const r = checkEip3009Signature({
            authorization: { from: auth.from!, to: auth.to!, value: auth.value!, validAfter: auth.validAfter!, validBefore: auth.validBefore!, nonce: auth.nonce! },
            signature: auth.signature!, chainId: Number(chain[1]), verifyingContract: asset, name: str(extra?.name), version: str(extra?.version),
          });
          if (r.status === "match") {
            signatureMatches = true;
            findings.push({ id: "payload.signature.check", severity: "ok", title: "The signature matches the payer", reason: "Recovering the signer from the signed data gives authorization.from. This uses the token name and version the service declared in extra.", evidence: `signer: ${r.recovered}` });
          } else if (r.status === "mismatch") {
            findings.push({ id: "payload.signature.check", severity: "error", title: "The signature does not match the payer", reason: "The signature does not recover to authorization.from for the declared token name, version, network and asset. A facilitator will reject it. Either the data was changed after signing, it was signed for another token or network, or extra.name/version differ from the token's real values.", evidence: r.recovered ? `from: ${auth.from}\nrecovered signer: ${r.recovered}` : undefined, fix: "Sign again with the exact requirements, and check extra.name and extra.version against the token." });
          } else if (r.status === "no_domain") {
            findings.push({ id: "payload.signature.check", severity: "info", title: "Signature not checked", reason: "The requirements carry no extra.name and extra.version, which the signing domain needs, so the signature could not be recovered." });
          } else {
            findings.push({ id: "payload.signature.check", severity: "info", title: "Signature not checked", reason: r.reason });
          }
        }

        // network of what the payer accepted
        const net = str(accepted?.network);
        if (accepted) {
          const m = net ? /^eip155:(\d+)$/.exec(net) : null;
          if (!m) findings.push({ id: "payload.network", severity: "warning", title: "Accepted network is not an eip155 id", reason: "The payload names no Arc network, so it cannot be tied to Arc.", evidence: `accepted.network: ${JSON.stringify(net)}` });
          else if (!NETWORK_BY_CHAIN.has(Number(m[1]))) findings.push({ id: "payload.network", severity: "info", title: "Not an Arc network", reason: "MicroAI inspects Arc only.", evidence: `accepted.network: ${net}` });
          else findings.push({ id: "payload.network", severity: "ok", title: `Payment is for ${ARC_NETWORKS[NETWORK_BY_CHAIN.get(Number(m[1]))!].name}`, reason: "The accepted network is an Arc network.", evidence: `accepted.network: ${net}` });
        }

        // compare with the requirements the service asked for
        if (want) {
          if (accepts.length > 1 && !accepted) findings.push({ id: "match.option", severity: "info", title: "Several payment options", reason: "The payload does not say which option it answers, so it was compared with the first." });
          const payTo = str(want.payTo);
          const amount = str(want.amount) ?? (typeof want.amount === "number" ? String(want.amount) : undefined);
          if (payTo && auth.to) {
            if (low(payTo) === low(auth.to)) findings.push({ id: "match.payTo", severity: "ok", title: "Pays the requested recipient", reason: "authorization.to equals payTo.", evidence: `to: ${auth.to}` });
            else findings.push({ id: "match.payTo", severity: "error", title: "Pays a different recipient", reason: "authorization.to is not the payTo address in the requirements. The service would not accept it.", evidence: `payTo: ${payTo}\nto: ${auth.to}`, fix: "Sign again for the payTo address in the requirements." });
          }
          if (amount && auth.value && DECIMAL.test(amount) && DECIMAL.test(auth.value)) {
            const a2 = BigInt(auth.value), w = BigInt(amount);
            if (a2 === w) findings.push({ id: "match.amount", severity: "ok", title: "Authorizes the requested amount", reason: "value equals the amount in the requirements.", evidence: `value: ${auth.value}` });
            else findings.push({ id: "match.amount", severity: a2 < w ? "error" : "warning", title: a2 < w ? "Authorizes less than asked" : "Authorizes more than asked", reason: a2 < w ? "The service would reject it as underpaid." : "The payer would spend more than the service asked for.", evidence: `asked: ${amount}\nauthorized: ${auth.value}`, fix: "Sign for exactly the amount in the requirements." });
          }
          if (accepted && str(accepted.network) && str(want.network) && accepted.network !== want.network) findings.push({ id: "match.network", severity: "error", title: "Different network than requested", reason: "The payer accepted another network than the one in the requirements.", evidence: `asked: ${str(want.network)}\npaid for: ${str(accepted.network)}` });
        } else if (input.paymentRequired?.trim()) {
          findings.push({ id: "match.none", severity: "info", title: "Nothing to compare with", reason: "The requirements could not be read, so the payload was not matched against them." });
        } else {
          findings.push({ id: "match.missing", severity: "info", title: "Add the PAYMENT-REQUIRED header to compare", reason: "Without the service's requirements, the payload is only checked on its own." });
        }
      }
    }
  }
  payloadProblem = findings.slice(before).some((f) => f.severity === "error");
  if (signatureMatches) {
    notChecked[0] = "Whether the token contract itself accepts this signature (the check used the token name and version the service declared)";
  }

  // 3. Settlement response (what the service reported)
  let settlement: InspectResult["settlement"];
  if (input.paymentResponse?.trim()) {
    checked.push("PAYMENT-RESPONSE: what the service reported about settlement");
    const r = decodeEnvelope(input.paymentResponse, "PAYMENT-RESPONSE", findings);
    if (r) {
      settlement = { success: typeof r.success === "boolean" ? r.success : undefined, transaction: str(r.transaction), network: str(r.network), payer: str(r.payer), errorReason: str(r.errorReason) ?? str(r.error) };
      if (settlement.success === false && settlement.errorReason === "settlement_pending") {
        findings.push({ id: "response.pending", severity: "warning", title: "Settlement is still pending", reason: REASONS.settlement_pending, evidence: settlement.transaction ? `transaction: ${settlement.transaction}` : undefined, fix: settlement.transaction ? "Check this transaction in Verify in a minute." : undefined });
      } else if (settlement.success === false) {
        const why = settlement.errorReason ? REASONS[settlement.errorReason] ?? `Reason code: ${settlement.errorReason}` : "No reason was given.";
        findings.push({ id: "response.success", severity: "error", title: "The service reports settlement failed", reason: why, evidence: settlement.errorReason ? `errorReason: ${settlement.errorReason}` : undefined });
      } else if (settlement.success === true) {
        findings.push({ id: "response.success", severity: "info", title: "The service reports settlement succeeded", reason: "This is what the service says. MicroAI has not checked it on-chain.", evidence: settlement.transaction ? `transaction: ${settlement.transaction}` : undefined, fix: settlement.transaction ? "Check this transaction in Verify to confirm it on-chain." : undefined });
      }
      if (settlement.success === true && !settlement.transaction) {
        findings.push({ id: "response.transaction", severity: "warning", title: "Success without a transaction hash", reason: "The spec says transaction is empty only when nothing was broadcast. A success with no hash gives you nothing to check on-chain." });
      }
      if (settlement.transaction && !BYTES32.test(settlement.transaction)) findings.push({ id: "response.transaction", severity: "warning", title: "transaction is not a transaction hash", reason: "A hash is 0x plus 64 hex digits.", evidence: `transaction: ${settlement.transaction.slice(0, 80)}` });
    }
  }

  // Reason code pasted on its own is handled by explainReason in the UI.
  const hasProblem = (prefixes: string[]) => findings.some((f) => f.severity === "error" && prefixes.some((p) => f.id.startsWith(p)));

  const lifecycle: LifecycleStep[] = [
    input.paymentRequired?.trim()
      ? { id: "requested", label: "Payment requested", state: requirementsOk ? "ok" : "problem", note: requirementsOk ? "The service asked for payment and the requirements read correctly." : "The requirements have problems, see below." }
      : { id: "requested", label: "Payment requested", state: "missing", note: "Paste PAYMENT-REQUIRED to check this step." },
    payloadSeen
      ? (() => {
          const bad = payloadProblem || hasProblem(["match.", "payload."]);
          if (bad) return { id: "signed" as const, label: "Payment signed", state: "problem" as StepState, note: "The payload has problems, see below." };
          if (signatureMatches) return { id: "signed" as const, label: "Payment signed", state: "ok" as StepState, note: "The fields match the requirements and the signature recovers to the payer. Balance and replay protection are not checked." };
          return { id: "signed" as const, label: "Payment signed", state: "unverified" as StepState, note: signatureChecked ? "The fields look right, but the signature could not be confirmed." : "The fields look right. The signature itself was not verified." };
        })()
      : { id: "signed", label: "Payment signed", state: "missing", note: "Paste PAYMENT-SIGNATURE to check this step." },
    settlement
      ? { id: "settled", label: "Payment settled", state: settlement.success === false && settlement.errorReason !== "settlement_pending" ? "problem" : "unverified", note: settlement.errorReason === "settlement_pending" ? "The service says settlement is still pending. Check the transaction in Verify." : settlement.success === false ? "The service reports a failure." : "Reported by the service. Confirm the transaction in Verify." }
      : { id: "settled", label: "Payment settled", state: "missing", note: "Paste PAYMENT-RESPONSE, or check the transaction in Verify." },
    { id: "delivered", label: "Service delivered", state: "unverified", note: "Not checked here. Use the delivery check in Verify, with the HTTP status you got." },
  ];

  if (!findings.some((f) => f.severity === "error" || f.severity === "warning") && findings.length === 0) {
    findings.push({ id: "empty", severity: "info", title: "Nothing to inspect yet", reason: "Paste at least one of the three headers." });
  }

  const report: VerifyReport = { findings, counts: sev(findings), checked, notChecked };
  return { findings, report, lifecycle, authorization: auth, settlement };
}
