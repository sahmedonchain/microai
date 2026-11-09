import { AbiCoder, Interface, id } from "ethers";

// Deterministic transaction diagnosis. Pure: it reads data that was already
// fetched (the Explorer's transaction, the receipt's logs) and decodes it.
//
// Every finding says how sure it is:
//   confirmed  the chain data itself states it (a decoded revert, a panic code, an event)
//   probable   it fits the evidence but the chain data does not say so
//   unknown    the data does not explain it
// Nothing here guesses beyond that, and nothing here calls an AI.

export type Confidence = "confirmed" | "probable" | "unknown";

export interface Diagnosis {
  id: string;
  confidence: Confidence;
  title: string;
  detail: string;
  /** The exact values the finding rests on. */
  evidence: string[];
  fix: string[];
}

export interface DecodedEvent {
  name: string;
  address: string;
  args: Record<string, string>;
}

export type RevertInfo =
  | { kind: "none" }
  | { kind: "message"; message: string }
  | { kind: "panic"; code: string; meaning: string }
  | { kind: "custom"; selector: string; name?: string; args?: Record<string, string> }
  | { kind: "empty" };

// ---------------------------------------------------------------- selectors

const sel = (signature: string) => id(signature).slice(0, 10);

// Selectors are computed from signatures, never typed by hand.
const FUNCTION_SIGNATURES = [
  "transfer(address,uint256)",
  "transferFrom(address,address,uint256)",
  "approve(address,uint256)",
  "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)",
  "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)",
  "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)",
  "receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)",
  "receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)",
  "cancelAuthorization(address,bytes32,uint8,bytes32,bytes32)",
  "mint(address,uint256)",
  "burn(uint256)",
  "deposit()",
  "withdraw(uint256)",
];
const FUNCTIONS = new Map(FUNCTION_SIGNATURES.map((s) => [sel(s), s]));

export const X402_SETTLE_FUNCTIONS = new Set(FUNCTION_SIGNATURES.filter((s) => /WithAuthorization\(/.test(s)).map(sel));

export function decodeFunction(rawInput?: string): string {
  if (!rawInput || !/^0x[0-9a-fA-F]{8}/.test(rawInput)) return "unknown";
  return FUNCTIONS.get(rawInput.slice(0, 10).toLowerCase()) ?? "unknown";
}

export const isX402Settlement = (rawInput?: string) =>
  !!rawInput && /^0x[0-9a-fA-F]{8}/.test(rawInput) && X402_SETTLE_FUNCTIONS.has(rawInput.slice(0, 10).toLowerCase());

// ------------------------------------------------------------------ reverts

const PANIC: Record<string, string> = {
  "0x01": "assert failed",
  "0x11": "arithmetic overflow or underflow",
  "0x12": "division or modulo by zero",
  "0x21": "invalid enum value",
  "0x22": "incorrectly encoded storage byte array",
  "0x31": "pop on an empty array",
  "0x32": "array index out of bounds",
  "0x41": "out of memory",
  "0x51": "call to an uninitialized function pointer",
};

const CUSTOM_ERRORS = [
  "ERC20InsufficientBalance(address,uint256,uint256)",
  "ERC20InsufficientAllowance(address,uint256,uint256)",
  "ERC20InvalidSender(address)",
  "ERC20InvalidReceiver(address)",
  "ERC20InvalidApprover(address)",
  "ERC20InvalidSpender(address)",
  "OwnableUnauthorizedAccount(address)",
  "SafeERC20FailedOperation(address)",
  "ECDSAInvalidSignature()",
  "ERC2612ExpiredSignature(uint256)",
  "ERC2612InvalidSigner(address,address)",
  "EnforcedPause()",
  "AccessControlUnauthorizedAccount(address,bytes32)",
];
const ERROR_IFACE = new Interface(CUSTOM_ERRORS.map((e) => `error ${e}`));
const ERROR_SELECTORS = new Map(CUSTOM_ERRORS.map((e) => [sel(e), e.slice(0, e.indexOf("("))]));

const ERROR_STRING = sel("Error(string)");
const PANIC_SELECTOR = sel("Panic(uint256)");

/** Decodes raw revert data (0x...). */
export function decodeRevertData(data: string): RevertInfo {
  const d = data.trim().toLowerCase();
  if (d === "" || d === "0x") return { kind: "empty" };
  if (!/^0x([0-9a-f]{2})+$/.test(d) || d.length < 10) return { kind: "none" };
  const selector = d.slice(0, 10);
  try {
    if (selector === ERROR_STRING) {
      const [message] = AbiCoder.defaultAbiCoder().decode(["string"], "0x" + d.slice(10));
      return { kind: "message", message: String(message).slice(0, 300) };
    }
    if (selector === PANIC_SELECTOR) {
      const [code] = AbiCoder.defaultAbiCoder().decode(["uint256"], "0x" + d.slice(10));
      const hex = "0x" + (code as bigint).toString(16).padStart(2, "0");
      return { kind: "panic", code: hex, meaning: PANIC[hex] ?? "unknown panic code" };
    }
  } catch {
    return { kind: "custom", selector };
  }
  const name = ERROR_SELECTORS.get(selector);
  if (!name) return { kind: "custom", selector };
  try {
    const parsed = ERROR_IFACE.parseError(d);
    const args: Record<string, string> = {};
    parsed?.fragment.inputs.forEach((inp, i) => {
      args[inp.name || `arg${i}`] = String(parsed.args[i]);
    });
    return { kind: "custom", selector, name, args };
  } catch {
    return { kind: "custom", selector, name };
  }
}

/**
 * The Explorer's `revert_reason` can be raw hex data, an already decoded
 * message, or an object holding either. Anything else is reported as no reason.
 */
export function normalizeRevert(raw: unknown): RevertInfo {
  let v: unknown = raw;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    v = typeof o.raw === "string" ? o.raw : typeof o.message === "string" ? o.message : typeof o.decoded === "string" ? o.decoded : undefined;
  }
  if (typeof v !== "string") return { kind: "none" };
  const t = v.trim();
  if (!t) return { kind: "none" };
  if (/^0x([0-9a-fA-F]{2})*$/.test(t)) return decodeRevertData(t);
  return { kind: "message", message: t.slice(0, 300) };
}

// ------------------------------------------------------------------- events

const EVENT_IFACE = new Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)",
  "event AuthorizationCanceled(address indexed authorizer, bytes32 indexed nonce)",
]);

export interface RawLog {
  address?: string;
  topics?: string[];
  data?: string;
}

const MAX_LOGS = 50;

/** Decodes the logs it knows (ERC-20 and EIP-3009 events). Others are counted, not guessed at. */
export function decodeLogs(logs: RawLog[]): { events: DecodedEvent[]; unknown: number } {
  const events: DecodedEvent[] = [];
  let unknown = 0;
  for (const log of logs.slice(0, MAX_LOGS)) {
    try {
      const parsed = EVENT_IFACE.parseLog({ topics: log.topics ?? [], data: log.data ?? "0x" });
      if (!parsed) {
        unknown++;
        continue;
      }
      const args: Record<string, string> = {};
      parsed.fragment.inputs.forEach((inp, i) => {
        args[inp.name] = String(parsed.args[i]);
      });
      events.push({ name: parsed.name, address: String(log.address ?? ""), args });
    } catch {
      unknown++;
    }
  }
  return { events, unknown };
}

// ---------------------------------------------------------------- diagnosis

export interface DiagnoseInput {
  result?: string;
  status?: string;
  error?: string;
  revert: RevertInfo;
  rawInput?: string;
  gasUsed?: string;
  gasLimit?: string;
  events: DecodedEvent[];
}

// Revert strings of the FiatToken (Circle USDC) EIP-3009 implementation. Matched by
// keyword, and reported as "confirmed" only because the contract says it itself.
const AUTH_REASONS: Array<{ test: RegExp; id: string; title: string; detail: string; fix: string[] }> = [
  { test: /not yet valid/i, id: "auth.not_yet_valid", title: "The authorization is not valid yet", detail: "validAfter is still in the future when the transaction ran.", fix: ["Wait until validAfter, or sign a new authorization with validAfter set to 0 or the past."] },
  { test: /expired/i, id: "auth.expired", title: "The authorization had expired", detail: "validBefore had passed when the transaction ran.", fix: ["Request a new quote and sign again.", "Settle sooner after signing, or allow a longer maxTimeoutSeconds."] },
  { test: /used or canceled|already used/i, id: "auth.used", title: "The authorization was already used or canceled", detail: "Each authorization nonce works once. Another transaction has spent or canceled this one.", fix: ["Sign a new authorization with a fresh random nonce.", "Look for an earlier transaction with the same nonce (AuthorizationUsed event)."] },
  { test: /invalid signature|ecrecover/i, id: "auth.bad_signature", title: "The signature was rejected", detail: "The contract could not match the signature to the authorization's from address.", fix: ["Check extra.name and extra.version against the token's real EIP-712 domain, and the chain ID.", "Sign again, and confirm the signed data is exactly what was submitted."] },
  { test: /caller must be the payee/i, id: "auth.payee", title: "Only the recipient may submit this authorization", detail: "receiveWithAuthorization can only be sent by the address it pays.", fix: ["Submit the transaction from the recipient address, or use transferWithAuthorization."] },
];

function parseUint(v?: string): bigint | undefined {
  return v && /^\d+$/.test(v) ? BigInt(v) : undefined;
}

export function diagnose(input: DiagnoseInput): Diagnosis[] {
  const out: Diagnosis[] = [];
  const failed = (input.result ?? "").toLowerCase() !== "success" && (input.status ?? "").toLowerCase() !== "ok";
  const settlement = isX402Settlement(input.rawInput);
  const r = input.revert;

  if (!failed) {
    const used = input.events.find((e) => e.name === "AuthorizationUsed");
    if (used) {
      out.push({
        id: "x402.settled", confidence: "confirmed", title: "An EIP-3009 authorization was consumed",
        detail: "The token emitted AuthorizationUsed, so a signed payment authorization was executed on-chain. This confirms the payment moved. It does not confirm that a service delivered anything.",
        evidence: [`authorizer: ${used.args.authorizer}`, `nonce: ${used.args.nonce}`], fix: [],
      });
    }
    return out;
  }

  // 1. The contract told us why.
  if (r.kind === "message") {
    const known = settlement ? AUTH_REASONS.find((a) => a.test.test(r.message)) : undefined;
    if (known) {
      out.push({ id: known.id, confidence: "confirmed", title: known.title, detail: `${known.detail} The contract's own message says so.`, evidence: [`revert reason: ${r.message}`], fix: known.fix });
    } else if (/insufficient|exceeds balance|transfer amount exceeds/i.test(r.message)) {
      out.push({ id: "revert.balance", confidence: "confirmed", title: "The contract reports an insufficient balance or allowance", detail: "The revert message says funds or allowance were not enough.", evidence: [`revert reason: ${r.message}`], fix: ["Check the payer's balance of the token.", "If it is a transferFrom, check the allowance given to the spender."] });
    } else {
      out.push({ id: "revert.message", confidence: "confirmed", title: "The contract reverted with a message", detail: "This is the contract's own explanation. What it means depends on that contract's code.", evidence: [`revert reason: ${r.message}`], fix: ["Read the contract source or docs for this message."] });
    }
  } else if (r.kind === "panic") {
    out.push({ id: "revert.panic", confidence: "confirmed", title: `Solidity panic: ${r.meaning}`, detail: "The contract hit a runtime check, which usually points at a bug or an input the contract did not expect.", evidence: [`panic code: ${r.code}`], fix: ["Check the inputs that reach the failing line.", "If the contract is not yours, report the failing input to its authors."] });
  } else if (r.kind === "custom") {
    const argText = r.args ? Object.entries(r.args).map(([k, v]) => `${k}: ${v}`) : [];
    if (r.name === "ERC20InsufficientBalance") {
      out.push({ id: "revert.erc20_balance", confidence: "confirmed", title: "Insufficient token balance", detail: "The token reverted with ERC20InsufficientBalance: the sender holds less than the amount.", evidence: argText, fix: ["Fund the sender with the token, or lower the amount."] });
    } else if (r.name === "ERC20InsufficientAllowance") {
      out.push({ id: "revert.erc20_allowance", confidence: "confirmed", title: "Insufficient allowance", detail: "The token reverted with ERC20InsufficientAllowance: the spender may not move this much.", evidence: argText, fix: ["Call approve(spender, amount) first, then retry."] });
    } else if (r.name) {
      out.push({ id: "revert.custom", confidence: "confirmed", title: `The contract reverted with ${r.name}`, detail: "This is a standard custom error. The arguments below come from the revert data.", evidence: [`selector: ${r.selector}`, ...argText], fix: [] });
    } else {
      out.push({ id: "revert.custom_unknown", confidence: "unknown", title: "The contract reverted with a custom error MicroAI cannot name", detail: "Only the 4-byte selector is known. Its name needs the contract's ABI.", evidence: [`selector: ${r.selector}`], fix: ["Look the selector up in the contract's verified ABI on the explorer."] });
    }
  }

  // 2. Gas: the chain does not say "out of gas" unless the Explorer reports it.
  const used = parseUint(input.gasUsed);
  const limit = parseUint(input.gasLimit);
  const explorerSaysGas = /out of gas/i.test(`${input.result ?? ""} ${input.error ?? ""}`);
  if (explorerSaysGas) {
    out.push({ id: "gas.out", confidence: "confirmed", title: "The transaction ran out of gas", detail: "The Explorer reports an out-of-gas failure.", evidence: [`result: ${input.result ?? ""}`, `error: ${input.error ?? ""}`], fix: ["Raise the gas limit and retry. Gas on Arc is paid in USDC."] });
  } else if (used !== undefined && limit !== undefined && limit > BigInt(0) && used * BigInt(100) >= limit * BigInt(99) && (r.kind === "none" || r.kind === "empty")) {
    out.push({ id: "gas.probable", confidence: "probable", title: "Probably ran out of gas", detail: "The transaction used almost all of its gas limit and returned no revert reason. That fits an out-of-gas failure, but the data does not state it.", evidence: [`gas used: ${used}`, `gas limit: ${limit}`], fix: ["Estimate gas with eth_estimateGas and set the limit with some margin.", "Re-simulate with eth_call to see the real error."] });
  }

  // 3. Failed with nothing to explain it.
  if (out.length === 0) {
    out.push({
      id: "revert.no_reason", confidence: "unknown", title: "The transaction failed and the chain gives no reason",
      detail: r.kind === "empty" ? "The contract reverted with empty data (a bare revert, or a failed check without a message)." : "No revert data is available from the Explorer.",
      evidence: [`result: ${input.result ?? "unknown"}`], fix: ["Re-simulate the call with eth_call at the transaction's block to get the revert data.", "Check the contract source for require statements on these inputs."],
    });
  }

  // 4. x402 context, only when it is an authorization settlement.
  if (settlement && !out.some((d) => d.id.startsWith("auth."))) {
    out.push({ id: "x402.context", confidence: "unknown", title: "This was an x402 settlement call", detail: "The transaction called transferWithAuthorization or receiveWithAuthorization. Common causes are an expired or reused authorization, a signature over the wrong domain, or too little balance. None is confirmed by this data.", evidence: [], fix: ["Check the authorization's validAfter and validBefore, its nonce, and the payer's balance.", "Paste the PAYMENT-SIGNATURE into the Payload inspector to check the signature and window."] });
  }
  return out;
}
