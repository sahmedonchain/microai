// Single source of truth for per-query pricing. Imported by both the server
// (charging + purchase verification) and the client (display only) so the
// unit price can never drift between the two.
export const PRICE_PER_QUERY = 1000; // 0.001 USDC, 6-decimal units
export const MIN_QUERIES = 1;
export const MAX_QUERIES = 1000;

export function isValidQueryCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_QUERIES &&
    value <= MAX_QUERIES
  );
}

export function computeBundleAmount(queries: number): number {
  return queries * PRICE_PER_QUERY;
}

export function formatUsdc(units: number): string {
  return (units / 1e6).toFixed(3);
}
