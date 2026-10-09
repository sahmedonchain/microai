# MicroAI — Phase 1 Complete Technical Audit & Upgrade

## Global Instructions

প্রথমে পুরো repository audit করবে। বিদ্যমান কোড, architecture, API routes, database, AI models, smart contracts, wallet integration, payment flow, environment variables, tests এবং deployment configuration পরীক্ষা করবে।

**কোনো feature ইতিমধ্যে সম্পূর্ণ থাকলে পুনরায় তৈরি করবে না।** প্রতিটি feature-এর জন্য যাচাই করবে:

* UI আছে কি না
* Backend/API বাস্তবে কাজ করে কি না
* Blockchain integration live এবং সঠিক কি না
* Error handling ও security আছে কি না
* Automated tests আছে কি না
* Documentation ও deployment configuration আছে কি না

তারপর gap analysis তৈরি করে existing architecture বজায় রেখে বাস্তবায়ন করবে। Mock data, fake success, placeholder API, fabricated blockchain data অথবা unverified SDK/API ব্যবহার করবে না। কোনো feature বাস্তবায়ন সম্ভব না হলে সেটি স্পষ্টভাবে report করবে।

---

## 1. AI Developer Copilot — `/build`

**Goal:** User শুধু idea দেবে; MicroAI architecture তৈরি, code generation, integration, testing এবং deployment পর্যন্ত পরিচালনা করবে।

### 1.1 Idea-to-Application

* Natural language থেকে structured requirements তৈরি
* Requirements clarification এবং missing information detection
* Complete application architecture ও file structure generation
* Frontend, backend, database, API এবং smart contract generation
* Existing project structure অনুযায়ী code generation
* Multi-step build plan এবং implementation status tracking

### 1.2 Arc Smart Contract Engineering

* Arc-compatible Solidity contract generation
* USDC payment, subscription, escrow, marketplace, revenue sharing ও agent payment templates
* Access control, ownership, pausing এবং upgradeability—যেখানে প্রয়োজন
* Solidity version ও compiler configuration validation
* Contract interface, events, errors এবং access permissions generation
* Unit tests, integration tests ও edge-case tests generation
* Static analysis ও vulnerability scanning integration
* Deployment scripts এবং post-deployment verification

### 1.3 USDC & Circle Integration

* USDC transfer, approval ও payment verification code
* On-chain transaction receipt এবং event verification
* Circle Wallets API integration, যেখানে supported
* CCTP cross-chain transfer workflow
* Gateway integration, যেখানে supported
* API authentication, server-side secrets এবং environment configuration
* Retry, timeout, idempotency এবং failure recovery
* Circle/Arc official documentation থেকে verified integration patterns

প্রতিটি integration-এর আগে বর্তমান official documentation, supported network, SDK version, API endpoint এবং contract address যাচাই করবে। API বা SDK সম্পর্কে অনুমান করে code তৈরি করবে না।

### 1.4 Code Quality & Accuracy Engine

* Generated code compile না হওয়া পর্যন্ত সংশোধন
* TypeScript, lint, unit test এবং integration test চালানো
* Dependency ও version compatibility checking
* Static analysis এবং security checks
* Error থেকে root-cause diagnosis ও automatic fix attempts
* প্রতিটি generated code block-এর assumptions ও limitations দেখানো
* Documentation-সমর্থিত উত্তর এবং source references
* অনিশ্চিত তথ্যকে নিশ্চিত তথ্য হিসেবে না দেখানো
* Test না চালিয়ে "tested", "secure" বা "production-ready" দাবি না করা

### 1.5 Project Editing & Integration

* Existing project-এর file structure ও dependency analysis
* প্রয়োজনীয় ফাইল পরিবর্তন এবং নতুন ফাইল তৈরি
* Existing functionality regression checks
* Git diff এবং পরিবর্তনের summary
* Destructive change-এর আগে approval
* Secrets বা production configuration প্রকাশ না করা

### 1.6 Build, Test & Deploy Agent

* Requirements → Plan → Generate → Integrate → Test → Security Scan → Deploy
* প্রতিটি ধাপের status এবং logs
* Test failure হলে diagnosis ও bounded retry
* Deployment-এর আগে build, test এবং security gate
* Arc deployment configuration validation
* Deployment-এর আগে explicit user approval
* Production private key বা seed phrase কখনো AI-কে না দেওয়া
* Deployment-এর পরে contract address, transaction hash, receipt ও verification status
* Rollback/recovery guidance

**Important:** AI নিজে code লিখতে পারলেই project deploy করতে পারবে—এমন ধরে নেবে না। Repository write access, shell/test runner, RPC access, deployment credentials এবং অনুমোদিত deployment tools বাস্তবে আছে কি না যাচাই করবে।

---

## 2. Transaction Intelligence 2.0 — `/debug`

**Goal:** শুধু transaction ব্যাখ্যা নয়; transaction-এর প্রকৃত অবস্থা, সমস্যা, কারণ ও সম্ভাব্য সমাধান নির্ভরযোগ্যভাবে শনাক্ত করা।

### 2.1 On-chain Transaction Analysis

* Transaction hash validation
* Correct chain এবং network verification
* Transaction receipt ও execution status
* Block number, timestamp, sender, recipient, nonce ও gas details
* Input data এবং function selector decoding
* Contract ABI থাকলে function ও parameters decoding
* Logs/events parsing
* ERC-20 transfers এবং USDC/EURC movement detection
* Native token ও token balance changes
* Contract interaction timeline

### 2.2 Failure Diagnosis

* Revert reason ও decoded custom errors
* Insufficient balance বা allowance
* Wrong chain/address
* Gas estimation এবং out-of-gas issues
* Nonce, signature ও deadline issues
* Access control failures
* Slippage, invalid parameters ও contract logic failures
* RPC timeout, pending transaction এবং dropped transaction detection
* Root cause এবং supporting on-chain evidence

### 2.3 Simulation & Preflight

* Transaction পাঠানোর আগে balance ও allowance checks
* `eth_call` এবং gas estimation, যেখানে সমর্থিত
* Supported simulation engine থাকলে state-aware simulation
* Expected token movement ও সম্ভাব্য failure
* Simulation এবং actual execution-এর পার্থক্য স্পষ্ট করা
* Simulation সফল হলেও execution নিশ্চিত নয়—এই সতর্কতা দেখানো

### 2.4 AI Explanation & Fix

* সহজ ভাষায় transaction explanation
* Error-এর root cause
* Evidence-based confidence level
* Step-by-step fix
* Corrected transaction parameters বা code suggestion
* Related contract function ও documentation references
* Risky বা malicious contract interaction warning

### 2.5 Reliability

* Arc RPC ও Explorer API response validation
* RPC timeout, rate limits এবং retry handling
* Cached data-এর timestamp
* Missing ABI/data হলে স্পষ্ট limitation
* AI যেন on-chain evidence ছাড়া transaction result, revert reason বা token movement বানিয়ে না বলে
* Known transaction cases-এর automated regression tests

---

## 3. Wallet Intelligence Dashboard — `/wallet`

**Goal:** Wallet balance দেখানোর বাইরে সম্পূর্ণ on-chain activity, financial movement এবং evidence-based risk analysis প্রদান করা।

### 3.1 Wallet Overview

* Wallet address এবং chain verification
* Native token, USDC ও EURC balance
* Supported tokens-এর portfolio
* Token holdings ও value—শুধু নির্ভরযোগ্য price source থাকলে
* Recent transactions
* Total incoming/outgoing transfers
* Transaction success/failure statistics
* Balance এবং activity history

### 3.2 Transaction Intelligence

* Transfer ও contract interaction history
* Token inflow/outflow
* USDC payment history
* Contract approvals এবং allowance status
* NFT বা অন্যান্য asset support—শুধু নির্ভরযোগ্য data source থাকলে
* Transaction filtering, search এবং pagination
* CSV/export support, যেখানে নিরাপদ ও প্রয়োজনীয়

### 3.3 AI Wallet Analyst

* Wallet activity-এর natural-language summary
* Spending এবং receiving pattern
* USDC movement analysis
* Repeated বা unusual transaction detection
* Large approvals এবং potentially risky interactions
* Suspicious contract interaction warnings
* Wallet activity সম্পর্কে প্রশ্ন করার interface

### 3.4 Deterministic Risk Engine

* Unlimited token approval detection
* Unknown বা unverified contract interaction warnings
* Suspicious transfer patterns
* Repeated failed transactions
* High-value transfer alerts, configurable thresholds অনুযায়ী
* Risk signal-এর সঙ্গে evidence, rule এবং timestamp
* AI যেন একা arbitrary risk score তৈরি না করে

### 3.5 Security & Privacy

* Read-only wallet analysis-এর জন্য private key বা seed phrase কখনো চাইবে না
* Wallet connection এবং signature-এর purpose স্পষ্টভাবে দেখানো
* কোনো transaction user approval ছাড়া পাঠাবে না
* Wallet address ও history public on-chain data—এটি স্পষ্ট করা
* API access, rate limiting ও sensitive data handling যাচাই
* RPC/Explorer data unavailable হলে stale বা incomplete data দেখানো

---

## 4. USDC Payment Infrastructure

**Goal:** MicroAI-এর সব paid feature এবং ভবিষ্যৎ AI agents-এর জন্য reusable, verifiable, reliable payment layer তৈরি করা।

### 4.1 Unified Payment Engine

একটি shared payment service তৈরি বা বিদ্যমান service upgrade করবে, যাতে অন্তত নিচের capability থাকে:

* `createPayment`
* `verifyPayment`
* `getPaymentReceipt`
* `getPaymentHistory`
* `checkBalance`
* `getPaymentStatus`
* `handlePaymentFailure`

বর্তমান codebase-এর naming convention অনুযায়ী interface নির্ধারণ করবে; duplicate payment implementation তৈরি করবে না।

### 4.2 Payment Verification

* Arc Mainnet chain ID ও token contract verification
* Correct recipient, amount, sender এবং token validation
* Transaction receipt status verification
* Required confirmations/finality policy
* ERC-20 Transfer event validation
* Duplicate transaction এবং replay prevention
* Idempotency key
* Server-side payment verification
* Frontend-এর claimed payment status বিশ্বাস না করা
* Pending, confirmed, failed ও expired states

### 4.3 Pricing & Paid Services

* AI query pricing
* Developer Copilot service pricing
* Transaction analysis pricing
* Wallet analysis pricing
* API এবং future agent service pricing
* Server-side price enforcement
* Price/version tracking
* Free/paid usage limits
* Payment receipt এবং user-facing billing history

### 4.4 Reliability & Security

* RPC errors এবং temporary network failure handling
* Retry ও idempotency
* Payment reconciliation
* On-chain transaction বনাম internal payment records consistency
* Secure backend API validation
* Rate limiting এবং abuse prevention
* Payment audit logs
* No double charge for the same logical request
* Refund policy/flow—শুধু supported এবং explicitly designed হলে
* Secrets management এবং production configuration validation

### 4.5 Developer & Agent Payment API

* Documented internal payment API
* Typed request/response schema
* Service-level pricing configuration
* Verified payment receipt
* Usage metering
* Agent spending limits এবং per-request authorization-এর জন্য future-ready interface
* Payment integration examples এবং automated tests

### 4.6 Payment Analytics

* Successful/failed/pending payments
* Total USDC received
* Revenue by service
* Unique paying wallets
* Average payment amount
* Daily/weekly usage
* Explorer-linked transaction evidence
* Internal database metrics ও on-chain totals reconciliation

**Security rule:** Payment confirmation শুধু frontend response বা AI output থেকে গ্রহণ করা যাবে না। Backend-কে verified on-chain evidence অথবা trusted, authenticated payment provider result ব্যবহার করতে হবে।

---

## 5. Ecosystem Directory 2.0 — `/ecosystem`

**Goal:** Arc ecosystem-এর static project list নয়; verified, searchable, AI-queryable ecosystem intelligence platform তৈরি করা।

### 5.1 Structured Project Profiles

প্রতিটি project-এর জন্য:

* Project name, category এবং description
* Official website ও documentation
* GitHub repository
* Verified social links
* Arc deployment/network support
* Contract addresses ও explorer links
* USDC/EURC support
* Circle integrations, যেখানে verified
* API/SDK availability
* AI agent/MCP compatibility, যেখানে verified
* Project status এবং last-verified timestamp

### 5.2 Discovery & Search

* Full-text search
* Category ও feature filters
* Arc/USDC/Circle integration filters
* Developer tools, wallets, DEX, bridges, infrastructure ও agent categories
* Related projects এবং integration suggestions
* Use-case-based discovery
* AI-powered natural-language search

### 5.3 Verification & Data Quality

* Official website/GitHub থেকে metadata validation
* Duplicate project detection
* Broken link checks
* Archived বা inactive repository detection
* Contract address ও chain validation
* Data source attribution
* Last checked timestamp
* Unverified information-এ স্পষ্ট badge
* Admin review এবং correction workflow

### 5.4 Ecosystem Intelligence

* Project-to-project relationship mapping
* Supported integrations ও dependencies
* Developer-ready integration guides
* "Build this on Arc" project suggestions
* USDC-compatible project discovery
* Relevant documentation ও SDK links
* Ecosystem changes এবং newly discovered projects tracking

### 5.5 Metrics & Rankings

* TVL, volume, users ও transaction metrics—শুধু trusted source থাকলে
* Metric-এর source এবং last updated time
* Projects-এর comparable metrics
* Missing metrics-কে zero হিসেবে দেখানো যাবে না
* Sponsored placement ও organic ranking আলাদা রাখা
* Fake TVL, user count বা adoption statistics নিষিদ্ধ

### 5.6 Developer Experience

* Searchable API বা structured data export, যেখানে প্রয়োজন
* Project submission form
* Project owner update request
* Admin moderation
* Integration examples
* Developer onboarding links
* Ecosystem contribution tracking

---

## 6. Cross-System Requirements

সব পাঁচটি module-এর মধ্যে shared foundation তৈরি করবে:

* Shared Arc network configuration
* Verified contract/address registry
* Common RPC/Explorer client
* Typed API response schemas
* Shared error handling
* Authentication ও authorization
* Centralized structured logging
* Rate limiting
* AI provider abstraction এবং fallback policy
* Prompt injection ও untrusted content protection
* Secrets management
* Database schema validation/migrations, যদি database ব্যবহৃত হয়
* Observability ও actionable error reporting
* Unit, integration ও end-to-end tests
* Accessibility এবং responsive UI
* API documentation
* Production build verification

### AI Truthfulness Rules

* Blockchain state-এর জন্য AI-এর পরিবর্তে RPC/Explorer evidence ব্যবহার করবে।
* Official documentation যাচাই না করে Circle/Arc API বা contract interface উদ্ভাবন করবে না।
* Missing data, unsupported capability এবং uncertainty স্পষ্টভাবে দেখাবে।
* প্রতিটি critical claim-এর সঙ্গে source/evidence রাখবে।
* AI-generated code কখনো স্বয়ংক্রিয়ভাবে নিরাপদ বলে ধরে নেবে না।
* Security scan কোনো vulnerability না পেলেও absolute security guarantee দেবে না।

---

## 7. Execution Order

### Step 1 — Audit

সম্পূর্ণ repository ও প্রতিটি module পরীক্ষা করবে। Actual file paths, architecture, endpoints, data flow, dependencies, environment variables এবং existing tests নথিভুক্ত করবে।

### Step 2 — Gap Analysis

প্রতিটি requirement-কে তিনটি status দেবে:

* `PASS` — code ও tests দিয়ে verified
* `PARTIAL` — আংশিক বাস্তবায়িত বা যথেষ্ট test নেই
* `MISSING` — বাস্তবায়িত নয়

শুধু UI দেখে কোনো feature-কে PASS বলা যাবে না।

### Step 3 — Prioritized Implementation

Security-critical এবং shared infrastructure-এর সমস্যা আগে ঠিক করবে। তারপর পাঁচটি module-এর gap একে একে implement করবে। Existing working functionality ভাঙবে না।

### Step 4 — Verify

* TypeScript checks
* Lint
* Unit tests
* Integration tests
* Production build
* Payment verification tests
* Contract security tests
* Transaction analysis regression tests
* Wallet data correctness tests
* Ecosystem data validation tests

প্রকৃত integration সম্ভব না হলে mock-based test-কে live integration test হিসেবে report করবে না।

### Step 5 — Final Report

শেষে দেবে:

1. প্রতিটি module-এর PASS/PARTIAL/MISSING status
2. Changed files
3. নতুন feature
4. Security fixes
5. Test/build results
6. Remaining limitations
7. Required environment variables ও setup steps
8. Manual approval বা external credentials প্রয়োজন এমন deployment steps

**Do not stop after writing a plan.** Audit শেষ করে নিরাপদ, testable পরিবর্তনগুলো বাস্তবায়ন করবে। বড় বা destructive পরিবর্তনের আগে approval চাইবে। Production deployment বা on-chain transaction কখনো অনুমতি ছাড়া execute করবে না।
