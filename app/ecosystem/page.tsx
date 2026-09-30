"use client";
import { Navbar } from "@/app/components/Navbar";
import React, { useState, useEffect } from "react";
import Link from "next/link";

type Project = {
  name: string;
  desc: string;
  category: string;
  tags: string[];
  url: string;
  logo: string;
  logoColor: string;
  featured?: boolean;
};

const categories = [
  "ALL",
  "AI & AGENTS",
  "WALLETS",
  "DEX & LIQUIDITY",
  "BRIDGES",
  "DEV TOOLS",
  "PAYMENTS",
  "STABLECOINS",
  "INFRASTRUCTURE",
  "LENDING",
  "INSTITUTIONS",
  "EXCHANGES",
  "COMMUNITY BUILDS",
];

const projects: Project[] = [
  {
    name: "MicroAI",
    desc: "Pay-per-use AI chatbot dApp on Arc MAINNET. Ask any Arc or Circle question for $0.001 USDC. The Arc & Circle Intelligence Hub.",
    category: "COMMUNITY BUILDS",
    tags: ["AI", "Pay-per-use", "USDC", "Arc MAINNET"],
    url: "https://microai-tan.vercel.app",
    logo: "M",
    logoColor: "#10b981",
    featured: true,
  },
  {
    name: "Anthropic",
    desc: "Enriching the developer experience on Arc with Claude Code-powered builder tools and AI integrations.",
    category: "AI & AGENTS",
    tags: ["Claude", "Dev Tools", "AI"],
    url: "https://anthropic.com",
    logo: "A",
    logoColor: "#f59e0b",
  },
  {
    name: "Hibachi",
    desc: "Stablecoin FX exchange backed by the Arc Builders Fund (Circle Ventures). Offers perpetual trading across crypto and FX markets, USDC bridging/tracking, with spot FX coming soon.",
    category: "DEX & LIQUIDITY",
    tags: ["FX", "Perpetuals", "Circle Ventures", "Stablecoin"],
    url: "https://hibachi.xyz",
    logo: "H",
    logoColor: "#f97316",
  },
  {
    name: "Catena Labs",
    desc: "Building agentic AI infrastructure for on-chain payments and autonomous agent settlement on Arc.",
    category: "AI & AGENTS",
    tags: ["AI Agents", "Payments", "Agentic"],
    url: "https://catenalabs.com",
    logo: "C",
    logoColor: "#f59e0b",
  },
  {
    name: "MetaMask",
    desc: "The leading EVM browser wallet. Fully compatible with Arc MAINNET for connecting dApps and managing USDC.",
    category: "WALLETS",
    tags: ["EVM", "Browser Wallet", "USDC"],
    url: "https://metamask.io",
    logo: "MM",
    logoColor: "#f6851b",
  },
  {
    name: "Privy",
    desc: "Embedded wallet SDK for seamless onboarding. Lets users connect to Arc dApps without needing prior crypto experience.",
    category: "WALLETS",
    tags: ["Embedded Wallet", "SDK", "Onboarding"],
    url: "https://privy.io",
    logo: "P",
    logoColor: "#6366f1",
  },
  {
    name: "Rainbow",
    desc: "Mobile-first Ethereum wallet with Arc MAINNET support. Clean UX for retail users interacting with USDC on Arc.",
    category: "WALLETS",
    tags: ["Mobile", "Retail", "EVM"],
    url: "https://rainbow.me",
    logo: "R",
    logoColor: "#ec4899",
  },
  {
    name: "Fireblocks",
    desc: "Institutional-grade digital asset custody and wallet infrastructure. Enables enterprise USDC management on Arc.",
    category: "WALLETS",
    tags: ["Institutional", "Custody", "Enterprise"],
    url: "https://fireblocks.com",
    logo: "F",
    logoColor: "#3b82f6",
  },
  {
    name: "Ledger",
    desc: "Hardware wallet with Arc MAINNET integration for secure offline key management of USDC assets.",
    category: "WALLETS",
    tags: ["Hardware Wallet", "Security", "Cold Storage"],
    url: "https://ledger.com",
    logo: "L",
    logoColor: "#94a3b8",
  },
  {
    name: "Exodus",
    desc: "Multi-asset desktop and mobile wallet supporting Arc with a clean interface for managing stablecoins.",
    category: "WALLETS",
    tags: ["Multi-asset", "Desktop", "Mobile"],
    url: "https://exodus.com",
    logo: "E",
    logoColor: "#10b981",
  },
  {
    name: "Uniswap Labs",
    desc: "The leading decentralized exchange. Deploying on Arc to enable USDC-native swaps with deep liquidity.",
    category: "DEX & LIQUIDITY",
    tags: ["DEX", "AMM", "Liquidity Pools"],
    url: "https://uniswap.org",
    logo: "U",
    logoColor: "#ff007a",
  },
  {
    name: "Curve Finance",
    desc: "Stablecoin-optimized DEX providing efficient USDC liquidity pools and low-slippage swaps on Arc.",
    category: "DEX & LIQUIDITY",
    tags: ["Stablecoin DEX", "Liquidity", "Low Slippage"],
    url: "https://curve.fi",
    logo: "CV",
    logoColor: "#f59e0b",
  },
  {
    name: "Aerodrome / Velodrome",
    desc: "Dromos Labs-built ve(3,3) DEX infrastructure powering liquidity incentives on Arc.",
    category: "DEX & LIQUIDITY",
    tags: ["ve(3,3)", "Incentives", "Liquidity"],
    url: "https://aerodrome.finance",
    logo: "D",
    logoColor: "#3b82f6",
  },
  {
    name: "Fluid",
    desc: "Next-gen DEX and lending protocol combining liquidity and borrow/lend for capital-efficient USDC use on Arc.",
    category: "DEX & LIQUIDITY",
    tags: ["DEX", "Lending", "Capital Efficiency"],
    url: "https://fluid.cx",
    logo: "FL",
    logoColor: "#06b6d4",
  },
  {
    name: "Wormhole",
    desc: "Cross-chain messaging and token bridge connecting Arc to major blockchain networks including Ethereum and Solana.",
    category: "BRIDGES",
    tags: ["Cross-chain", "Messaging", "Bridge"],
    url: "https://wormhole.com",
    logo: "W",
    logoColor: "#9333ea",
  },
  {
    name: "LayerZero",
    desc: "Omnichain interoperability protocol enabling seamless USDC transfers between Arc and other chains.",
    category: "BRIDGES",
    tags: ["Omnichain", "Interop", "USDC"],
    url: "https://layerzero.network",
    logo: "LZ",
    logoColor: "#3b82f6",
  },
  {
    name: "Stargate",
    desc: "Liquidity bridge built on LayerZero. Enables unified USDC liquidity between Arc and other EVM chains.",
    category: "BRIDGES",
    tags: ["Liquidity Bridge", "LayerZero", "EVM"],
    url: "https://stargate.finance",
    logo: "SG",
    logoColor: "#06b6d4",
  },
  {
    name: "Across Protocol",
    desc: "Optimistic bridge using UMA's oracle. Fast, low-cost USDC bridging into and out of Arc.",
    category: "BRIDGES",
    tags: ["Optimistic", "Fast Bridge", "USDC"],
    url: "https://across.to",
    logo: "AC",
    logoColor: "#10b981",
  },
  {
    name: "Alchemy",
    desc: "Node infrastructure and developer platform. Powers Arc RPC endpoints and blockchain data for builders.",
    category: "DEV TOOLS",
    tags: ["RPC", "Node", "APIs"],
    url: "https://alchemy.com",
    logo: "AL",
    logoColor: "#3b82f6",
  },
  {
    name: "Chainlink",
    desc: "Decentralized oracle network providing price feeds, VRF, and automation for Arc smart contracts.",
    category: "DEV TOOLS",
    tags: ["Oracles", "Price Feeds", "VRF"],
    url: "https://chain.link",
    logo: "CL",
    logoColor: "#375bd2",
  },
  {
    name: "thirdweb",
    desc: "Full-stack Web3 development framework. SDKs, smart contract tools, and wallets — all Arc-compatible.",
    category: "DEV TOOLS",
    tags: ["SDK", "Smart Contracts", "Full-Stack"],
    url: "https://thirdweb.com",
    logo: "TW",
    logoColor: "#9333ea",
  },
  {
    name: "Tenderly",
    desc: "Smart contract monitoring, debugging, and simulation platform. Essential for Arc dApp development.",
    category: "DEV TOOLS",
    tags: ["Monitoring", "Debugging", "Simulation"],
    url: "https://tenderly.co",
    logo: "TD",
    logoColor: "#f59e0b",
  },
  {
    name: "QuickNode",
    desc: "High-performance blockchain infrastructure and RPC provider for Arc with global node coverage.",
    category: "DEV TOOLS",
    tags: ["RPC", "Infrastructure", "APIs"],
    url: "https://quicknode.com",
    logo: "QN",
    logoColor: "#3b82f6",
  },
  {
    name: "Pimlico",
    desc: "Account abstraction infrastructure for Arc. Enables gas sponsorship and smart wallet UX with USDC.",
    category: "DEV TOOLS",
    tags: ["Account Abstraction", "Paymaster", "ERC-4337"],
    url: "https://pimlico.io",
    logo: "PI",
    logoColor: "#ec4899",
  },
  {
    name: "Mastercard",
    desc: "Global payment network exploring Arc for stablecoin settlement rails and programmable payment flows.",
    category: "PAYMENTS",
    tags: ["Global Payments", "Settlement", "Enterprise"],
    url: "https://mastercard.com",
    logo: "MC",
    logoColor: "#eb001b",
  },
  {
    name: "Visa",
    desc: "Engaging with Arc for USDC-native payment settlement and cross-border transaction infrastructure.",
    category: "PAYMENTS",
    tags: ["Cross-border", "Settlement", "Enterprise"],
    url: "https://visa.com",
    logo: "V",
    logoColor: "#1a1f71",
  },
  {
    name: "Stripe (Tempo)",
    desc: "Building Tempo, a stablecoin payment layer, while integrating Arc infrastructure for global settlements.",
    category: "PAYMENTS",
    tags: ["Stablecoin Payments", "Global", "Fintech"],
    url: "https://stripe.com",
    logo: "ST",
    logoColor: "#635bff",
  },
  {
    name: "Yellow Card",
    desc: "Africa-focused crypto on/off ramp integrating Arc for local currency stablecoin access and remittances.",
    category: "PAYMENTS",
    tags: ["Africa", "Remittance", "On/Off Ramp"],
    url: "https://yellowcard.io",
    logo: "YC",
    logoColor: "#f59e0b",
  },
  {
    name: "USDC (Circle)",
    desc: "The native gas token and primary stablecoin of Arc. USDC powers every transaction on the network.",
    category: "STABLECOINS",
    tags: ["Native Gas", "Dollar-pegged", "CCTP"],
    url: "https://circle.com",
    logo: "UC",
    logoColor: "#2563eb",
  },
  {
    name: "EURC (Circle)",
    desc: "Euro-backed stablecoin from Circle. Supported as gas via paymaster on Arc for European use cases.",
    category: "STABLECOINS",
    tags: ["Euro", "Gas Paymaster", "EU"],
    url: "https://circle.com/eurc",
    logo: "EU",
    logoColor: "#2563eb",
  },
  {
    name: "MXNB (Juno/Bitso)",
    desc: "Mexican Peso stablecoin by Juno, a Bitso company. Expanding Latin American stablecoin access on Arc.",
    category: "STABLECOINS",
    tags: ["MXN", "LATAM", "Peso"],
    url: "https://bitso.com",
    logo: "MX",
    logoColor: "#10b981",
  },
  {
    name: "BRLA (Avenia)",
    desc: "Brazilian Real stablecoin on Arc MAINNET. Targeting Brazil's large digital payment market.",
    category: "STABLECOINS",
    tags: ["BRL", "Brazil", "Real"],
    url: "https://avenia.com.br",
    logo: "BR",
    logoColor: "#10b981",
  },
  {
    name: "Blockdaemon",
    desc: "Enterprise blockchain node infrastructure and staking. Running Arc validator and node infrastructure.",
    category: "INFRASTRUCTURE",
    tags: ["Nodes", "Validators", "Enterprise"],
    url: "https://blockdaemon.com",
    logo: "BD",
    logoColor: "#6366f1",
  },
  {
    name: "Cloudflare",
    desc: "Global CDN and network security powering Arc's infrastructure for low-latency global access.",
    category: "INFRASTRUCTURE",
    tags: ["CDN", "Security", "Performance"],
    url: "https://cloudflare.com",
    logo: "CF",
    logoColor: "#f38020",
  },
  {
    name: "AWS",
    desc: "Amazon Web Services providing cloud infrastructure backbone for Arc MAINNET and validator nodes.",
    category: "INFRASTRUCTURE",
    tags: ["Cloud", "Validators", "Infrastructure"],
    url: "https://aws.amazon.com",
    logo: "AW",
    logoColor: "#f59e0b",
  },
  {
    name: "Elliptic",
    desc: "Blockchain analytics and compliance tool for AML/KYT monitoring of USDC flows on Arc.",
    category: "INFRASTRUCTURE",
    tags: ["Compliance", "AML", "Analytics"],
    url: "https://elliptic.co",
    logo: "EL",
    logoColor: "#06b6d4",
  },
  {
    name: "Aave",
    desc: "Largest decentralized lending protocol. Aave V4 launches a new Arc-specific market (Arc Market) for USDC-native borrowing and lending.",
    category: "LENDING",
    tags: ["Lending", "Borrowing", "DeFi"],
    url: "https://aave.com",
    logo: "AA",
    logoColor: "#b6509e",
  },
  {
    name: "Morpho",
    desc: "Efficient lending protocol on Arc optimizing interest rates between lenders and borrowers with USDC, routed through Arc App Kits.",
    category: "LENDING",
    tags: ["Optimized Lending", "USDC", "DeFi"],
    url: "https://morpho.org",
    logo: "MO",
    logoColor: "#3b82f6",
  },
  {
    name: "Maple Finance",
    desc: "Institutional credit marketplace deploying on Arc for undercollateralized USDC lending to institutions.",
    category: "LENDING",
    tags: ["Credit", "Institutional", "Undercollateralized"],
    url: "https://maple.finance",
    logo: "MP",
    logoColor: "#10b981",
  },
  {
    name: "BlackRock",
    desc: "World's largest asset manager exploring tokenized funds and RWA issuance on Arc infrastructure.",
    category: "INSTITUTIONS",
    tags: ["RWA", "Asset Management", "Tokenization"],
    url: "https://blackrock.com",
    logo: "BK",
    logoColor: "#64748b",
  },
  {
    name: "Goldman Sachs",
    desc: "Tier-1 investment bank experimenting with Arc for on-chain capital markets and settlement.",
    category: "INSTITUTIONS",
    tags: ["Capital Markets", "Settlement", "TradFi"],
    url: "https://goldmansachs.com",
    logo: "GS",
    logoColor: "#64748b",
  },
  {
    name: "Coinbase",
    desc: "Leading crypto exchange providing CEX liquidity and on/off ramp access for the Arc ecosystem.",
    category: "INSTITUTIONS",
    tags: ["CEX", "On/Off Ramp", "Liquidity"],
    url: "https://coinbase.com",
    logo: "CB",
    logoColor: "#2563eb",
  },
  {
    name: "Pulsar",
    desc: "Consumer stablecoin money app building on Arc. Designed around USDC and EURC balances, payments, card activity, FX, and multi-currency flows. Brings stablecoin finance to everyday users.",
    category: "PAYMENTS",
    tags: ["Consumer", "USDC", "EURC", "FX", "Card"],
    url: "https://community.arc.io/public/clubs/arc-ecosystem/blog/arc-x-pulsar-consumer-stablecoin-money-movement-on-arc",
    logo: "PL",
    logoColor: "#10b981",
  },
  {
    name: "Canteen",
    desc: "Builder platform and hackathon organizer on Arc. Runs Agora and Lepton Agents hackathons — AI agents that pay, receive, and orchestrate USDC nanopayments on Arc.",
    category: "AI & AGENTS",
    tags: ["Hackathons", "AI Agents", "Nanopayments", "Community"],
    url: "https://thecanteenapp.com",
    logo: "CT",
    logoColor: "#f59e0b",
  },
  {
    name: "Intuit",
    desc: "Major financial software company (QuickBooks, TurboTax) exploring Arc for programmable payments and financial automation for small businesses.",
    category: "INSTITUTIONS",
    tags: ["Fintech", "SMB", "Payments", "Automation"],
    url: "https://intuit.com",
    logo: "IN",
    logoColor: "#0077c5",
  },
  {
    name: "AchSwap",
    desc: "DEX and trading platform live on Arc MAINNET for USDC-native swaps.",
    category: "DEX & LIQUIDITY",
    tags: ["DEX", "Trading", "Arc MAINNET"],
    url: "https://trade.achswap.app/",
    logo: "AS",
    logoColor: "#22c55e",
  },
  {
    name: "aka.fun",
    desc: "Trading platform on Arc charging a 2% fee, with 30% funneled into an RWA treasury.",
    category: "DEX & LIQUIDITY",
    tags: ["Trading", "RWA Treasury"],
    url: "https://arc.io/ecosystem",
    logo: "AK",
    logoColor: "#f472b6",
  },
  {
    name: "UnitFlow",
    desc: "DeFi liquidity layer on Arc running three AMM architectures with cross-chain USDC via Circle infrastructure.",
    category: "DEX & LIQUIDITY",
    tags: ["DeFi", "AMM", "Cross-chain USDC"],
    url: "https://arc.io/ecosystem",
    logo: "UF",
    logoColor: "#38bdf8",
  },
  {
    name: "Synthra",
    desc: "DeFi protocol deploying on Arc MAINNET.",
    category: "DEX & LIQUIDITY",
    tags: ["DeFi"],
    url: "https://arc.io/ecosystem",
    logo: "SY",
    logoColor: "#a3e635",
  },
  {
    name: "Tower",
    desc: "DEX aggregator routing trades across Arc liquidity pools, with AI portfolio features planned.",
    category: "DEX & LIQUIDITY",
    tags: ["DEX Aggregator", "AI"],
    url: "https://arc.io/ecosystem",
    logo: "TO",
    logoColor: "#fbbf24",
  },
  {
    name: "Sidoor",
    desc: "DeFi protocol deploying on Arc MAINNET.",
    category: "DEX & LIQUIDITY",
    tags: ["DeFi"],
    url: "https://arc.io/ecosystem",
    logo: "SD",
    logoColor: "#f87171",
  },
  {
    name: "Phantom",
    desc: "Multi-chain wallet supporting Arc MAINNET for USDC and EVM assets.",
    category: "WALLETS",
    tags: ["Multi-chain", "EVM"],
    url: "https://phantom.app",
    logo: "PH",
    logoColor: "#ab9ff2",
  },
  {
    name: "Trust Wallet",
    desc: "Mobile-first crypto wallet with Arc MAINNET support for USDC.",
    category: "WALLETS",
    tags: ["Mobile", "EVM"],
    url: "https://trustwallet.com",
    logo: "TR",
    logoColor: "#3375bb",
  },
  {
    name: "Bitget Wallet",
    desc: "Multi-chain wallet integrated with Arc MAINNET.",
    category: "WALLETS",
    tags: ["Multi-chain"],
    url: "https://web3.bitget.com",
    logo: "BG",
    logoColor: "#00f0ff",
  },
  {
    name: "OKX Wallet",
    desc: "Web3 wallet from OKX with Arc MAINNET connectivity.",
    category: "WALLETS",
    tags: ["Web3", "Multi-chain"],
    url: "https://www.okx.com/web3",
    logo: "OK",
    logoColor: "#94a3b8",
  },
  {
    name: "Binance Wallet",
    desc: "Native Web3 wallet inside the Binance app, compatible with Arc MAINNET.",
    category: "WALLETS",
    tags: ["Exchange Wallet"],
    url: "https://www.binance.com/en/web3wallet",
    logo: "BN",
    logoColor: "#f0b90b",
  },
  {
    name: "Gate Web3",
    desc: "Web3 wallet from Gate supporting Arc MAINNET.",
    category: "WALLETS",
    tags: ["Web3"],
    url: "https://www.gate.io/web3",
    logo: "GT",
    logoColor: "#17e6a1",
  },
  {
    name: "Kucoin Web3",
    desc: "Web3 wallet from KuCoin supporting Arc MAINNET.",
    category: "WALLETS",
    tags: ["Web3"],
    url: "https://www.kucoin.com/web3",
    logo: "KC",
    logoColor: "#24ae8f",
  },
  {
    name: "Figment",
    desc: "Staking and node infrastructure provider supporting Arc validators.",
    category: "INFRASTRUCTURE",
    tags: ["Staking", "Nodes"],
    url: "https://figment.io",
    logo: "FI",
    logoColor: "#7c3aed",
  },
  {
    name: "Kaleido",
    desc: "Enterprise blockchain platform offering Arc node and API infrastructure.",
    category: "INFRASTRUCTURE",
    tags: ["Enterprise", "APIs"],
    url: "https://kaleido.io",
    logo: "KA",
    logoColor: "#f59e0b",
  },
  {
    name: "Goldsky",
    desc: "Real-time blockchain data indexing and subgraphs for Arc.",
    category: "DEV TOOLS",
    tags: ["Indexing", "Subgraphs"],
    url: "https://goldsky.com",
    logo: "GO",
    logoColor: "#facc15",
  },
  {
    name: "Blockscout",
    desc: "Open-source block explorer supporting Arc MAINNET.",
    category: "DEV TOOLS",
    tags: ["Explorer", "Open-source"],
    url: "https://blockscout.com",
    logo: "BS",
    logoColor: "#3b82f6",
  },
  {
    name: "Kite AI",
    desc: "AI agent infrastructure building on Arc for autonomous, agent-initiated payments.",
    category: "AI & AGENTS",
    tags: ["AI Agents", "Payments"],
    url: "https://arc.io/ecosystem",
    logo: "KT",
    logoColor: "#f59e0b",
  },
  {
    name: "Virtuals",
    desc: "AI agent tokenization platform expanding to Arc MAINNET.",
    category: "AI & AGENTS",
    tags: ["AI Agents", "Tokenization"],
    url: "https://arc.io/ecosystem",
    logo: "VI",
    logoColor: "#a78bfa",
  },
  {
    name: "Architect",
    desc: "AI agent protocol building on Arc MAINNET.",
    category: "AI & AGENTS",
    tags: ["AI Agents"],
    url: "https://arc.io/ecosystem",
    logo: "AH",
    logoColor: "#fb7185",
  },
  {
    name: "Arrays",
    desc: "AI agent protocol building on Arc MAINNET.",
    category: "AI & AGENTS",
    tags: ["AI Agents"],
    url: "https://arc.io/ecosystem",
    logo: "AY",
    logoColor: "#34d399",
  },
  {
    name: "Ornn",
    desc: "AI agent protocol building on Arc MAINNET.",
    category: "AI & AGENTS",
    tags: ["AI Agents"],
    url: "https://arc.io/ecosystem",
    logo: "OR",
    logoColor: "#60a5fa",
  },
  {
    name: "BlockRun",
    desc: "AI agent protocol building on Arc MAINNET.",
    category: "AI & AGENTS",
    tags: ["AI Agents"],
    url: "https://arc.io/ecosystem",
    logo: "BU",
    logoColor: "#f472b6",
  },
  {
    name: "Alethieum",
    desc: "AI agent protocol building on Arc MAINNET.",
    category: "AI & AGENTS",
    tags: ["AI Agents"],
    url: "https://arc.io/ecosystem",
    logo: "AE",
    logoColor: "#c084fc",
  },
  {
    name: "Orthogonal",
    desc: "AI agent protocol building on Arc MAINNET.",
    category: "AI & AGENTS",
    tags: ["AI Agents"],
    url: "https://arc.io/ecosystem",
    logo: "OG",
    logoColor: "#38bdf8",
  },
  {
    name: "Binance",
    desc: "Global crypto exchange providing onramp access to Arc MAINNET.",
    category: "EXCHANGES",
    tags: ["Onramp", "CEX"],
    url: "https://binance.com",
    logo: "BI",
    logoColor: "#f0b90b",
  },
  {
    name: "Kraken",
    desc: "Crypto exchange offering onramp access to Arc MAINNET.",
    category: "EXCHANGES",
    tags: ["Onramp", "CEX"],
    url: "https://kraken.com",
    logo: "KR",
    logoColor: "#5741d9",
  },
  {
    name: "Bybit",
    desc: "Crypto exchange offering onramp access to Arc MAINNET.",
    category: "EXCHANGES",
    tags: ["Onramp", "CEX"],
    url: "https://bybit.com",
    logo: "BY",
    logoColor: "#f7a600",
  },
  {
    name: "OKX",
    desc: "Crypto exchange offering onramp access to Arc MAINNET.",
    category: "EXCHANGES",
    tags: ["Onramp", "CEX"],
    url: "https://okx.com",
    logo: "OX",
    logoColor: "#94a3b8",
  },
  {
    name: "KuCoin",
    desc: "Crypto exchange offering onramp access to Arc MAINNET.",
    category: "EXCHANGES",
    tags: ["Onramp", "CEX"],
    url: "https://kucoin.com",
    logo: "KU",
    logoColor: "#24ae8f",
  },
  {
    name: "Bitvavo",
    desc: "European crypto exchange offering onramp access to Arc MAINNET.",
    category: "EXCHANGES",
    tags: ["Onramp", "CEX"],
    url: "https://bitvavo.com",
    logo: "BV",
    logoColor: "#1a56db",
  },
  {
    name: "Gate",
    desc: "Crypto exchange offering onramp access to Arc MAINNET.",
    category: "EXCHANGES",
    tags: ["Onramp", "CEX"],
    url: "https://gate.io",
    logo: "GA",
    logoColor: "#17e6a1",
  },
  {
    name: "MEXC",
    desc: "Crypto exchange offering onramp access to Arc MAINNET.",
    category: "EXCHANGES",
    tags: ["Onramp", "CEX"],
    url: "https://mexc.com",
    logo: "ME",
    logoColor: "#00b8d9",
  },
  {
    name: "OSL",
    desc: "Licensed digital asset exchange offering onramp access to Arc MAINNET.",
    category: "EXCHANGES",
    tags: ["Onramp", "Licensed"],
    url: "https://osl.com",
    logo: "OS",
    logoColor: "#0ea5e9",
  },
  {
    name: "Upbit",
    desc: "Korean crypto exchange offering onramp access to Arc MAINNET.",
    category: "EXCHANGES",
    tags: ["Onramp", "CEX"],
    url: "https://upbit.com",
    logo: "UP",
    logoColor: "#0f3cde",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  "AI & AGENTS": "#f59e0b",
  "WALLETS": "#6366f1",
  "DEX & LIQUIDITY": "#ec4899",
  "BRIDGES": "#9333ea",
  "DEV TOOLS": "#3b82f6",
  "PAYMENTS": "#10b981",
  "STABLECOINS": "#2563eb",
  "INFRASTRUCTURE": "#64748b",
  "LENDING": "#b6509e",
  "INSTITUTIONS": "#94a3b8",
  "EXCHANGES": "#fbbf24",
  "COMMUNITY BUILDS": "#34d399",
};

export default function EcosystemPage() {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [tvlByProject, setTvlByProject] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ecosystem-tvl")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.tvl) setTvlByProject(data.tvl);
      })
      .catch(() => { /* enrichment is optional — cards render fine without it */ });
    return () => { cancelled = true; };
  }, []);

  const filtered = projects.filter((p) => {
    const matchCat = filter === "ALL" || p.category === filter;
    const matchSearch =
      search === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.desc.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  const featured = filtered.filter((p) => p.featured);
  const rest = filtered.filter((p) => !p.featured);

  return (
    <div style={{ minHeight: "100vh", background: "#010503", color: "#e2e8f0", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Navbar />

      {/* HERO */}
      <section style={{ padding: "48px 20px 36px", textAlign: "center", borderBottom: "1px solid rgba(16,185,129,0.06)" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 20, border: "1px solid rgba(16,185,129,0.15)", background: "rgba(3,17,10,0.6)", marginBottom: 20 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", display: "inline-block", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 9, color: "#34d399", fontWeight: 700, letterSpacing: "0.15em", fontFamily: "monospace" }}>LIVE ECOSYSTEM MAP</span>
        </div>
        <h1 style={{ fontSize: "clamp(1.6rem, 6vw, 3.5rem)", fontWeight: 900, lineHeight: 1.1, margin: "0 0 14px", background: "linear-gradient(180deg, #fff 0%, rgba(148,163,184,0.5) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.02em" }}>
          Arc & Circle<br />Ecosystem Directory
        </h1>
        <p style={{ fontSize: "clamp(12px, 3vw, 14px)", color: "#94a3b8", maxWidth: 480, margin: "0 auto 28px", lineHeight: 1.7 }}>
          Every project, protocol, and builder in the Arc + Circle ecosystem — from community dApps to institutional partners.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
          {[
            { label: "PROJECTS", value: projects.length.toString() },
            { label: "CATEGORIES", value: (categories.length - 1).toString() },
            { label: "COMMUNITY BUILDS", value: projects.filter(p => p.category === "COMMUNITY BUILDS").length.toString() },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "clamp(1.4rem, 5vw, 2rem)", fontWeight: 900, color: "#34d399", fontFamily: "monospace" }}>{s.value}</div>
              <div style={{ fontSize: 9, color: "#475569", fontWeight: 700, letterSpacing: "0.15em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SEARCH + FILTERS */}
      <section style={{ padding: "24px 16px 0", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ position: "relative", marginBottom: 16 }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#475569", fontFamily: "monospace" }}>⌕</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects, tags, categories..."
            style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(16,185,129,0.12)", borderRadius: 10, padding: "10px 14px 10px 32px", fontSize: 12, color: "#fff", outline: "none", fontFamily: "monospace", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
          {categories.map((cat) => {
            const color = CATEGORY_COLORS[cat] ?? "#34d399";
            const active = filter === cat;
            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  border: active ? `1px solid ${color}60` : "1px solid rgba(16,185,129,0.08)",
                  background: active ? `${color}15` : "rgba(0,0,0,0.2)",
                  color: active ? color : "#64748b",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  fontFamily: "monospace",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 12, fontSize: 10, color: "#475569", fontFamily: "monospace" }}>
          {filtered.length} PROJECT{filtered.length !== 1 ? "S" : ""}
          {search && ` FOR "${search.toUpperCase()}"`}
        </div>
      </section>

      {/* FEATURED */}
      {featured.length > 0 && (
        <section style={{ padding: "20px 16px 0", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontSize: 9, color: "#34d399", fontWeight: 700, letterSpacing: "0.2em", fontFamily: "monospace", marginBottom: 12 }}>
            COMMUNITY SPOTLIGHT
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            {featured.map((p) => (
              <ProjectCard key={p.name} project={p} highlight tvl={tvlByProject[p.name]} />
            ))}
          </div>
        </section>
      )}

      {/* MAIN GRID */}
      <section style={{ padding: "20px 16px 60px", maxWidth: 1100, margin: "0 auto" }}>
        {featured.length > 0 && rest.length > 0 && (
          <div style={{ fontSize: 9, color: "#475569", fontWeight: 700, letterSpacing: "0.2em", fontFamily: "monospace", marginBottom: 12 }}>
            ALL PROJECTS
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {rest.map((p) => (
            <ProjectCard key={p.name} project={p} tvl={tvlByProject[p.name]} />
          ))}
        </div>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#475569", fontFamily: "monospace", fontSize: 12 }}>
            NO RESULTS FOR "{search.toUpperCase()}"
          </div>
        )}
      </section>

      {/* CTA */}
      <section style={{ borderTop: "1px solid rgba(16,185,129,0.06)", padding: "40px 16px", textAlign: "center", background: "rgba(2,11,6,0.4)" }}>
        <div style={{ fontSize: 9, color: "#34d399", fontWeight: 700, letterSpacing: "0.25em", fontFamily: "monospace", marginBottom: 12 }}>WANT TO KNOW MORE ABOUT ANY PROJECT?</div>
        <h2 style={{ fontSize: "clamp(1.2rem, 4vw, 2rem)", fontWeight: 900, color: "#fff", margin: "0 0 12px" }}>Ask MicroAI</h2>
        <p style={{ fontSize: 13, color: "#64748b", maxWidth: 400, margin: "0 auto 24px", lineHeight: 1.65 }}>
          Get instant answers about any Arc or Circle ecosystem project for just $0.001 USDC.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/chat" style={{ display: "inline-block", padding: "12px 28px", borderRadius: 12, background: "#10b981", color: "#000", fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", textDecoration: "none", boxShadow: "0 0 18px rgba(16,185,129,0.2)" }}>
            LAUNCH CHAT TERMINAL →
          </Link>
          <Link href="/grants" style={{ display: "inline-block", padding: "12px 28px", borderRadius: 12, border: "1px solid rgba(52,211,153,0.2)", background: "rgba(16,185,129,0.05)", color: "#34d399", fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textDecoration: "none" }}>
            VIEW GRANTS →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(16,185,129,0.08)", background: "#010402", padding: "24px 16px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#34d399" }}>M</div>
            <div style={{ fontSize: 10, color: "#475569" }}>MICROAI · THE ARC & CIRCLE HUB</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {[{ l: "ARC", h: "https://arc.io" }, { l: "CIRCLE", h: "https://circle.com" }, { l: "GITHUB", h: "https://github.com/sahmedonchain/microai" }, { l: "EXPLORER", h: "https://explorer.arc.io" }].map((link) => (
              <a key={link.l} href={link.h} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: "0.1em", fontFamily: "monospace", textDecoration: "none" }}>{link.l}</a>
            ))}
          </div>
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        html { scroll-behavior: smooth; }
        html, body { background: #010503; margin: 0; overflow-x: hidden; scrollbar-width: none; }
        ::-webkit-scrollbar { display: none; }
        * { box-sizing: border-box; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        input::placeholder { color: #475569; }
      `}</style>
    </div>
  );
}

function formatTvl(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(2)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
}

function ProjectCard({ project: p, highlight, tvl }: { project: Project; highlight?: boolean; tvl?: number }) {
  const catColor = CATEGORY_COLORS[p.category] ?? "#34d399";
  return (
    <div style={{
      background: highlight ? "rgba(3,22,13,0.4)" : "rgba(3,17,10,0.2)",
      border: highlight ? "1px solid rgba(52,211,153,0.15)" : "1px solid rgba(16,185,129,0.07)",
      borderRadius: 14,
      padding: "18px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      position: "relative",
      overflow: "hidden",
    }}>
      {highlight && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(52,211,153,0.3), transparent)" }} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${p.logoColor}18`, border: `1px solid ${p.logoColor}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: p.logoColor, flexShrink: 0, fontFamily: "monospace" }}>
          {p.logo}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>{p.name}</div>
          <span style={{ fontSize: 8, fontWeight: 700, color: catColor, background: `${catColor}15`, border: `1px solid ${catColor}25`, padding: "1px 7px", borderRadius: 4, fontFamily: "monospace", letterSpacing: "0.08em" }}>
            {p.category}
          </span>
        </div>
      </div>
      <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.65, margin: 0, flex: 1 }}>{p.desc}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {p.tags.map((t) => (
          <span key={t} style={{ fontSize: 9, color: "#475569", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", padding: "2px 7px", borderRadius: 4, fontFamily: "monospace" }}>{t}</span>
        ))}
      </div>
      {typeof tvl === "number" && (
        <div style={{ fontSize: 9, color: "#34d399", fontFamily: "monospace", letterSpacing: "0.04em", opacity: 0.85 }}>
          TVL: {formatTvl(tvl)} on Arc <span style={{ color: "#334155" }}>· DeFiLlama</span>
        </div>
      )}
      <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: catColor, fontWeight: 700, fontFamily: "monospace", letterSpacing: "0.08em", textDecoration: "none" }}>
        VISIT →
      </a>
    </div>
  );
}