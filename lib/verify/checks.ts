import { getAddress as toChecksum } from "ethers";
import { ARC_ADDRESSES, type AddressEntry } from "@/lib/arcAddresses";
import { ARC_NETWORKS, type ArcNetworkId } from "@/lib/arcConfig";
import type { EndpointResponse, ExpectedNetwork, Finding, Severity, VerifyReport } from "./types";
import { parseResponse } from "./x402";

// Static checks of an x402 endpoint's 402 answer against what is known about
// Arc. Nothing here sends a payment or calls the network.

const NETWORK_BY_CHAIN = new Map<number, ArcNetworkId>(
  (Object.values(ARC_NETWORKS) as { id: ArcNetworkId; chainId: number }[]).map((n) => [n.chainId, n.id])
);

const TOKEN_KEYS = new Set(["usdc", "eurc", "usyc"]);
const NETWORKS: ArcNetworkId[] = ["mainnet", "testnet"];
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dead";

// BigInt literals need a newer compile target than this project uses, so the
// constants are built with BigInt().
const ZERO = BigInt(0);
const pow10 = (n: number) => BigInt("1" + "0".repeat(n));
const TEN_POW_12 = pow10(12);
const LARGE_AMOUNT_UNITS = pow10(9); // 1,000 USDC at 6 decimals
const MIN_TIMEOUT_SECONDS = 5;
const MAX_TIMEOUT_SECONDS = 86_400;

export const CHECKED = [
  "HTTP status and the x402 response format",
  "Network (Arc Mainnet 5042 or Testnet 5042002)",
  "Asset address against Arc's verified address registry",
  "Amount in the asset's smallest unit (6 versus 18 decimals)",
  "Recipient address format",
  "Payment timeout",
];

export const NOT_CHECKED = [
  "No payment was sent, so signing and settlement were not tested",
  "Whether the payment facilitator accepts and settles the payment",
  "Whether the recipient is the address you intended (MicroAI does not know whose it is)",
  "Whether the service is delivered after payment",
  "Payment options on networks other than Arc",
];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function formatUnits(value: bigint, decimals: number): string {
  const base = pow10(decimals);
  const whole = value / base;
  const frac = (value % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${wholeText}.${frac}` : wholeText;
}

type AddressRead = { ok: false } | { ok: true; lower: string; badChecksum: boolean };

function readAddress(v: unknown): AddressRead {
  if (typeof v !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(v)) return { ok: false };
  let badChecksum = false;
  try {
    toChecksum(v);
  } catch {
    badChecksum = true;
  }
  return { ok: true, lower: v.toLowerCase(), badChecksum };
}

interface RegistryMatch {
  key: string;
  label: string;
  network: ArcNetworkId;
}

function registryMatches(lower: string): RegistryMatch[] {
  const out: RegistryMatch[] = [];
  for (const [key, entry] of Object.entries(ARC_ADDRESSES) as [string, AddressEntry][]) {
    for (const network of NETWORKS) {
      const addr = entry[network];
      if (addr && addr.toLowerCase() === lower) out.push({ key, label: entry.label, network });
    }
  }
  return out;
}

const netName = (n: ArcNetworkId) => ARC_NETWORKS[n].name;

function usdcOn(n: ArcNetworkId): string {
  return ARC_ADDRESSES.usdc[n];
}

interface EntryResult {
  arcNetwork?: ArcNetworkId;
}

function checkEntry(raw: unknown, i: number, out: Finding[]): EntryResult {
  const p = `accepts[${i}]`;
  const add = (f: Omit<Finding, "id"> & { field: string }) => {
    const { field, ...rest } = f;
    out.push({ id: `${p}.${field}`, ...rest });
  };

  if (!isObject(raw)) {
    out.push({ id: p, severity: "error", title: `${p} is not an object`, reason: "Each payment option must be a JSON object.", evidence: JSON.stringify(raw)?.slice(0, 60) });
    return {};
  }

  // ---- network
  const network = raw.network;
  const match = typeof network === "string" ? /^eip155:(\d+)$/.exec(network) : null;
  if (!match) {
    add({
      field: "network",
      severity: "error",
      title: "Network is not written as a chain id",
      reason: 'x402 v2 names networks as CAIP-2 ids like "eip155:5042". Names such as "arc" or a bare number are not understood by clients.',
      evidence: `network: ${JSON.stringify(network)}`,
      fix: "Use eip155:5042 for Arc Mainnet or eip155:5042002 for Arc Testnet.",
    });
    return {};
  }
  const chainId = Number(match[1]);
  const arcNetwork = NETWORK_BY_CHAIN.get(chainId);
  if (!arcNetwork) {
    const nearArc = String(chainId).startsWith("5042");
    add({
      field: "network",
      severity: nearArc ? "error" : "info",
      title: nearArc ? "Chain id looks like Arc but is not" : "Not an Arc network",
      reason: nearArc
        ? `Chain id ${chainId} is not Arc (Mainnet 5042, Testnet 5042002). It looks like a typo.`
        : "MicroAI Verify checks Arc only, so this option was not verified.",
      evidence: `network: ${network}`,
      fix: nearArc ? "Use eip155:5042 for Arc Mainnet or eip155:5042002 for Arc Testnet." : undefined,
    });
    return {};
  }
  add({
    field: "network",
    severity: "ok",
    title: `Network is ${netName(arcNetwork)}`,
    reason: `Chain id ${chainId} matches ${netName(arcNetwork)}.`,
    evidence: `network: ${network}`,
  });

  // ---- scheme and Gateway batching
  const extra = isObject(raw.extra) ? raw.extra : undefined;
  const batched = extra?.name === "GatewayWalletBatched";
  if (batched) {
    add({
      field: "scheme",
      severity: "info",
      title: "Circle Gateway batched payment",
      reason: "This option names Circle Gateway batching. Payments in this mode are settled in batches, so a single payment may not appear as its own transfer to the recipient.",
      evidence: 'extra.name: "GatewayWalletBatched"',
    });
  } else if (raw.scheme !== "exact") {
    add({
      field: "scheme",
      severity: "warning",
      title: "Scheme is not exact",
      reason: "MicroAI Verify understands the exact scheme. This option was checked only for format.",
      evidence: `scheme: ${JSON.stringify(raw.scheme)}`,
    });
  }

  // ---- asset
  const asset = readAddress(raw.asset);
  if (!asset.ok) {
    add({
      field: "asset",
      severity: "error",
      title: "Asset is not a valid address",
      reason: "asset must be the token contract address (0x followed by 40 hex characters).",
      evidence: `asset: ${JSON.stringify(raw.asset)}`,
      fix: `USDC on ${netName(arcNetwork)} is ${usdcOn(arcNetwork)}.`,
    });
  } else {
    const matches = registryMatches(asset.lower);
    const here = matches.filter((m) => m.network === arcNetwork);
    const other = matches.filter((m) => m.network !== arcNetwork);
    const ev = `asset: ${raw.asset}`;
    if (asset.lower === ZERO_ADDRESS || asset.lower === DEAD_ADDRESS) {
      add({ field: "asset", severity: "error", title: "Asset is the zero or burn address", reason: "This is not a token contract.", evidence: ev, fix: `USDC on ${netName(arcNetwork)} is ${usdcOn(arcNetwork)}.` });
    } else if (here.some((m) => m.key === "usdc")) {
      add({ field: "asset", severity: "ok", title: `Asset is USDC on ${netName(arcNetwork)}`, reason: "The address matches Arc's USDC address.", evidence: ev });
    } else if (here.some((m) => m.key === "eurc")) {
      add({ field: "asset", severity: "warning", title: "Asset is EURC, not USDC", reason: "The address is Arc's EURC token. Make sure you want to charge in EURC.", evidence: ev, fix: `For USDC use ${usdcOn(arcNetwork)}.` });
    } else if (here.length > 0) {
      add({ field: "asset", severity: "warning", title: "Asset is not USDC", reason: `The address is ${here[0].label}, not USDC.`, evidence: ev, fix: `For USDC use ${usdcOn(arcNetwork)}.` });
    } else if (other.length > 0) {
      const o = other[0];
      add({
        field: "asset",
        severity: "error",
        title: `${netName(o.network)} address used on ${netName(arcNetwork)}`,
        reason: `This address is ${o.label} on ${netName(o.network)}. On ${netName(arcNetwork)} it is a different address or does not exist, so payments would fail or go to the wrong token.`,
        evidence: ev,
        fix: `For USDC use ${usdcOn(arcNetwork)}.`,
      });
    } else {
      add({
        field: "asset",
        severity: "warning",
        title: "Asset is not in the Arc address registry",
        reason: "The address is not one MicroAI has verified. If you meant USDC, check it.",
        evidence: ev,
        fix: `USDC on ${netName(arcNetwork)} is ${usdcOn(arcNetwork)}.`,
      });
    }
    if (asset.badChecksum) {
      add({ field: "asset", severity: "warning", title: "Asset address has a bad checksum", reason: "The mixed-case spelling does not match the address checksum, which often means a typo.", evidence: ev });
    }
  }

  // ---- amount
  const rawAmount = raw.amount;
  let units: bigint | undefined;
  if (typeof rawAmount === "string" && /^\d+$/.test(rawAmount)) {
    units = BigInt(rawAmount);
  } else if (typeof rawAmount === "number" && Number.isSafeInteger(rawAmount) && rawAmount >= 0) {
    units = BigInt(rawAmount);
    add({ field: "amount", severity: "warning", title: "Amount should be a string", reason: "x402 sends amount as a decimal string. A JSON number can lose precision in some clients.", evidence: `amount: ${rawAmount}`, fix: `Send "${rawAmount}" as a string.` });
  } else if (typeof rawAmount === "string" && /^\d+\.\d+$/.test(rawAmount)) {
    add({ field: "amount", severity: "error", title: "Amount is a decimal, not smallest units", reason: "amount is counted in the token's smallest unit (6 decimals for USDC), so it must be a whole number.", evidence: `amount: ${JSON.stringify(rawAmount)}`, fix: 'For 0.01 USDC send "10000".' });
  } else {
    add({ field: "amount", severity: "error", title: "Amount is missing or not a number", reason: "amount must be a whole number of the token's smallest unit, as a string.", evidence: `amount: ${JSON.stringify(rawAmount)}` });
  }
  if (units !== undefined) {
    const ev = `amount: ${JSON.stringify(rawAmount)}`;
    if (units === ZERO) {
      add({ field: "amount", severity: "warning", title: "Amount is zero", reason: "A paid endpoint that asks for nothing is probably a mistake.", evidence: ev });
    } else if (units >= TEN_POW_12 && units % TEN_POW_12 === ZERO) {
      add({
        field: "amount",
        severity: "error",
        title: "Amount looks like 18 decimals, USDC uses 6",
        reason: `${units} is ${formatUnits(units, 18)} USDC if read with 18 decimals, but the USDC interface uses 6 decimals, so a client would be asked for ${formatUnits(units, 6)} USDC.`,
        evidence: ev,
        fix: `Use "${units / TEN_POW_12}" for ${formatUnits(units, 18)} USDC.`,
      });
    } else if (units >= LARGE_AMOUNT_UNITS) {
      add({ field: "amount", severity: "warning", title: "Amount is unusually large", reason: `This asks for ${formatUnits(units, 6)} USDC per call. Check that it is not a decimals mistake.`, evidence: ev });
    } else {
      add({ field: "amount", severity: "ok", title: `Amount is ${formatUnits(units, 6)} USDC`, reason: "Read with 6 decimals, the amount is in a normal range.", evidence: ev });
    }
  }

  // ---- recipient
  const payTo = readAddress(raw.payTo);
  const payEv = `payTo: ${JSON.stringify(raw.payTo)}`;
  if (!payTo.ok) {
    add({ field: "payTo", severity: "error", title: "Recipient is not a valid address", reason: "payTo must be an address (0x followed by 40 hex characters).", evidence: payEv });
  } else if (payTo.lower === ZERO_ADDRESS || payTo.lower === DEAD_ADDRESS) {
    add({ field: "payTo", severity: "error", title: "Recipient is the zero or burn address", reason: "Funds sent there are lost.", evidence: payEv });
  } else if (asset.ok && payTo.lower === asset.lower) {
    add({ field: "payTo", severity: "error", title: "Recipient is the token contract itself", reason: "Tokens sent to their own contract are usually lost.", evidence: payEv });
  } else if (registryMatches(payTo.lower).some((m) => TOKEN_KEYS.has(m.key))) {
    add({ field: "payTo", severity: "error", title: "Recipient is a token contract", reason: "payTo is a known Arc token contract, not a wallet that can spend what it receives.", evidence: payEv });
  } else {
    add({ field: "payTo", severity: "ok", title: "Recipient is a valid address", reason: "The format is valid. MicroAI cannot tell whose address it is, so confirm it is yours.", evidence: payEv });
  }
  if (payTo.ok && payTo.badChecksum) {
    add({ field: "payTo", severity: "warning", title: "Recipient address has a bad checksum", reason: "The mixed-case spelling does not match the address checksum, which often means a typo.", evidence: payEv });
  }

  // ---- timeout
  const timeout = raw.maxTimeoutSeconds;
  if (typeof timeout !== "number" || !Number.isInteger(timeout) || timeout <= 0) {
    add({ field: "maxTimeoutSeconds", severity: "error", title: "maxTimeoutSeconds is missing or invalid", reason: "It must be a positive whole number of seconds, so clients know how long a signed payment stays valid.", evidence: `maxTimeoutSeconds: ${JSON.stringify(timeout)}`, fix: "Set it to a value such as 60 to 300." });
  } else if (timeout < MIN_TIMEOUT_SECONDS) {
    add({ field: "maxTimeoutSeconds", severity: "warning", title: "Timeout is very short", reason: `${timeout} seconds may expire before the payment is signed and settled.`, evidence: `maxTimeoutSeconds: ${timeout}` });
  } else if (timeout > MAX_TIMEOUT_SECONDS) {
    add({ field: "maxTimeoutSeconds", severity: "warning", title: "Timeout is very long", reason: `A signed payment would stay valid for ${Math.round(timeout / 3600)} hours.`, evidence: `maxTimeoutSeconds: ${timeout}` });
  } else {
    add({ field: "maxTimeoutSeconds", severity: "ok", title: `Timeout is ${timeout} seconds`, reason: "The value is in a normal range.", evidence: `maxTimeoutSeconds: ${timeout}` });
  }

  // ---- EIP-712 domain hints
  if (!batched && raw.scheme === "exact" && (typeof extra?.name !== "string" || typeof extra?.version !== "string")) {
    add({ field: "extra", severity: "info", title: "extra.name and extra.version are not set", reason: "Clients using the exact scheme on EVM usually need them for the token's signing domain. Confirm with your client library." });
  }

  return { arcNetwork };
}

const RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2, ok: 3 };

export function verifyEndpointResponse(res: EndpointResponse, opts: { expectedNetwork?: ExpectedNetwork } = {}): VerifyReport {
  const { parsed, findings } = parseResponse(res);

  if (parsed) {
    const arcNetworks: ArcNetworkId[] = [];
    parsed.accepts.forEach((entry, i) => {
      const r = checkEntry(entry, i, findings);
      if (r.arcNetwork) arcNetworks.push(r.arcNetwork);
    });

    if (arcNetworks.length === 0) {
      findings.push({
        id: "network",
        severity: "warning",
        title: "No Arc payment option",
        reason: "None of the payment options is on Arc, so nothing could be verified.",
        fix: "Add an option with network eip155:5042 (Mainnet) or eip155:5042002 (Testnet).",
      });
    } else if (opts.expectedNetwork && !arcNetworks.includes(opts.expectedNetwork)) {
      const offered = arcNetworks[0];
      findings.push({
        id: "network",
        severity: "error",
        title: `Endpoint offers ${netName(offered)}, not ${netName(opts.expectedNetwork)}`,
        reason: `You asked for ${netName(opts.expectedNetwork)}, but the only Arc option is on ${netName(offered)}.`,
        fix: `Add an option with network eip155:${ARC_NETWORKS[opts.expectedNetwork].chainId}.`,
      });
    }
  }

  const sorted = findings
    .map((f, i) => ({ f, i }))
    .sort((a, b) => RANK[a.f.severity] - RANK[b.f.severity] || a.i - b.i)
    .map((x) => x.f);

  const counts: Record<Severity, number> = { ok: 0, info: 0, warning: 0, error: 0 };
  for (const f of sorted) counts[f.severity]++;

  return { expectedNetwork: opts.expectedNetwork, findings: sorted, counts, checked: CHECKED, notChecked: NOT_CHECKED };
}
