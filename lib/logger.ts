// Structured JSON logging: one JSON object per line, ready for Vercel's log
// drain. Secrets are redacted by key name and wallet addresses are masked, so
// logs stay useful without becoming a store of personal data.

type Level = "debug" | "info" | "warn" | "error";

const SENSITIVE_KEY = /secret|token|password|signature|authorization|cookie|api[-_]?key|private/i;
const ADDRESS = /0x[0-9a-fA-F]{40}\b/g;

export function maskAddress(address: string): string {
  return address.length >= 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}

function scrubString(value: string): string {
  return value.replace(ADDRESS, (a) => maskAddress(a));
}

export function sanitizeLogValue(value: unknown, key = "", depth = 0): unknown {
  if (SENSITIVE_KEY.test(key)) return "[redacted]";
  if (typeof value === "string") return scrubString(value).slice(0, 500);
  if (value instanceof Error) {
    return { name: value.name, message: scrubString(value.message).slice(0, 500) };
  }
  if (depth >= 3 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitizeLogValue(v, key, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeLogValue(v, k, depth + 1)])
  );
}

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

export function createLogger(base: Record<string, unknown> = {}): Logger {
  const emit = (level: Level, msg: string, fields: Record<string, unknown> = {}) => {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      msg: scrubString(msg),
      ...(sanitizeLogValue({ ...base, ...fields }) as Record<string, unknown>),
    });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };
  return {
    debug: (m, f) => emit("debug", m, f),
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
    child: (fields) => createLogger({ ...base, ...fields }),
  };
}

export const logger = createLogger();
