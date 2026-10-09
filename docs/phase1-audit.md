# MicroAI Phase 1: Audit Report (Step 0)

Date: 2026-10-09. Repo: `/home/sahmed/microai`, branch `main`. Baseline audit at `3385f6a`; **updated after Phase 1 Step 1** (security and shared foundation, local commits, not pushed). Spec: `docs/phase1-spec.md` (moved unchanged from the repo root).

The baseline audit changed no application code. Step 1 then fixed the items marked in section 7 and in the tables below; every row whose status changed cites the new evidence.

## How to read this report

- **PASS**: implemented, and verified by code reading plus a test or a real run. There are **no automated tests in the repo**, so a PASS here always rests on a real run I performed (listed below).
- **PARTIAL**: partly done, or works but has no tests.
- **MISSING**: not implemented.
- **BLOCKED**: cannot be done properly because no trusted data source or authoritative documentation exists today. These are not counted as MISSING.
- A UI that merely renders is never enough for PASS.
- **[NOT FEASIBLE on Vercel as-is]** marks items that need a shell, a binary toolchain, or a long-running process (see section 8).

### Real runs performed (evidence behind every PASS)
All on 2026-10-09 against live services, using wallet `0x4fd87e600d703c0c05c01096b8b3451192e54f29` and tx `0x60fc1c47ededfe4eb3e751dce79fa7da3e660bc72fa4bf4db85230d27e68c692`:
1. Arc Explorer API through `lib/arcExplorer.ts`: address, transactions, token-balances, counters, tx, tx token-transfers, token-transfers (USDC filter), an unknown tx (404 path).
2. `/api/wallet`, `/api/debug-analyze` (found and not-found), `/api/payment-history` (signed test session: 19 USDC receipts), `/api/copilot` (live Groq, CONTRACT mode; forced-truncation `Continue` chain), `/api/news?refresh=1`, `/api/github-status`.
3. Unauthenticated `POST` to `/api/credits/purchase`, `/api/copilot`, `/api/payment-history`, `/api/chat`: all returned 401.
4. Rate-limit probes: `/api/wallet` returned 429 from the 11th call on a single instance; `/api/session/nonce` allowed 20 of 20 requests.
5. `lib/ecosystemEnrichment.ts` against DeFiLlama (Aave $181.9M, Argus $1.20M, Morpho and Uniswap null).
6. Tracked-file secret scan (no tokens, keys or `.env` files committed), `tsc --noEmit` clean, `pnpm build` passes, `eslint app lib`: 12 errors, 4 warnings, all pre-existing and unrelated to the audited behaviour.
- **Not run**: a real credit purchase (needs a funded wallet and a signing session), any positive unlimited-approval case, a failed-tx debug case, and any browser/UI session.

## Summary counts

| Module | PASS | PARTIAL | MISSING | BLOCKED | Total |
|---|---|---|---|---|---|
| 1. AI Developer Copilot (/build) | 0 | 24 | 23 | 1 | 48 |
| 2. Transaction Intelligence 2.0 (/debug) | 3 | 21 | 13 | 1 | 38 |
| 3. Wallet Intelligence (/wallet) | 5 | 12 | 17 | 1 | 35 |
| 4. USDC Payment Infrastructure | 2 | 26 | 25 | 0 | 53 |
| 5. Ecosystem Directory 2.0 (/ecosystem) | 3 | 15 | 27 | 3 | 48 |
| 6. Cross-System Requirements | 7 | 12 | 4 | 0 | 23 |
| **All modules** | **20** | **110** | **109** | **6** | **245** |

Rows tagged `-note` are the spec's cautionary paragraphs and are included in the counts.

## Architecture inventory

**Stack**: Next.js 16.3.5 (App Router, Turbopack), React 19.2.4, TypeScript 5, Tailwind 4, pnpm 12. Hosted on Vercel (live: `microai-tan.vercel.app`). No `vercel.json`, no `.github/`, no CI. `next.config.ts` is empty (no security headers).

**Pages**: `/` renders `HomeTab` (sidebar shell with panels: chat, ecosystem, grants, build status, stats, news, copilot, wallet, debugger, credits). The panel components in `app/components/tabs/` are also served by standalone routes (`/ecosystem`, `/grants`, `/build-status`, `/stats`, `/news`, `/wallet`, `/debug`, `/credits`, `/build`, `/chat`). Several standalone routes are still duplicate copies of the panel code.

**API routes** (all `app/api/*/route.ts`):

| Route | Auth | Storage / upstream | AI |
|---|---|---|---|
| `POST /api/chat` | session + 1 credit | Redis (credits), static KB (`lib/knowledge.ts`, `lib/search.ts`) | Groq `openai/gpt-oss-120b` |
| `POST /api/copilot` | session + 1 credit (Continue free) | Redis (credits, continuation state), `lib/copilotPrompt.ts` | Groq `openai/gpt-oss-120b` |
| `POST /api/credits/purchase` | session | Arc RPC (receipt, block), Redis (`usedtx`, credits) | none |
| `GET /api/credits/balance` | session | Redis | none |
| `GET/POST/DELETE /api/session`, `GET /api/session/nonce` | public (creates the session) | Redis (nonce, 5 min) | none |
| `POST /api/payment-history` | session | Arc Explorer, Redis (balance) | none |
| `POST /api/debug-analyze` | public | Arc Explorer | Groq |
| `POST /api/wallet` | public | Arc Explorer | Groq |
| `POST /api/ecosystem-search` | public | none (client sends project names) | Groq |
| `GET /api/ecosystem-tvl` | public | DeFiLlama, Redis cache 6 h | none |
| `GET /api/github-status` | public (allow-listed repos) | GitHub API, Redis cache 12 min | none |
| `GET /api/achswap-onchain` | public | Arc RPC, Redis cache 12 min | none |
| `GET /api/stats` | public | Arc RPC (`eth_getLogs`), Redis (scan state + lock) | none |
| `GET /api/news` | public (`?refresh=1` rate-limited) | RSS/sitemap scraping, Redis cache 30 min | none |

**Lib helpers**: `session.ts` (HMAC-SHA256 token, 24 h, cookie `microai_session`), `siwe.ts` + `nonce.ts` (EIP-4361 sign-in message and single-use nonces), `credits.ts` (Redis counter, no expiry since Step 1), `usedTx.ts` (replay set), `pricing.ts` (0.001 USDC per query), `rateLimit.ts` (Redis sliding window), `arcExplorer.ts` (Blockscout client, Referer workaround), `arcRpc.ts` (RPC client with timeout and retry), `arcConfig.ts` and `arcAddresses.ts` (network config and verified address registry), `api.ts` (`withApi`, typed errors, zod parsing), `schemas.ts`, `logger.ts`, `redis.ts`, `untrusted.ts`, `chatHistory.ts`, `ecosystemData.ts`, `copilotPrompt.ts`, `statsScan.ts`, `ecosystemEnrichment.ts`, `news.ts`, `trackedRepos.ts`, `knowledge.ts` (2,857 lines), `search.ts` (Fuse.js), `format.ts`.

**Storage**: Upstash Redis only (no SQL database, no migrations). Keys: `microai:credit:*`, `microai:usedtx:*`, `microai:siwe:nonce:*`, `microai:rl:*`, `microai:copilot:cont:*`, `microai:stats:*`, `microai:news:*`, `microai:ghstatus:*`, `microai:achswap:*`, `microai:ecosystem:tvl:*`.

**AI**: one provider, Groq, model `openai/gpt-oss-120b`, called directly from five routes (chat, copilot, debug-analyze, wallet, ecosystem-search). No abstraction or fallback. Unused dependencies: `@ai-sdk/anthropic`, `ai`, `@google/genai`.

**Smart contracts**: none in the repo (no `.sol`, no Foundry/Hardhat config). The product only reads on-chain data and verifies USDC transfers to a single EOA receiver.

**Wallet integration**: `WalletModal.tsx` (MetaMask, Coinbase, Trust, Brave via injected providers), network switch to Arc (0x13b2), message signing for the session, `eth_sendTransaction` for the USDC purchase (`HomeTab.tsx`).

**Payment / credit flow**: user sends USDC to the receiver wallet, then `POST /api/credits/purchase` verifies the receipt and USDC Transfer log, claims the tx hash, and adds credits; each AI call spends one credit (Redis `DECR`, compensating `INCR`).

**Environment variables (names only)**: `GROQ_API_KEY`, `GITHUB_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SESSION_SECRET`, `COMMUNITY_ADMIN_KEY` (unused by any code), `X_BEARER_TOKEN` (read by a dormant function in `lib/news.ts`), `SIWE_DOMAIN` (optional, pins the sign-in domain; defaults to the request host).

**Tests**: 101 Vitest tests in 13 files (`pnpm test`), CI workflow in `.github/workflows/ci.yml`. No end-to-end tests.

## Step 1 changes (security and shared foundation)

| Commit area | What changed | Tests |
|---|---|---|
| A. Test foundation | Vitest, an in-memory fake Redis (labelled MOCK), GitHub Actions CI (install, lint, typecheck, test, build). Two React Compiler lint rules downgraded to warnings so CI gates on new errors; the 12 existing findings are unchanged. | smoke |
| F. Shared foundation | `lib/arcConfig.ts`, `lib/arcAddresses.ts` (verified registry), `lib/api.ts` (`withApi`, typed errors, zod parsing), `lib/schemas.ts`, `lib/logger.ts`, `lib/arcRpc.ts`, `lib/redis.ts`. `lib/knowledge.ts` and both AI prompts now read addresses from the registry; wrong or unverifiable addresses removed. | registry, logger, rpc, schemas, api |
| C. Rate limiting | Redis sliding-window limiter on all 15 routes, wallet-keyed when signed in, 429 + Retry-After. | limiter (fake Redis) + one live Upstash check |
| B. Sign-in | EIP-4361 message, single-use Redis nonces (5 min, GETDEL), domain/URI/chain/time validation, nonce endpoint rate-limited. | siwe, session (real signatures over fake Redis) |
| D. Public AI endpoints | Kept public but capped per minute, per day per caller, and by a shared daily budget per route. Ecosystem search builds its project list server-side and ignores client data. | publicAiRoutes |
| E. Prompt injection | Chat history validated; one shared untrusted-content helper applied to wallet, debug and ecosystem prompts. | untrusted, promptInjection |
| G. Credits | No 30-day expiry; legacy balances are made permanent when touched; idempotent migration script (dry-run by default). | credits |

Totals: 101 tests in 13 files, all passing. Mock-based suites say so in their header comment; the real-service checks run during Step 1 are listed in the Step 1 report (live Upstash limiter check, full sign-in/chat/debug/wallet/credits flow against a local production build with a throwaway wallet).

## Module 1. AI Developer Copilot (/build)

PASS 0 | PARTIAL 24 | MISSING 23 | BLOCKED 1

| # | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 1.1-1 | Natural language to structured requirements | **MISSING** | - | Copilot returns one free-text answer per mode. No requirements object, schema or storage. |
| 1.1-2 | Requirements clarification / missing-information detection | **MISSING** | lib/copilotPrompt.ts (rule 8) | Single-shot. The prompt only says to state assumptions; it never asks questions back. |
| 1.1-3 | Complete architecture and file-structure generation | **PARTIAL** | lib/copilotPrompt.ts (ARCHITECT, CONTRACT formats); app/api/copilot/route.ts | Text output only, no file tree artifact. Live run (CONTRACT, tip jar) returned contract + deploy steps + Next.js page as markdown. No tests. |
| 1.1-4 | Frontend, backend, database, API and smart-contract generation | **PARTIAL** | app/api/copilot/route.ts; live run 2026-10-09 | Contract and frontend text generated in a real run. Nothing compiled or executed. Database/API generation not exercised. |
| 1.1-5 | Code generation that follows the existing project structure | **MISSING** | - | The Copilot has no access to any user repo. [NOT FEASIBLE on Vercel as-is, see Feasibility F6] |
| 1.1-6 | Multi-step build plan and implementation status tracking | **MISSING** | - | No plan object, no step state, no persistence besides the 15-minute continuation state in Redis. |
| 1.2-1 | Arc-compatible Solidity contract generation | **PARTIAL** | lib/copilotPrompt.ts (network, address, unit and opcode facts from docs.arc.io); live run | Facts are docs-sourced and hand-maintained. Generated Solidity was never compiled, so 'compatible' is unverified. |
| 1.2-2 | Templates: USDC payment, subscription, escrow, marketplace, revenue share, agent payment | **MISSING** | - | No template library. The model writes from scratch each time. ERC-8183 is mentioned in the prompt only. |
| 1.2-3 | Access control, ownership, pausing, upgradeability where needed | **PARTIAL** | lib/copilotPrompt.ts rule 4 (OpenZeppelin v5 Ownable/Pausable/ReentrancyGuard) | Upgradeability (proxy patterns) has no guidance. |
| 1.2-4 | Solidity version and compiler configuration validation | **BLOCKED** | lib/copilotPrompt.ts (tells model to 'verify in Arc docs') | docs.arc.io does not pin a solc version (only 'targets the Osaka hard fork', evm-compatibility page). No authoritative source to validate against. A local solc-js compile check is possible but would not be an Arc-specific validation. |
| 1.2-5 | Interfaces, events, errors, access permissions generation | **PARTIAL** | lib/copilotPrompt.ts CONTRACT format | Required by prompt format, not checked. |
| 1.2-6 | Unit, integration and edge-case test generation | **PARTIAL** | lib/copilotPrompt.ts CONTRACT format ('Tests to Write') | The format asks for a list of tests; actual test code is not required or checked. |
| 1.2-7 | Static analysis and vulnerability scanning integration | **MISSING** | lib/copilotPrompt.ts AUDIT mode (LLM review only) | No Slither/solhint/Mythril. [NOT FEASIBLE on Vercel as-is, see F2] |
| 1.2-8 | Deployment scripts and post-deployment verification | **PARTIAL** | lib/copilotPrompt.ts DEPLOY format (Foundry, testnet first) | Scripts are generated as text; nothing runs, and post-deploy verification is never performed. |
| 1.3-1 | USDC transfer, approval and payment-verification code | **PARTIAL** | lib/copilotPrompt.ts (USDC mode, 6 vs 18 decimals rules, parseUnits) | Generated code is unverified. The platform's own verification lives in app/api/credits/purchase/route.ts. |
| 1.3-2 | On-chain receipt and event verification | **PARTIAL** | app/api/credits/purchase/route.ts (verifyPurchase) | Implemented for the platform's own purchases. No tests, no live payment run during this audit. |
| 1.3-3 | Circle Wallets API integration where supported | **MISSING** | - | Arc is supported: developers.circle.com/wallets/supported-blockchains lists Arc (ARC / ARC-TESTNET): developer-controlled EOA+SCA, user-controlled EOA+SCA, modular MSCA. Needs a Circle API key (external credential). |
| 1.3-4 | CCTP cross-chain transfer workflow | **PARTIAL** | lib/copilotPrompt.ts (CCTP addresses, domain 26 labelled per network) | Text guidance only. No executable flow or attestation polling in the product. |
| 1.3-5 | Gateway integration where supported | **MISSING** | lib/copilotPrompt.ts (Gateway addresses only) | Arc is listed for Gateway (domain 26) at developers.circle.com/gateway/references/supported-blockchains. No integration code. |
| 1.3-6 | API authentication, server-side secrets, environment configuration | **PARTIAL** | app/api/*/route.ts use process.env; lib/copilotPrompt.ts rule 3 | Platform uses env secrets. For generated code it is a prompt rule only. |
| 1.3-7 | Retry, timeout, idempotency, failure recovery | **PARTIAL** | lib/arcExplorer.ts (timeout + 1 retry); lib/usedTx.ts (txHash claim) | The purchase route's RPC call (rpcCall) has no timeout or retry. |
| 1.3-8 | Verified integration patterns from official docs | **PARTIAL** | lib/copilotPrompt.ts header (docs.arc.io pages, verified 2026-10-09) | Manual snapshot, no live retrieval. docs.arc.io/mcp (Arc MCP server: docs search + get-page, no auth) could ground answers at runtime. |
| 1.3-note | Verify docs / network / SDK version / address before each integration | **PARTIAL** | lib/copilotPrompt.ts rule 1 | Prompt-level instruction only, no runtime check. |
| 1.4-1 | Fix generated code until it compiles | **MISSING** | - | No compiler in the loop. [NOT FEASIBLE on Vercel as-is for Foundry; solc-js is possible, see F3] |
| 1.4-2 | Run TypeScript, lint, unit and integration tests | **MISSING** | - | Nothing is executed. [NOT FEASIBLE on Vercel as-is, see F1] |
| 1.4-3 | Dependency and version compatibility checks | **MISSING** | - | Prompt asks for version pinning only. |
| 1.4-4 | Static analysis and security checks | **MISSING** | lib/copilotPrompt.ts AUDIT mode | LLM review only (see 1.2-7). |
| 1.4-5 | Error root-cause diagnosis and automatic fix attempts | **PARTIAL** | lib/copilotPrompt.ts DEBUG mode | Diagnoses pasted errors as text; no automatic fix attempts. |
| 1.4-6 | Assumptions and limitations shown for each code block | **PARTIAL** | lib/copilotPrompt.ts rule 8; live run ended with a 'verify compiler version' note | Not enforced per code block. |
| 1.4-7 | Documentation-backed answers with source references | **PARTIAL** | lib/copilotPrompt.ts; app/api/chat/route.ts + lib/search.ts (static knowledge base) | No retrieval, no citations. Chat uses a static 2,857-line knowledge file. |
| 1.4-8 | Never present uncertain information as certain | **PARTIAL** | lib/copilotPrompt.ts rule 1 ('verify in Arc docs') | Prompt-only, untested. |
| 1.4-9 | No 'tested', 'secure' or 'production-ready' claim without running tests | **PARTIAL** | lib/copilotPrompt.ts AUDIT disclaimer | No explicit prohibition in the base prompt. |
| 1.5-1 | Analyse existing project file structure and dependencies | **MISSING** | - | [NOT FEASIBLE now, see F6] |
| 1.5-2 | Modify required files and create new files | **MISSING** | - | [NOT FEASIBLE now, see F6] |
| 1.5-3 | Regression checks for existing functionality | **MISSING** | - | [NOT FEASIBLE on Vercel as-is, see F1] |
| 1.5-4 | Git diff and change summary | **MISSING** | - | [NOT FEASIBLE now, see F6] |
| 1.5-5 | Approval before destructive changes | **MISSING** | - | No change path exists. |
| 1.5-6 | Never reveal secrets or production configuration | **PARTIAL** | lib/copilotPrompt.ts rule 3 | Prompt-only. |
| 1.6-1 | Pipeline: Requirements, Plan, Generate, Integrate, Test, Security Scan, Deploy | **MISSING** | - | Only 'Generate' exists, as text. |
| 1.6-2 | Status and logs for each stage | **MISSING** | - | - |
| 1.6-3 | Test-failure diagnosis and bounded retry | **MISSING** | - | - |
| 1.6-4 | Build, test and security gate before deployment | **MISSING** | - | - |
| 1.6-5 | Arc deployment configuration validation | **PARTIAL** | lib/copilotPrompt.ts DEPLOY format (testnet 5042002 first, mainnet 5042) | Generated config is not validated. |
| 1.6-6 | Explicit user approval before deployment | **PARTIAL** | - | Satisfied by absence: the product never deploys, the user runs scripts themselves. |
| 1.6-7 | Never give a production private key or seed phrase to the AI | **PARTIAL** | lib/copilotPrompt.ts rule 3; no key input field anywhere in app/ | Prompt-only control. A live answer used a PRIVATE_KEY env var placeholder, not a request to paste a key. |
| 1.6-8 | After deployment: contract address, tx hash, receipt, verification status | **MISSING** | - | Blockscout exposes verification state, but nothing consumes it. |
| 1.6-9 | Rollback and recovery guidance | **PARTIAL** | lib/copilotPrompt.ts DEPLOY format ('Rollback / Safety Notes') | Text only. |
| 1.6-note | Verify repo write access, shell, RPC, credentials and approved deploy tools actually exist | **MISSING** | - | They do not: Vercel serverless, no shell, no repo access, no deploy keys. See Feasibility. |

## Module 2. Transaction Intelligence 2.0 (/debug)

PASS 3 | PARTIAL 21 | MISSING 13 | BLOCKED 1

| # | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 2.1-1 | Transaction hash validation | **PASS** | app/api/debug-analyze/route.ts (TX_HASH_RE); live run: valid hash accepted, unknown hash returned 404 'not found' | No automated test. |
| 2.1-2 | Correct chain and network verification | **PARTIAL** | lib/arcExplorer.ts (fixed Mainnet explorer) | Chain is implied by the URL. A testnet hash just reads as 'not found'; no chain check or hint. |
| 2.1-3 | Receipt and execution status | **PARTIAL** | app/api/debug-analyze/route.ts (Explorer status/result) | Success case run live. Failed and pending cases never run. |
| 2.1-4 | Block number, timestamp, sender, recipient, nonce, gas details | **PARTIAL** | app/components/tabs/DebuggerTab.tsx | UI shows hash, from, to, gas used/limit, block, fee. Nonce, timestamp and value are not displayed. |
| 2.1-5 | Input data and function selector decoding | **PARTIAL** | app/api/debug-analyze/route.ts (KNOWN_SELECTORS, 8 entries) | Anything else is 'unknown'. Explorer's own decoded method name is ignored. |
| 2.1-6 | Function and parameter decoding when an ABI exists | **MISSING** | - | Blockscout returns decoded_input for verified contracts; unused. |
| 2.1-7 | Logs and events parsing | **PARTIAL** | app/api/debug-analyze/route.ts (Explorer token-transfers endpoint) | Only token transfers. Generic logs are not parsed. |
| 2.1-8 | ERC-20 transfers and USDC/EURC movement detection | **PASS** | app/api/debug-analyze/route.ts (normalizeTransfers); live run on tx 0x60fc... returned 2 transfers with symbols and amounts | USDC/EURC are not singled out. No tests. |
| 2.1-9 | Native token and token balance changes | **PARTIAL** | - | Transfers are listed; no balance deltas and native value is not shown. |
| 2.1-10 | Contract interaction timeline | **PARTIAL** | app/api/debug-analyze/route.ts (internal-transactions) | Internal calls listed; values are raw wei strings. |
| 2.2-1 | Revert reason and decoded custom errors | **PARTIAL** | app/api/debug-analyze/route.ts (revert_reason into prompt) | Raw Explorer string only; custom errors are not decoded. |
| 2.2-2 | Insufficient balance or allowance | **PARTIAL** | app/api/debug-analyze/route.ts (buildCorrectedFlow keyword match) | Keyword guess on the revert text. No on-chain balance or allowance read. |
| 2.2-3 | Wrong chain or address | **MISSING** | - | - |
| 2.2-4 | Gas estimation and out-of-gas | **PARTIAL** | app/api/debug-analyze/route.ts (gas_used/gas_limit given to AI) | No estimation; the 'gas' correction only fires when the error text contains 'gas'. |
| 2.2-5 | Nonce, signature, deadline issues | **MISSING** | - | Named in the prompt only; no evidence is gathered. |
| 2.2-6 | Access-control failures | **MISSING** | - | AI guess at best. |
| 2.2-7 | Slippage, invalid parameters, contract logic failures | **MISSING** | - | - |
| 2.2-8 | RPC timeout, pending and dropped transaction detection | **PARTIAL** | app/api/debug-analyze/route.ts (block 'pending'); lib/arcExplorer.ts | Pending is shown; dropped is not detected; upstream timeouts become a 502. |
| 2.2-9 | Root cause with supporting on-chain evidence | **PARTIAL** | app/api/debug-analyze/route.ts (AI JSON) | Root cause is free text from the model; evidence is not cited or structured. |
| 2.3-1 | Balance and allowance checks before sending | **MISSING** | - | No preflight feature on /debug. |
| 2.3-2 | eth_call and gas estimation where supported | **MISSING** | - | Feasible with the Arc RPC inside a function, see F5. |
| 2.3-3 | State-aware simulation if an engine is supported | **BLOCKED** | - | docs.arc.io only documents a local binary (arc-anvil). No hosted simulation or tracing service is documented. |
| 2.3-4 | Expected token movement and possible failure | **MISSING** | - | - |
| 2.3-5 | Clear difference between simulation and actual execution | **MISSING** | - | - |
| 2.3-6 | Warn that a passing simulation does not guarantee execution | **PARTIAL** | lib/copilotPrompt.ts SIMULATE format | Only in Copilot SIMULATE mode, not on /debug. |
| 2.4-1 | Plain-language transaction explanation | **PASS** | app/api/debug-analyze/route.ts; live run returned summary, rootCause, solution | AI text is not independently verified. |
| 2.4-2 | Root cause of the error | **PARTIAL** | app/api/debug-analyze/route.ts | Model-generated. |
| 2.4-3 | Evidence-based confidence level | **MISSING** | - | Only a high/medium/low severity, which is not confidence. |
| 2.4-4 | Step-by-step fix | **PARTIAL** | app/api/debug-analyze/route.ts (solution + correctedFlow) | correctedFlow is 4 hard-coded keyword branches. |
| 2.4-5 | Corrected parameters or code suggestion | **PARTIAL** | - | Generic strings, not actual parameters. |
| 2.4-6 | Related contract function and documentation references | **MISSING** | - | - |
| 2.4-7 | Warning for risky or malicious contract interaction | **MISSING** | - | - |
| 2.5-1 | Validation of Arc RPC and Explorer responses | **PARTIAL** | lib/arcExplorer.ts; app/api/debug-analyze/route.ts (txData.hash check) | Status and JSON checks only. No schema validation. |
| 2.5-2 | Timeout, rate-limit and retry handling | **PARTIAL** | lib/arcExplorer.ts (8s timeout, 1 retry on timeout, network error, 429, 5xx) | Retry path never exercised. No tests. |
| 2.5-3 | Timestamp on cached data | **PARTIAL** | app/api/debug-analyze/route.ts (cache: no-store) | No caching here, so nothing to stamp. |
| 2.5-4 | Clear limitation when ABI or data is missing | **PARTIAL** | app/components/tabs/DebuggerTab.tsx ('unknown' badge) | No explanatory text. |
| 2.5-5 | AI must not invent a result, revert reason or token movement | **PARTIAL** | app/api/debug-analyze/route.ts | Status and token movements come from the Explorer, not the model. rootCause text can still contradict the data. |
| 2.5-6 | Automated regression tests for known transactions | **MISSING** | - | The repo has zero tests. |

## Module 3. Wallet Intelligence (/wallet)

PASS 5 | PARTIAL 12 | MISSING 17 | BLOCKED 1

| # | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 3.1-1 | Wallet address and chain verification | **PARTIAL** | app/api/wallet/route.ts (ADDRESS_RE); lib/arcExplorer.ts | Address format only; chain implied. |
| 3.1-2 | Native token, USDC and EURC balance | **PASS** | app/api/wallet/route.ts; live run on 0x4fd8... returned profile + 7 token balances; app/components/tabs/WalletTab.tsx highlights USDC/EURC | Native balance divides by 1e18, as the docs require. |
| 3.1-3 | Portfolio of supported tokens | **PARTIAL** | app/api/wallet/route.ts (token-balances) | Every token the Explorer lists, including spam, with no filtering. |
| 3.1-4 | Holdings value, only with a reliable price source | **BLOCKED** | - | No Circle or Arc price API is documented; the Explorer's token exchange_rate has undocumented provenance. Values are deliberately not shown. See section 9. |
| 3.1-5 | Recent transactions | **PASS** | app/api/wallet/route.ts; live run returned 20 transactions; WalletTab shows 10 | - |
| 3.1-6 | Total incoming and outgoing transfers | **MISSING** | - | - |
| 3.1-7 | Transaction success and failure statistics | **MISSING** | - | - |
| 3.1-8 | Balance and activity history | **MISSING** | - | No time series. |
| 3.2-1 | Transfer and contract interaction history | **PARTIAL** | app/api/wallet/route.ts | Last 20 transactions only; no type labels. |
| 3.2-2 | Token inflow and outflow | **MISSING** | - | - |
| 3.2-3 | USDC payment history | **PARTIAL** | app/api/payment-history/route.ts; app/components/tabs/CreditsTab.tsx | Exists for the signed-in wallet on /credits only, not on /wallet. |
| 3.2-4 | Contract approvals and allowance status | **MISSING** | - | Only detects unlimited approve() calls in the last 20 transactions. Allowances are never read. |
| 3.2-5 | NFT or other assets only with a reliable source | **MISSING** | - | Blockscout has an NFT endpoint and Alchemy/Zerion list Arc support; none are wired. |
| 3.2-6 | Filtering, search and pagination | **MISSING** | - | The Explorer returns next_page_params; unused. |
| 3.2-7 | CSV / export where safe | **MISSING** | - | Client-side export is feasible, see F10. |
| 3.3-1 | Natural-language wallet activity summary | **PASS** | app/api/wallet/route.ts; live run returned a summary | The model is given only counts, token balances and risk flags (not the transactions), so the summary is thinly grounded. |
| 3.3-2 | Spending and receiving patterns | **MISSING** | app/api/wallet/route.ts (prompt content) | The model never sees transactions, so it cannot analyse patterns. |
| 3.3-3 | USDC movement analysis | **MISSING** | - | Same cause as 3.3-2. |
| 3.3-4 | Repeated or unusual transaction detection | **MISSING** | - | - |
| 3.3-5 | Large approvals and risky interactions | **PARTIAL** | app/api/wallet/route.ts (computeRiskSignals) | Deterministic flags, not AI analysis. |
| 3.3-6 | Suspicious contract interaction warnings | **PARTIAL** | app/api/wallet/route.ts (newContract) | The flag means 'called any contract in the last 7 days', which is true for almost every active wallet. |
| 3.3-7 | Interface to ask questions about wallet activity | **MISSING** | - | - |
| 3.4-1 | Unlimited token approval detection | **PARTIAL** | app/api/wallet/route.ts (selector 095ea7b3 + max-uint suffix) | Scans only the last 20 transactions. Misses increaseAllowance, Permit/Permit2 and older approvals. Never exercised on a positive case. |
| 3.4-2 | Unknown or unverified contract interaction warnings | **MISSING** | - | Blockscout exposes verification status; unused. |
| 3.4-3 | Suspicious transfer patterns | **MISSING** | - | - |
| 3.4-4 | Repeated failed transactions | **MISSING** | - | - |
| 3.4-5 | High-value alerts with configurable thresholds | **PARTIAL** | app/api/wallet/route.ts (HIGH_VALUE_THRESHOLD) | Fixed 100 USDC threshold on native tx.value only. USDC ERC-20 payments have value 0 on the outer transaction, so most are missed. Not configurable. |
| 3.4-6 | Each risk signal carries evidence, rule and timestamp | **MISSING** | app/api/wallet/route.ts | Signals are bare booleans. |
| 3.4-7 | AI must not invent its own risk score | **PASS** | app/api/wallet/route.ts; live run | Signals are computed in code; the model only writes prose. |
| 3.5-1 | Never ask for a private key or seed phrase for read-only analysis | **PASS** | app/components/tabs/WalletTab.tsx (address input only); grep: no key/seed field anywhere in app/ | - |
| 3.5-2 | Show the purpose of wallet connection and signature | **PARTIAL** | lib/siwe.ts; app/api/session/route.ts; tests/session.test.ts | Sign-in is now EIP-4361 (domain, URI, Arc Mainnet chain ID, nonce, issued-at, expiry) and the statement says it authorises no payment. The wallet shows the message; the app adds no extra explanation. |
| 3.5-3 | No transaction sent without user approval | **PARTIAL** | app/components/tabs/HomeTab.tsx (purchase uses the wallet's own confirmation) | Code-read only. |
| 3.5-4 | State that wallet address and history are public on-chain data | **MISSING** | - | - |
| 3.5-5 | Verify API access, rate limiting, sensitive data handling | **PARTIAL** | lib/rateLimit.ts; lib/api.ts; tests/rateLimit.test.ts, tests/publicAiRoutes.test.ts | Rate limiting is now Redis-backed with per-minute and per-day caps (see 6-8). Sensitive-data handling is not separately audited. |
| 3.5-6 | Show stale or incomplete data when RPC/Explorer is unavailable | **PARTIAL** | app/api/wallet/route.ts | Returns a 502 error instead of partial or stale data. |

## Module 4. USDC Payment Infrastructure

PASS 2 | PARTIAL 26 | MISSING 25 | BLOCKED 0

| # | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 4.1-1 | createPayment | **MISSING** | app/components/tabs/HomeTab.tsx (client builds the transfer) | No server-side payment intent or quote. |
| 4.1-2 | verifyPayment | **PARTIAL** | app/api/credits/purchase/route.ts (verifyPurchase, not exported) | Inline in a route, not a shared service. No tests. |
| 4.1-3 | getPaymentReceipt | **MISSING** | - | - |
| 4.1-4 | getPaymentHistory | **PARTIAL** | app/api/payment-history/route.ts; live run: 19 USDC receipts for the test wallet | Reads the Explorer, not an internal ledger. |
| 4.1-5 | checkBalance | **PARTIAL** | app/api/credits/balance/route.ts; lib/credits.ts | Returns the credit balance. The USDC balance is read client-side. |
| 4.1-6 | getPaymentStatus | **MISSING** | - | - |
| 4.1-7 | handlePaymentFailure | **PARTIAL** | app/api/credits/purchase/route.ts (releaseTxHash on addCredit failure) | Only that one case. |
| 4.1-note | Follow codebase naming; no duplicate payment implementation | **PARTIAL** | lib/pricing.ts, lib/usedTx.ts, lib/credits.ts, purchase and payment-history routes, lib/statsScan.ts | Payment logic is spread across six files with no single interface. |
| 4.2-1 | Arc Mainnet chain ID and token contract verification | **PARTIAL** | app/api/credits/purchase/route.ts | Token contract is checked; the chain ID is never queried (fixed RPC). |
| 4.2-2 | Recipient, amount, sender and token validation | **PARTIAL** | app/api/credits/purchase/route.ts | All four are checked. No tests and no live payment run. It inspects only the first USDC Transfer log, so batched or multi-transfer transactions are rejected. |
| 4.2-3 | Transaction receipt status verification | **PARTIAL** | app/api/credits/purchase/route.ts (status 0x1) | Code-read only. |
| 4.2-4 | Confirmations / finality policy | **PARTIAL** | app/api/credits/purchase/route.ts | Accepts any included receipt. Arc finalises on inclusion (docs.arc.io evm-compatibility), but the policy is not written down in code. |
| 4.2-5 | ERC-20 Transfer event validation | **PARTIAL** | app/api/credits/purchase/route.ts (TRANSFER_TOPIC, log.address check) | Code-read only. |
| 4.2-6 | Duplicate transaction and replay prevention | **PARTIAL** | lib/usedTx.ts (SET NX, 1 h TTL) + 10-minute age cap | Sound design, not tested. Safety depends on the age cap being shorter than the claim TTL. |
| 4.2-7 | Idempotency key | **MISSING** | - | Purchases are naturally keyed by txHash. AI requests have no idempotency key. |
| 4.2-8 | Server-side payment verification | **PARTIAL** | app/api/credits/purchase/route.ts | Yes for purchases. |
| 4.2-9 | Do not trust the frontend's claimed payment status | **PARTIAL** | app/api/credits/purchase/route.ts (amount computed from lib/pricing.ts) | Code-read only. |
| 4.2-10 | Pending, confirmed, failed and expired states | **MISSING** | - | Binary accept/reject; no state model. |
| 4.3-1 | AI query pricing | **PARTIAL** | lib/pricing.ts (PRICE_PER_QUERY = 1000, i.e. 0.001 USDC) | One flat price. |
| 4.3-2 | Developer Copilot pricing | **PARTIAL** | app/api/copilot/route.ts (1 credit) | Same as a chat query; Continue is free. |
| 4.3-3 | Transaction analysis pricing | **MISSING** | app/api/debug-analyze/route.ts | Free and unauthenticated. |
| 4.3-4 | Wallet analysis pricing | **MISSING** | app/api/wallet/route.ts | Free and unauthenticated. |
| 4.3-5 | API and future agent service pricing | **MISSING** | - | - |
| 4.3-6 | Server-side price enforcement | **PARTIAL** | lib/pricing.ts; purchase route | Bundle price is server-enforced; per-service price is a flat 1 credit. |
| 4.3-7 | Price / version tracking | **MISSING** | - | - |
| 4.3-8 | Free and paid usage limits | **PASS** | app/api/{wallet,debug-analyze,ecosystem-search}/route.ts; tests/publicAiRoutes.test.ts; live run | Free AI lookups: 5-10/min and 40-60/day per caller plus a shared daily budget per route. Paid features spend credits. |
| 4.3-9 | Payment receipt and billing history for users | **PARTIAL** | app/components/tabs/CreditsTab.tsx; app/components/PaymentReceipt.tsx | On-chain transfers only. Credit spending is not recorded. |
| 4.4-1 | RPC errors and temporary network failures | **PARTIAL** | lib/arcRpc.ts; app/api/credits/purchase/route.ts; tests/arcRpc.test.ts (mocked fetch) | The payment RPC call now has a 6 s timeout and one retry. An RPC outage during verification still returns a 402 'Payment verification failed.' (purchase logic is Step 2). |
| 4.4-2 | Retry and idempotency | **PARTIAL** | lib/usedTx.ts | See 4.2-7. |
| 4.4-3 | Payment reconciliation | **MISSING** | - | - |
| 4.4-4 | On-chain vs internal record consistency | **MISSING** | lib/credits.ts | There is no internal purchase ledger, only a counter. |
| 4.4-5 | Secure backend API validation | **PARTIAL** | app/api/credits/purchase/route.ts | Input validated; session required. |
| 4.4-6 | Rate limiting and abuse prevention | **PASS** | lib/api.ts; lib/rateLimit.ts; purchase route (10/min per wallet); tests/rateLimit.test.ts; live run | Redis sliding window shared by all instances. |
| 4.4-7 | Payment audit logs | **MISSING** | - | Only console.error. |
| 4.4-8 | No double charge for the same logical request | **MISSING** | app/api/chat/route.ts, app/api/copilot/route.ts | Credit is spent before the AI call. No request id, so a client retry is charged again. |
| 4.4-9 | Refund policy / flow, only if supported and designed | **MISSING** | app/api/chat/route.ts | On AI failure the user gets an apology and no refund. |
| 4.4-10 | Secrets management and production config validation | **PARTIAL** | lib/api.ts (SESSION_SECRET misconfiguration -> logged 500); .github/workflows/ci.yml | Still no startup validation of every env var; the GITHUB_TOKEN in .env.local is still rejected by GitHub. |
| 4.5-1 | Documented internal payment API | **MISSING** | README.md | README still describes per-message on-chain signing. |
| 4.5-2 | Typed request/response schemas | **MISSING** | - | Ad hoc types per route. |
| 4.5-3 | Service-level pricing configuration | **PARTIAL** | lib/pricing.ts | Single constant. |
| 4.5-4 | Verified payment receipt | **MISSING** | - | - |
| 4.5-5 | Usage metering | **MISSING** | - | - |
| 4.5-6 | Agent spending limits / per-request authorisation interface | **MISSING** | - | - |
| 4.5-7 | Integration examples and automated tests | **MISSING** | - | No tests exist. |
| 4.6-1 | Successful, failed and pending payments | **MISSING** | - | Only successful on-chain transfers are visible. |
| 4.6-2 | Total USDC received | **PARTIAL** | app/api/stats/route.ts; lib/statsScan.ts (totalVolume) | Derived from receiver Transfer logs; code-read only. |
| 4.6-3 | Revenue by service | **MISSING** | - | - |
| 4.6-4 | Unique paying wallets | **PARTIAL** | lib/statsScan.ts (uniqueWallets) | - |
| 4.6-5 | Average payment amount | **MISSING** | - | - |
| 4.6-6 | Daily and weekly usage | **MISSING** | - | - |
| 4.6-7 | Explorer-linked transaction evidence | **PARTIAL** | app/components/tabs/StatsTab.tsx | Recent transfers are shown with hashes. |
| 4.6-8 | Reconcile internal metrics with on-chain totals | **MISSING** | - | No internal metrics to reconcile. |
| 4.6-note | Security rule: confirmation only from verified on-chain evidence | **PARTIAL** | app/api/credits/purchase/route.ts | Satisfied for credit purchases, not tested. |

## Module 5. Ecosystem Directory 2.0 (/ecosystem)

PASS 3 | PARTIAL 15 | MISSING 27 | BLOCKED 3

| # | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 5.1-1 | Project name, category and description | **PASS** | app/components/tabs/EcosystemTab.tsx (81 projects); SSR output checked | Hard-coded in a client component. |
| 5.1-2 | Official website and documentation | **PARTIAL** | EcosystemTab.tsx (url) | One link per project; no documentation field. |
| 5.1-3 | GitHub repository | **PARTIAL** | EcosystemTab.tsx (optional github field); app/components/tabs/BuildStatusTab.tsx (24 repos) | Field exists but is populated for 0 of 81 projects. |
| 5.1-4 | Verified social links | **MISSING** | - | - |
| 5.1-5 | Arc deployment / network support | **MISSING** | - | - |
| 5.1-6 | Contract addresses and explorer links | **PARTIAL** | EcosystemTab.tsx (optional contract field) | 0 of 81 populated. |
| 5.1-7 | USDC / EURC support | **PARTIAL** | EcosystemTab.tsx (optional usdcSupport) | 0 of 81 populated. |
| 5.1-8 | Circle integrations where verified | **BLOCKED** | - | No registry of verified Circle integrations exists; needs manual verification per project. See section 9. |
| 5.1-9 | API / SDK availability | **PARTIAL** | EcosystemTab.tsx (optional apiAvailable) | 0 of 81 populated. |
| 5.1-10 | AI agent / MCP compatibility where verified | **BLOCKED** | EcosystemTab.tsx (optional agentCompatible) | The optional field exists (0 of 81 populated) but no registry exists to verify agent/MCP compatibility. Arc's MCP server is docs search only. See section 9. |
| 5.1-11 | Project status and last-verified timestamp | **MISSING** | - | - |
| 5.2-1 | Full-text search | **PARTIAL** | EcosystemTab.tsx (substring on name, description, tags) | No ranking or fuzzy matching. |
| 5.2-2 | Category and feature filters | **PARTIAL** | EcosystemTab.tsx (category dropdown) | No feature filters. |
| 5.2-3 | Arc / USDC / Circle integration filters | **MISSING** | - | Underlying fields are empty. |
| 5.2-4 | Developer tools, wallets, DEX, bridges, infrastructure, agent categories | **PARTIAL** | EcosystemTab.tsx (12 categories (plus ALL) incl. AI & AGENTS, WALLETS, DEX & LIQUIDITY, BRIDGES, DEV TOOLS, INFRASTRUCTURE) | - |
| 5.2-5 | Related projects and integration suggestions | **MISSING** | - | - |
| 5.2-6 | Use-case-based discovery | **PARTIAL** | app/api/ecosystem-search/route.ts | Only through the AI search. |
| 5.2-7 | AI-powered natural-language search | **PARTIAL** | app/api/ecosystem-search/route.ts | The model is sent project names only (no descriptions or tags), so answers are weakly grounded. The client supplies the list. |
| 5.3-1 | Metadata validation against official website / GitHub | **MISSING** | - | - |
| 5.3-2 | Duplicate project detection | **MISSING** | - | - |
| 5.3-3 | Broken link checks | **MISSING** | - | Needs a scheduled job, see F9. |
| 5.3-4 | Archived or inactive repository detection | **PARTIAL** | app/api/github-status/route.ts; BuildStatusTab.tsx (Active/Slow/Inactive from pushed_at) | 24 repos only, based on last push. The archived flag is not read. Live-run verified. |
| 5.3-5 | Contract address and chain validation | **MISSING** | - | - |
| 5.3-6 | Data source attribution | **MISSING** | - | - |
| 5.3-7 | Last-checked timestamp | **MISSING** | - | - |
| 5.3-8 | Clear badge on unverified information | **MISSING** | - | - |
| 5.3-9 | Admin review and correction workflow | **MISSING** | - | COMMUNITY_ADMIN_KEY exists in env but is referenced by no code. |
| 5.4-1 | Project-to-project relationship mapping | **MISSING** | - | - |
| 5.4-2 | Supported integrations and dependencies | **MISSING** | - | - |
| 5.4-3 | Developer-ready integration guides | **MISSING** | - | - |
| 5.4-4 | 'Build this on Arc' project suggestions | **MISSING** | - | The Copilot could power this; not wired. |
| 5.4-5 | USDC-compatible project discovery | **MISSING** | - | Field unpopulated. |
| 5.4-6 | Documentation and SDK links | **PARTIAL** | app/components/tabs/HomeTab.tsx (DEV_RESOURCES) | Global links only, not per project. |
| 5.4-7 | Track ecosystem changes and newly discovered projects | **MISSING** | - | - |
| 5.5-1a | TVL from a trusted source | **PARTIAL** | lib/ecosystemEnrichment.ts; app/api/ecosystem-tvl/route.ts; live run: Aave $181.9M, Argus $1.20M; Morpho and Uniswap null | TVL only, for 5 hand-mapped DeFiLlama slugs (third-party, not an official Arc/Circle source). Shown without source or time (see 5.5-2). |
| 5.5-1b | Volume, users and transaction metrics from a trusted source | **BLOCKED** | - | No documented source for per-project volume, users or transactions on Arc. The data indexers listed on docs.arc.io are infrastructure, not datasets. See section 9. |
| 5.5-2 | Source and last-updated time for each metric | **MISSING** | EcosystemTab.tsx (formatTvl only) | UI shows the number without source or time. |
| 5.5-3 | Comparable metrics across projects | **MISSING** | - | - |
| 5.5-4 | Missing metrics are never shown as zero | **PASS** | app/api/ecosystem-tvl/route.ts (null values omitted); EcosystemTab.tsx renders an empty string; live run returned null for unmapped/absent | - |
| 5.5-5 | Keep sponsored placement and organic ranking separate | **PARTIAL** | EcosystemTab.tsx (featured flag) | No sponsored placement exists. The 'Featured' flag has no disclosure policy. |
| 5.5-6 | No fake TVL, user count or adoption numbers | **PASS** | lib/ecosystemEnrichment.ts (Arc-chain TVL only, null on failure); lib/statsScan.ts (on-chain only) | Verified by code read and a live run of the TVL helper. |
| 5.6-1 | Searchable API or structured data export | **MISSING** | - | Project data lives inside a client component. |
| 5.6-2 | Project submission form | **MISSING** | - | - |
| 5.6-3 | Project-owner update request | **MISSING** | - | - |
| 5.6-4 | Admin moderation | **MISSING** | - | - |
| 5.6-5 | Integration examples | **MISSING** | - | - |
| 5.6-6 | Developer onboarding links | **PARTIAL** | HomeTab.tsx (DEV_RESOURCES) | - |
| 5.6-7 | Ecosystem contribution tracking | **MISSING** | - | - |

## Module 6. Cross-System Requirements

PASS 7 | PARTIAL 12 | MISSING 4 | BLOCKED 0

| # | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 6-1 | Shared Arc network configuration | **PASS** | lib/arcConfig.ts; tests/arcAddresses.test.ts | Mainnet/Testnet chain IDs, RPC, explorer and native currency in one module, used by the Explorer client, RPC client, stats scan, AchSwap, purchase route, wallet modal and pages. Remaining literals are sample code inside lib/knowledge.ts text. |
| 6-2 | Verified contract / address registry | **PASS** | lib/arcAddresses.ts; tests/arcAddresses.test.ts (docs snapshot 2026-10-09) | Every address names its network and docs source URL. The knowledge base and both AI prompts are generated from it. Testnet-only entries are shown as 'Mainnet not published'. Open: the CREATE2 factory address in lib/knowledge.ts is not in the registry (not confirmed from the docs pages read). |
| 6-3 | Common RPC / Explorer client | **PASS** | lib/arcRpc.ts; lib/arcExplorer.ts; tests/arcRpc.test.ts (mocked fetch); live runs | One RPC client (timeout, one retry on network/429/5xx, no retry on JSON-RPC errors) and one Explorer client, both in use. |
| 6-4 | Typed API response schemas | **PARTIAL** | lib/schemas.ts; lib/api.ts | Request bodies and queries are zod-validated on all routes and errors have a typed body (ApiErrorBody). Success responses are plain TypeScript types, not schema-validated. |
| 6-5 | Shared error handling | **PASS** | lib/api.ts (withApi, ApiError); tests/api.test.ts; live run | Every route returns {error, code, requestId} on failure; unexpected errors are logged and hidden behind a generic 500. |
| 6-6 | Authentication and authorization | **PARTIAL** | lib/siwe.ts; lib/nonce.ts; lib/session.ts; tests/session.test.ts | Sign-in is now EIP-4361 with single-use Redis nonces. Still no roles/admin and no server-side session revocation. |
| 6-7 | Centralised structured logging | **PASS** | lib/logger.ts; tests/logger.test.ts | Structured JSON logs with request id and route, secrets redacted by key and wallet addresses masked. All server code uses it (the only remaining console calls are inside knowledge-base sample text). No log drain or alerting is configured. |
| 6-8 | Rate limiting | **PASS** | lib/rateLimit.ts; lib/api.ts; tests/rateLimit.test.ts (fake Redis) + live Upstash check; tests/session.test.ts | Redis sliding window on all 15 routes, keyed by wallet when signed in and by IP otherwise, 429 with Retry-After. Falls back to a per-instance window (logged) if Redis is down. |
| 6-9 | AI provider abstraction and fallback policy | **MISSING** | - | Groq SDK called directly in 5 routes. @ai-sdk/anthropic, ai and @google/genai are installed and unused. |
| 6-10 | Prompt-injection and untrusted-content protection | **PASS** | lib/untrusted.ts; lib/chatHistory.ts; tests/untrusted.test.ts, tests/promptInjection.test.ts | Chat history is validated (user/assistant only, 8 turns, 4000 chars); token symbols, Explorer fields and project text go into <untrusted_data> blocks with a data-not-instructions notice. Defence in depth, not a guarantee against every injection. |
| 6-11 | Secrets management | **PARTIAL** | - | No tracked secrets (secret scan clean). No rotation or validation. |
| 6-12 | Database schema validation / migrations | **PARTIAL** | - | No SQL database. Redis keys are defined ad hoc in code, with no validation. |
| 6-13 | Observability and actionable error reporting | **MISSING** | - | No Sentry/OTel or log drain config. |
| 6-14 | Unit, integration and end-to-end tests | **PARTIAL** | tests/ (101 tests in 13 files); vitest.config.mts; .github/workflows/ci.yml | Unit and mocked-integration tests (fake Redis, mocked fetch/Groq/cookies are labelled as mocks). No end-to-end tests and no payment-purchase tests yet (Step 2). |
| 6-15 | Accessibility and responsive UI | **PARTIAL** | app/components/tabs/* | aria labels on newer tabs. No audit or tooling. Responsive layout not re-verified in a browser. |
| 6-16 | API documentation | **MISSING** | README.md | README is outdated. |
| 6-17 | Production build verification | **PARTIAL** | .github/workflows/ci.yml; local `pnpm build` passes | CI (install, lint, typecheck, test, build) is defined but has not run on GitHub yet. |
| AI-1 | Use RPC / Explorer evidence, not the AI, for blockchain state | **PARTIAL** | app/api/debug-analyze/route.ts; app/api/wallet/route.ts | Data comes from the Explorer. The chat answers from a static knowledge base. |
| AI-2 | Do not invent Circle / Arc APIs or contract interfaces without checking docs | **PARTIAL** | lib/copilotPrompt.ts; lib/knowledge.ts; lib/arcAddresses.ts | Addresses are now generated from the verified registry. Open: knowledge.ts examples use the Circle Wallets blockchain id 'ARC-MAINNET', while developers.circle.com lists Arc as `ARC` / `ARC-TESTNET`; not changed because the SDK enum was not verified. |
| AI-3 | Show missing data, unsupported capability and uncertainty | **PARTIAL** | lib/copilotPrompt.ts rule 1 | Prompt-level only. |
| AI-4 | Source or evidence with each critical claim | **MISSING** | - | No citations in any AI output. |
| AI-5 | Never treat AI-generated code as automatically safe | **PARTIAL** | lib/copilotPrompt.ts | No explicit rule. |
| AI-6 | No absolute security guarantee even if the scan finds nothing | **PARTIAL** | lib/copilotPrompt.ts AUDIT disclaimer | AUDIT mode only. |

## 7. Security and payment-verification findings

Severity: **High** (loss of funds, money-for-nothing, or open cost abuse), **Medium**, **Low**.

| # | Sev | Finding | Evidence | Fix direction | Status after Step 1 |
|---|---|---|---|---|---|
| S1 | High | **Open LLM cost abuse.** `/api/debug-analyze`, `/api/wallet` and `/api/ecosystem-search` are unauthenticated and call Groq. `/api/ecosystem-search` also lets the caller supply up to 500 x 80 characters of "project names", i.e. a free general-purpose prompt channel. | routes above | Require a session or credit for AI calls, or a durable per-IP limit; build the project list server-side. | **Fixed (Step 1 D).** Still public by design; bounded by per-minute, per-day and shared daily caps. Ecosystem search no longer accepts client text. |
| S2 | High | **Rate limiting does not work on serverless.** `lib/rateLimit.ts` is an in-memory Map per instance (its own comment says it is not a security boundary). It is the only abuse control on every route. `/api/session/nonce` and `/api/credits/purchase` have none (20 of 20 nonce requests returned 200). | `lib/rateLimit.ts`; live probe | Redis-backed limiter (INCR + EXPIRE or `@upstash/ratelimit`). | **Fixed (Step 1 C).** Redis sliding window on every route; nonce endpoint limited. |
| S3 | High | **Prepaid credits silently expire.** Each purchase resets a 30-day Redis TTL (`lib/credits.ts`). A paying user who is idle for 30 days loses their whole balance, and no UI copy discloses it. | `lib/credits.ts:6,33` | Remove the TTL or disclose it clearly and refresh it on use. | **Fixed in code (Step 1 G).** New and touched balances never expire. Existing balances: dry run found 3 of 7 credit keys still expiring (261 credits, soonest in about 21 days); `scripts/persist-credits.ts --apply` not yet run, pending your approval. |
| S4 | High | **No purchase ledger, reconciliation or recovery.** Payments are only a Redis counter plus a one-hour tx-claim key. If a user pays and the request fails or is retried after 10 minutes (`MAX_TX_AGE_MS`), the payment is rejected as "too old" and there is no record, tool or flow to credit it. | `app/api/credits/purchase/route.ts`, `lib/usedTx.ts` | Persist a payment record (tx, wallet, amount, status) and add an admin or retry path. | Open (Step 2). |
| S5 | Medium | **Payment verification is untested and narrow.** It takes the first matching USDC Transfer log and demands an exact amount. A batched or multicall transaction with several transfers is rejected. The chain ID is never checked and the RPC call has no timeout or retry. | `app/api/credits/purchase/route.ts` | Scan all logs, add `eth_chainId`, timeout/retry, and tests. | Partly fixed: payment RPC now has a timeout and retry. Multi-log transactions, chain ID check and tests: Step 2. |
| S6 | Medium | **Charge-before-work with no refund or idempotency.** Chat and Copilot spend a credit before the AI call; on failure the user gets an apology, and a client retry is charged again. | `app/api/chat/route.ts`, `app/api/copilot/route.ts` | Request id + refund on AI failure. | Open (Step 2). |
| S7 | Medium | **Session sign-in is phishable.** The signed message has no domain, URI or chain ID (not EIP-4361), and `/api/session/nonce` is public. An attacker site can fetch a nonce for a victim's address and ask them to sign; the attacker then posts the signature and receives a session for that wallet. The nonce for an address can also be overwritten by anyone. | `lib/siwe.ts`, `app/api/session/*` | EIP-4361 with domain and chain binding; rate-limit nonce. | **Fixed (Step 1 B).** EIP-4361 with domain/URI/chain binding, single-use nonces keyed by nonce, rate limits. The standard SIWE caveat remains: wallets, not the server, must warn about a domain that differs from the site. |
| S8 | Medium | **Prompt injection and role injection.** `/api/chat` accepts client `history` entries with arbitrary roles (including `system`) and arbitrary length. Token symbols and news text are placed in prompts unescaped. | `app/api/chat/route.ts:102,146`; wallet and debug prompts | Validate roles/length server-side, keep history server-side, quote untrusted data. | **Fixed (Step 1 E).** History validated, untrusted content fenced. |
| S9 | Medium | **Wrong contract addresses served to users by the main chat AI.** `lib/knowledge.ts` lists the Testnet Gateway and USYC addresses under "MAINNET" and an unverifiable TokenMinterV2. (The CCTP TokenMessenger/MessageTransmitter errors were fixed in `cee1b6e`.) | `lib/knowledge.ts` (Gateway, USYC, TokenMinterV2) | Replace with the docs.arc.io values (Mainnet GatewayWallet `0x77777777Dcc4...00eE`, USYC `0x8a5D989B...F490`). | **Fixed (Step 1 F)** for addresses. Open: the `ARC-MAINNET` Circle Wallets identifier in knowledge samples (see AI-2). |
| S10 | Medium | **Wallet risk engine has logic gaps.** `highValueTx` looks only at native `tx.value`, so USDC ERC-20 payments (value 0) are never flagged; `newContract` fires for any contract call under seven days old. | `app/api/wallet/route.ts` | Use token-transfer values; define the rule properly. | Open. |
| S11 | Medium | **AI wallet summary is ungrounded.** The model is given counts and flags, not the transactions, so any pattern it describes is invented. | `app/api/wallet/route.ts` | Pass a summarised, verified transaction list. | Open. |
| S12 | Low | **Explorer access depends on a Cloudflare behaviour.** `explorer.arc.io/api/v2` serves a challenge unless a `Referer` header is sent. It is undocumented and could change. | `lib/arcExplorer.ts` | Move to an indexer from docs.arc.io/arc/tools/data-indexers or an Explorer API key if offered. | Open (Explorer client now centralised and logged, but still depends on the Referer behaviour). |
| S13 | Low | **No security headers or CSP**, no CI, no dependency audit; unused packages widen the attack surface. | `next.config.ts`, `package.json` | Add headers; remove unused dependencies. | Partly: CI added. Security headers and unused dependencies still open. |
| S14 | Low | **Sessions cannot be revoked server-side** (24 h token, logout only clears the cookie). | `lib/session.ts` | Add a session id with a Redis denylist. | Open. |
| S15 | Low | **Config drift.** `GITHUB_TOKEN` in `.env.local` is rejected by GitHub (401), `COMMUNITY_ADMIN_KEY` is unused, `UPSTASH_*` use non-null assertions. | `.env.local`, routes | Startup config validation. | Partly: `SESSION_SECRET` misconfiguration now logs and returns a clean 500; env validation and the invalid `GITHUB_TOKEN` still open. |

Checked and clean: no secrets or `.env` files in tracked files; the session cookie is `httpOnly`, `sameSite=lax`, `secure` in production; purchase verification derives the expected amount and sender server-side; the tx-claim uses an atomic `SET NX`.

## 8. Feasibility on Vercel serverless

Facts used: Vercel functions have no persistent filesystem, no installable binaries at runtime, a hard duration cap (the Copilot route sets `maxDuration = 60`), and no long-running processes. A full Copilot answer already takes 8 to 30 seconds.

| ID | Item | Verdict | Realistic option |
|---|---|---|---|
| F1 | Run Foundry/Hardhat tests, `tsc`, lint or user test suites (1.4-2, 1.5-3) | **Not possible as-is** | Separate sandbox/worker service (container or microVM) that checks out a workspace, runs the toolchain and streams logs back; jobs tracked in Redis. |
| F2 | Slither or other static analysers (1.2-7, 1.4-4) | **Not possible as-is** (Python + solc) | Same sandbox/worker. In-function alternative: solc-js plus LLM review, clearly labelled as not a scanner. |
| F3 | Compile-and-fix loop (1.4-1) | **Partly possible** | solc-js inside a function for single-file or bundled-import contracts with a bounded loop (3 tries). Multi-file projects and Foundry projects need the worker. |
| F4 | Deploying contracts for users (1.6) | **Not feasible and should not be done** server-side | Compile with solc-js, return ABI + bytecode, and have the **user's wallet sign the deployment** in the browser (Arc Testnet first). No keys on the server. |
| F5 | Preflight: `eth_call`, `eth_estimateGas`, balance and allowance reads (2.3-1, 2.3-2) | **Possible** | Plain RPC calls in a function. |
| F6 | Editing the user's existing repo, diffs and PRs (1.1-5, 1.5) | **Not feasible now** | Needs a GitHub App with scoped write access plus a sandbox. |
| F7 | State-aware simulation and traces (2.3-3) | **Blocked** | docs.arc.io documents only a local binary (`arc-anvil`); a worker could run it, but no hosted trace API is documented. |
| F8 | Long wallet-history analysis (3.2-6, 3.3) | **Possible with limits** | Paginate the Explorer or use an indexer from docs.arc.io/arc/tools/data-indexers; run in chunks under 60 s or via a queue. |
| F9 | Link checks, repo-activity refresh, ecosystem change tracking (5.3, 5.4-7) | **Possible** | Vercel Cron (none configured today) writing results to Redis. |
| F10 | CSV export (3.2-7) | **Possible** | Client-side generation. |
| F11 | Durable build/step status (1.1-6, 1.6-2) | **Possible** | Redis or a database; the Copilot already stores 15-minute continuation state. |

## 9. Data-source check (docs.arc.io, developers.circle.com)

| Need | Source today | Status |
|---|---|---|
| Chain data (blocks, receipts, logs) | Arc RPC `https://rpc.mainnet.arc.io` (docs.arc.io/arc/references/connect-to-arc). Alternates: Blockdaemon, dRPC, QuickNode, Alchemy. | Available |
| Addresses, tokens, transactions via API | Arc Explorer (Blockscout API v2) at `explorer.arc.io/api/v2`; works only with a `Referer` header (see S12). | Available, fragile |
| Contract addresses | docs.arc.io/arc/references/contract-addresses (USDC, EURC, USYC, CCTP, Gateway, Multicall3, Permit2, cirBTC, WETH, FxEscrow, Memo). | Available |
| Asset prices / holdings value | **No Circle or Arc price API** (the Circle docs index has none). The Explorer returns a token `exchange_rate`, but its provenance is undocumented. | **BLOCKED** |
| TVL | DeFiLlama (`api.llama.fi`), Arc-chain figure only, currently mapped for 5 protocols. Not an official Arc/Circle source. | Available (third party) |
| Volume, active users, per-project transactions | None documented. The listed data indexers (Alchemy, Envio, Goldsky, Pinax, The Graph, Thirdweb, Zerion) are infrastructure, not datasets. | **BLOCKED** |
| Circle Wallets API | Arc listed (`ARC` / `ARC-TESTNET`): developer- and user-controlled EOA + SCA, modular MSCA. Needs a Circle API key. Gas Station support for Arc is not stated. | Available (credential required) |
| CCTP | Arc is domain 26, addresses on docs.arc.io. | Available |
| Gateway | Arc is domain 26 for mainnet and testnet. Contract addresses from docs.arc.io. | Available |
| MCP data | Arc MCP server (`https://docs.arc.io/mcp`, no auth) exposes documentation search and page retrieval only. It has no on-chain, TVL, price or ecosystem data. | Docs only; **chain/ecosystem metrics BLOCKED** |
| Project registry for AI-agent / MCP compatibility, Circle integrations, social links | No registry. docs.arc.io has Arc Tools directory pages (account abstraction, compliance, data indexers, node providers, oracles) but not a full ecosystem list. | **BLOCKED** (manual curation required) |
| Contract verification status | Blockscout smart-contract endpoints are expected to expose it; not tested in this audit. | Likely available, unverified |
| Solidity compiler version for Arc | Not stated (only "targets the Osaka hard fork"). | **BLOCKED** |

## 10. Top gaps (status after Step 1)

Fixed in Step 1: items 2, 3 (code), 6, 7, 8. Still open: 1 (partly: 101 tests now, none for payments), 4, 5, 9, 10.

1. No automated tests anywhere (payments, verification, risk engine, debug).
2. In-memory rate limiting and open AI endpoints (S1, S2).
3. Credits expire after 30 days of inactivity with no disclosure (S3).
4. No payment ledger, reconciliation, or recovery for paid-but-uncredited users (S4, S5).
5. Charge-before-work with no refund or idempotency (S6).
6. Phishable sign-in message (S7).
7. Prompt and role injection (S8).
8. Wrong addresses in `lib/knowledge.ts` served by the chat AI (S9).
9. No build/test/deploy agent: the Copilot is a text generator only; no repo access, compiler, scanner or runner.
10. Ecosystem data is static and unverified: 81 hard-coded entries, structured fields empty, no submission, admin or verification workflow.

*This report was produced by reading the repository and running the live checks listed in section 0. Items I could not run are stated as not run.*
