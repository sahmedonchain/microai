import { z } from "zod";
import { ARC_NETWORKS, USDC_ADDRESS } from "@/lib/arcConfig";
import { explainReason } from "@/lib/verify/inspector";
import { facilitatorQuery, trustQuery } from "@/lib/schemas";

// A small, read-only MCP (Model Context Protocol) server over plain HTTP JSON-RPC.
//
// Read-only means: no tool sends a payment, signs anything, writes on-chain or
// stores anything. There is deliberately NO tool that accepts a PAYMENT-SIGNATURE
// or any signed payload: that is a spend authorization and must never leave the
// user's own machine. Use the Payload inspector in the browser for that.
//
// This file is pure protocol and tool definitions. The route applies the rate
// limits and the kill switch, and supplies the one tool that needs the network.

export const PROTOCOL_VERSION = "2025-03-26";
export const SERVER_INFO = { name: "microai-readonly", version: "0.1.0" };
export const MAX_BODY_BYTES = 16 * 1024;

export interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export const RPC = { parse: -32700, invalid: -32600, method: -32601, params: -32602, internal: -32603 } as const;

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface ToolDeps {
  checkEndpoint: (url: string, network: "mainnet" | "testnet" | undefined) => Promise<unknown>;
  checkFacilitator: (url: string, network: "mainnet" | "testnet" | undefined) => Promise<unknown>;
}

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: unknown, deps: ToolDeps) => Promise<unknown>;
}

const errorCodeArgs = z.object({ code: z.string().trim().min(1).max(120) });

export const TOOLS: Tool[] = [
  {
    name: "check_x402_endpoint",
    description:
      "Read-only configuration check of an x402 endpoint's payment setup on Arc. Fetches the URL once without paying and reports whether the 402 answer is well formed and points at a valid Arc USDC option. It is not a rating of the service or a safety guarantee, and it sends no payment.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full https:// URL of the endpoint." },
        network: { type: "string", enum: ["mainnet", "testnet"], description: "Arc network the endpoint is expected to use." },
      },
      required: ["url"],
      additionalProperties: false,
    },
    run: async (args, deps) => {
      const { url, network } = trustQuery.parse(args);
      return deps.checkEndpoint(url, network);
    },
  },
  {
    name: "check_x402_facilitator",
    description:
      "Read-only: asks an x402 facilitator's GET /supported whether it lists Arc Mainnet or Testnet and with which schemes. The answer is the facilitator's own claim, not proof that it settles payments. It never calls /verify or /settle and sends no payment.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The facilitator's base https:// address." },
        network: { type: "string", enum: ["mainnet", "testnet"], description: "Arc network you plan to use." },
      },
      required: ["url"],
      additionalProperties: false,
    },
    run: async (args, deps) => {
      const { url, network } = facilitatorQuery.parse(args);
      return deps.checkFacilitator(url, network);
    },
  },
  {
    name: "explain_x402_error",
    description: "Explains an x402 facilitator error reason code in plain words. Unknown codes are reported as unknown, never guessed.",
    inputSchema: { type: "object", properties: { code: { type: "string", description: "For example invalid_exact_evm_payload_signature." } }, required: ["code"], additionalProperties: false },
    run: async (args) => {
      const { code } = errorCodeArgs.parse(args);
      const meaning = explainReason(code);
      return meaning ? { code, known: true, meaning } : { code, known: false, meaning: "MicroAI does not have an explanation for this code. Check the facilitator's documentation." };
    },
  },
  {
    name: "arc_network_info",
    description: "Public Arc network parameters (chain IDs, RPC and explorer URLs, USDC address and decimals). Static data, no network call.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: async () => ({
      networks: Object.values(ARC_NETWORKS).map((n) => ({ id: n.id, name: n.name, chainId: n.chainId, rpcUrl: n.rpcUrl, explorerUrl: n.explorerUrl })),
      usdc: { address: USDC_ADDRESS, erc20Decimals: 6, nativeDecimals: 18, note: "Gas is paid in USDC. The ERC-20 interface uses 6 decimals, the native balance 18." },
    }),
  },
];

const ok = (id: RpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0" as const, id: id ?? null, result });
const fail = (id: RpcRequest["id"], code: number, message: string) => ({ jsonrpc: "2.0" as const, id: id ?? null, error: { code, message } });

export function parseRpc(text: string): RpcRequest | { error: ReturnType<typeof fail> } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: fail(null, RPC.parse, "Parse error") };
  }
  if (Array.isArray(raw)) return { error: fail(null, RPC.invalid, "Batch requests are not supported. Send one request at a time.") };
  const r = raw as Partial<RpcRequest> | null;
  if (!r || typeof r !== "object" || r.jsonrpc !== "2.0" || typeof r.method !== "string") return { error: fail(null, RPC.invalid, "Invalid request") };
  return r as RpcRequest;
}

// Returns null for notifications (no id): the caller answers 202 with no body.
export async function handleRpc(req: RpcRequest, deps: ToolDeps): Promise<ReturnType<typeof ok> | ReturnType<typeof fail> | null> {
  const isNotification = req.id === undefined;
  switch (req.method) {
    case "initialize":
      return ok(req.id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO, instructions: "Read-only tools for checking x402 payment setups on Arc. Nothing here sends a payment or accepts a signed payload." });
    case "ping":
      return ok(req.id, {});
    case "tools/list":
      return ok(req.id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case "tools/call": {
      const p = req.params as { name?: unknown; arguments?: unknown } | undefined;
      const tool = TOOLS.find((t) => t.name === p?.name);
      if (!tool) return fail(req.id, RPC.params, "Unknown tool");
      try {
        const out = await tool.run(p?.arguments ?? {}, deps);
        return ok(req.id, { content: [{ type: "text", text: JSON.stringify(out) }] } satisfies ToolResult);
      } catch (err) {
        if (err instanceof z.ZodError) {
          const msg = err.issues[0]?.message ?? "Invalid arguments";
          return ok(req.id, { content: [{ type: "text", text: `Invalid arguments: ${msg}` }], isError: true } satisfies ToolResult);
        }
        // Rate limits and upstream trouble reach the client as tool errors it can read.
        const message = err instanceof Error && "status" in err ? err.message : "The tool failed. Try again later.";
        return ok(req.id, { content: [{ type: "text", text: message }], isError: true } satisfies ToolResult);
      }
    }
    default:
      if (isNotification) return null; // notifications/initialized, notifications/cancelled, ...
      return fail(req.id, RPC.method, "Method not found");
  }
}
