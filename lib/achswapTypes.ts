// Shared by the AchSwap on-chain route and the Build status UI. Kept free of
// server-only imports so client components can use it.

// Human-readable version of MAX_CHUNKS * CHUNK_SIZE at Arc's ~0.5s block
// time, for the UI to state the scan window honestly instead of implying
// "no activity ever" when nothing turns up.
export const SCAN_WINDOW_LABEL = "~10h";

export type ContractRole = "swap" | "liquidity" | "infra";

export interface ContractStatus {
  name: string;
  address: string;
  role: ContractRole;
  hasCode: boolean;
}

export interface ActivityResult {
  lastActivityAt: string | null;
  lastActivityTxHash: string | null;
  lastActivityAddress: string | null;
}

export interface AchSwapOnchainPayload {
  chainIdOk: boolean;
  contracts: ContractStatus[];
  verifiedCount: number;
  totalCount: number;
  swap: ActivityResult;
  liquidity: ActivityResult;
  unavailable: boolean;
}

