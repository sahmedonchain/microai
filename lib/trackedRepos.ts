// The only repos /api/github-status is allowed to look up — mirrors the
// `repo` field of REPOS in app/build-status/page.tsx. Keeping this as an
// explicit allowlist (rather than accepting any client-supplied repo
// string) stops the endpoint from being used as an open proxy to the
// GitHub API under our own GITHUB_TOKEN.
export const TRACKED_REPOS = [
  "circlefin/arc-multichain-wallet",
  "circlefin/arc-p2p-payments",
  "circlefin/arc-commerce",
  "circlefin/arc-fintech",
  "circlefin/arc-nanopayments",
  "circlefin/arc-escrow",
  "circlefin/arc-prediction-markets",
  "Uniswap/v3-core",
  "aave/aave-v3-origin",
  "curvefi/curve-contract",
  "morpho-org/morpho-blue",
  "maple-labs/maple-core-v2",
  "aerodrome-finance/contracts",
  "Instadapp/fluid-contracts-public",
  "wormhole-foundation/wormhole",
  "LayerZero-Labs/LayerZero-v2",
  "across-protocol/contracts",
  "smartcontractkit/chainlink",
  "thirdweb-dev/js",
  "pimlicolabs/permissionless.js",
  "blockscout/blockscout",
  "informalsystems/malachite",
  "rainbow-me/rainbow",
  "sahmedonchain/microai",
] as const;

const TRACKED_REPOS_LOWER = new Set(TRACKED_REPOS.map((r) => r.toLowerCase()));

export function isTrackedRepo(repo: string): boolean {
  return TRACKED_REPOS_LOWER.has(repo.toLowerCase());
}
