# μ MicroAI — The Arc & Circle Intelligence Hub

> Pay-per-use AI chatbot, live ecosystem directory, grants tracker, transaction debugger, and real-time Arc network stats — all running on Arc Testnet, powered by USDC micropayments.

**Live:** https://microai-tan.vercel.app

---

## What is MicroAI?

MicroAI started as a simple pay-per-use AI chatbot on Arc Testnet. It has grown into a full knowledge and tooling hub for anyone building in the Arc + Circle ecosystem.

Every AI query costs **$0.001 USDC**, settled directly on-chain. No subscriptions, no accounts, no ETH needed.

---

## Pages

| Page | Description |
|------|-------------|
| `/` | Landing page with live demo widget |
| `/chat` | Pay-per-use AI chat — $0.001 USDC per query |
| `/ecosystem` | Directory of 44+ Arc + Circle projects |
| `/grants` | Live grants, hackathons, and bounties tracker |
| `/debug` | AI-powered transaction debugger (Arc Explorer API) |
| `/stats` | Live Arc network stats, wallet lookup, revenue counter |

---

## Features

### AI Chat (`/chat`)
- Ask any Arc or Circle question for $0.001 USDC
- Wallet signs USDC transfer on Arc Testnet before each response
- AI trained on Arc docs, Circle developer docs, CCTP, ERC-8004, ERC-8183
- Every answer comes with a verifiable on-chain TX proof
- Chat history saved locally across sessions
- Multi-wallet support: MetaMask, Coinbase Wallet, Trust Wallet, Brave

### Ecosystem Directory (`/ecosystem`)
- 44+ projects across 11 categories
- Real-time search and category filter
- Covers: AI Agents, Wallets, DEX, Bridges, Dev Tools, Payments, Stablecoins, Infrastructure, Lending, Institutions, Community Builds
- Community Spotlight: MicroAI featured alongside ecosystem partners

### Grants & Hackathons (`/grants`)
- Live tracker for all Arc + Circle grants, hackathons, and bounties
- Status badges: OPEN, LIVE NOW, UPCOMING, ENDED
- Filter by type: GRANT, HACKATHON, BOUNTY, EVENT
- Direct apply links with reward and deadline info

### Transaction Debugger (`/debug`)
- Paste any Arc testnet TX hash
- Fetches real data from Arc Explorer API
- AI analyzes root cause: insufficient USDC, wrong chain, gas limit, contract revert, invalid input, nonce issues
- Shows severity level (HIGH / MEDIUM / LOW) with fix instructions
- Direct link to Arc Explorer for full TX details

### Live Network Stats (`/stats`)
- **Block height, gas price, chain ID** — pulled from Arc RPC every 10 seconds
- **MicroAI revenue counter** — live USDC balance on receiver wallet
- **Transaction count** — total queries processed, from Arc Explorer
- **Wallet balance lookup** — paste any address, see USDC, EURC, and native gas balance live

---

## On-Chain Details

| Item | Value |
|------|-------|
| Network | Arc Testnet |
| Chain ID | 314573 (0x4cef52) |
| RPC | https://rpc.testnet.arc.network |
| Explorer | https://testnet.arcscan.app |
| USDC Contract | `0x3600000000000000000000000000000000000000` |
| EURC Contract | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |
| Payment Receiver | `0x9a318CD2BC533B5B2e96F7f5b499738732492b15` |
| ERC-8004 Agent ID | 69168 |
| ERC-8183 Job ID | 110278 |

---

## Circle Tools Used

- **USDC** — Native payment token and gas token on Arc Testnet
- **EURC** — Supported in wallet lookup and ecosystem directory
- **CCTP** — Documented in AI knowledge base (TokenMessengerV2, MessageTransmitterV2)
- **Arc Testnet** — All transactions settled on-chain, no ETH needed
- **Arc Explorer API** — Powers the transaction debugger and revenue counter
- **Arc RPC** — Powers live network stats and wallet balance lookup

---

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript
- **AI:** Groq (llama-3.3-70b-versatile)
- **Payments:** Direct ERC-20 USDC transfers via wallet (no third-party payment processor)
- **Chain data:** Arc RPC (JSON-RPC), Arc Explorer API (REST)
- **Deployment:** Vercel

---

## Architecture

```
User → Connect Wallet (Arc Testnet)
     → Ask Question
     → Wallet signs 0.001 USDC transfer on-chain
     → USDC settled on Arc (instant finality)
     → AI query sent to Groq with Arc+Circle knowledge base
     → Response returned with TX hash proof
     → User sees answer + verifiable TX link on arcscan
```

---

## Local Development

```bash
git clone https://github.com/sahmedonchain/microai.git
cd microai
pnpm install
pnpm approve-builds
```

Create `.env.local`:
```
GROQ_API_KEY=your_groq_api_key
```

```bash
pnpm dev
```

Open `http://localhost:3000` — connect MetaMask to Arc Testnet to test payments.

**Arc Testnet config for MetaMask:**
- Network Name: Arc Testnet
- RPC URL: https://rpc.testnet.arc.network
- Chain ID: 314573
- Currency Symbol: USDC
- Explorer: https://testnet.arcscan.app

Get testnet USDC: https://faucet.circle.com

---

## Builder

Built solo by **Sahmed Zayan** ([@sahmedonchain](https://x.com/sahmedonchain)) under the [BuildOrbit](https://github.com/sahmedonchain) brand.

Built for the **Arc Office Hours** submission and the **Stablecoin Commerce Stack Challenge** (Circle/Arc) — Track 4: Agentic Economy.

---

## Links

- **Live App:** https://microai-tan.vercel.app
- **GitHub:** https://github.com/sahmedonchain/microai
- **Arc Explorer (receiver wallet):** https://testnet.arcscan.app/address/0x9a318CD2BC533B5B2e96F7f5b499738732492b15
- **Arc Testnet Explorer:** https://testnet.arcscan.app
- **Circle Faucet:** https://faucet.circle.com
