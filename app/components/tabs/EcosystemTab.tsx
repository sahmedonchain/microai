"use client";
import React, { useEffect, useRef, useState } from "react";
import { TabLink as Link } from "@/app/components/tabs/TabNav";
import { motion } from "framer-motion";
import {
  Grid2x2,
  List,
  MessageSquare,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { LogoMark } from "@/app/components/landing/LandingNavbar";
import { truncateAddress } from "@/lib/format";

const PAGE_SIZE = 20;

type Project = {
  name: string;
  desc: string;
  category: string;
  tags: string[];
  url: string;
  logo: string;
  logoColor: string;
  featured?: boolean;
  usdcSupport?: boolean;
  agentCompatible?: boolean;
  apiAvailable?: boolean;
  github?: string;
  contract?: string;
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
    desc: "Full-stack Web3 development framework. SDKs, smart contract tools, and wallets, all Arc-compatible.",
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
    desc: "Builder platform and hackathon organizer on Arc. Runs Agora and Lepton Agents hackathons, for AI agents that pay, receive, and orchestrate USDC nanopayments on Arc.",
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
    name: "Argus",
    desc: "Permissionless token launchpad on Arc, powered by Uniswap v4 hooks with fixed-at-launch taxes and native USDC revenue distribution to creators and holders.",
    category: "DEX & LIQUIDITY",
    tags: ["Launchpad", "Uniswap v4", "USDC"],
    url: "https://argus.world/",
    logo: "AR",
    logoColor: "#fb923c",
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


export function EcosystemTab() {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"tvl" | "name">("tvl");
  const [view, setView] = useState<"list" | "grid">("list");
  const [page, setPage] = useState(1);
  const [tvlByProject, setTvlByProject] = useState<Record<string, number>>({});

  const searchRef = useRef<HTMLInputElement>(null);

  const [aiQuery, setAiQuery] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const askEcosystem = async () => {
    const query = aiQuery.trim();
    if (!query || aiLoading) return;
    setAiLoading(true);
    setAiError("");
    setAiAnswer("");
    try {
      const res = await fetch("/api/ecosystem-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, projects: projects.map((p) => p.name) }),
      });
      const data = await res.json();
      if (!res.ok) setAiError(data.error || "Search failed. Please try again.");
      else setAiAnswer(data.answer);
    } catch {
      setAiError("Search failed. Check your connection and try again.");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ecosystem-tvl")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.tvl) setTvlByProject(data.tvl);
      })
      .catch(() => { /* enrichment is optional — rows render fine without it */ });
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

  // Sort: "tvl" puts real Arc-chain TVL first (highest on top, matching
  // DeFiLlama's own list), untracked projects after in their existing
  // order. "name" is a straight alphabetical sort — the only two sort
  // criteria we can back with real data (we don't track a "date added").
  const ranked = [...filtered].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    const tvlA = tvlByProject[a.name] ?? -1;
    const tvlB = tvlByProject[b.name] ?? -1;
    return tvlB - tvlA;
  });

  const totalPages = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageItems = ranked.slice(pageStart, pageStart + PAGE_SIZE);

  const categoryList = categories.filter((c) => c !== "ALL");
  const categoryCounts = categoryList.map((c) => ({
    name: c,
    count: projects.filter((p) => p.category === c).length,
  }));
  const tvlTrackedCount = Object.keys(tvlByProject).length;

  return (
    <div className="min-h-full bg-space font-sans text-text">

      {/* HERO */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <p className="text-xs text-muted">
            <Link href="/" className="hover:text-text">Home</Link> / Ecosystem
          </p>

          <div className="mt-4 flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <h1 className="text-3xl font-semibold leading-[1.15] text-text sm:text-4xl">
                Arc &amp; Circle
                <br />
                Ecosystem Directory
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted">
                Every project, protocol, and builder in the Arc + Circle ecosystem, from community dApps to
                institutional partners.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-5">
              <EcosystemGlyph />
              <p className="max-w-[20ch] text-sm leading-relaxed text-muted">
                Built on Arc. Backed by real on-chain and DeFiLlama data.
              </p>
            </div>
          </div>

          {/* STAT STRIP — real counts only */}
          <div className="mt-10 flex flex-wrap gap-3">
            {[
              { label: "Total projects", value: projects.length },
              { label: "Categories", value: categoryList.length },
              { label: "Live TVL tracked", value: tvlTrackedCount },
            ].map((s) => (
              <div key={s.label} className="min-w-[140px] flex-1 rounded-lg border border-border bg-surface px-5 py-4 sm:flex-none">
                <p className="font-mono text-2xl text-text">{s.value}</p>
                <p className="mt-1 text-xs text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6">
        {/* MAIN */}
        <div className="min-w-0 flex-1">
          {/* AI SEARCH */}
          <div className="mb-6">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && askEcosystem()}
                maxLength={300}
                placeholder="Ask about Arc ecosystem..."
                aria-label="Ask about the Arc ecosystem"
                className="flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
              <button
                type="button"
                onClick={askEcosystem}
                disabled={aiLoading || !aiQuery.trim()}
                className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Search
              </button>
            </div>
            {aiLoading && <p className="mt-3 text-sm text-muted" role="status">Searching ecosystem...</p>}
            {aiError && <p className="mt-3 text-sm text-danger">{aiError}</p>}
            {aiAnswer && (
              <div className="mt-3 rounded-lg border border-border bg-surface p-4">
                <span className="mb-2 inline-block rounded-full border border-accent/30 bg-accent-dim px-2 py-0.5 font-mono text-[10px] text-accent-text">AI</span>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{aiAnswer}</p>
              </div>
            )}
            <p className="mt-3 text-xs text-muted">
              {projects.length} projects · {categoryList.length} categories · AI-powered search
            </p>
          </div>

          {/* SEARCH + FILTER BAR */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search projects, tags, categories..."
                className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="relative">
                <select
                  value={filter}
                  onChange={(e) => { setFilter(e.target.value); setPage(1); }}
                  className="appearance-none rounded-lg border border-border bg-surface py-2.5 pl-3 pr-8 text-sm text-text focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c === "ALL" ? "All categories" : c}</option>
                  ))}
                </select>
                <SlidersHorizontal className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
              </div>

              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value as "tvl" | "name"); setPage(1); }}
                className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none"
              >
                <option value="tvl">Sort: TVL</option>
                <option value="name">Sort: Name</option>
              </select>

              <div className="flex rounded-lg border border-border bg-surface p-0.5">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  aria-label="List view"
                  className={`rounded-md p-1.5 transition ${view === "list" ? "bg-accent-dim text-accent-text" : "text-muted hover:text-text"}`}
                >
                  <List className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  aria-label="Grid view"
                  className={`rounded-md p-1.5 transition ${view === "grid" ? "bg-accent-dim text-accent-text" : "text-muted hover:text-text"}`}
                >
                  <Grid2x2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted">
            {ranked.length === 0
              ? `No results${search ? ` for "${search}"` : ""}`
              : `Showing ${pageStart + 1}-${Math.min(pageStart + PAGE_SIZE, ranked.length)} of ${ranked.length}`}
          </p>

          {/* LIST / GRID */}
          {view === "list" ? (
            <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface">
              <div className="ecosystem-grid hidden gap-3 border-b border-border px-4 py-2.5 text-xs text-muted sm:grid">
                <span>#</span>
                <span>Project</span>
                <span>Category</span>
                <span>Description</span>
                <span className="text-right">TVL on Arc</span>
                <span className="text-right">Link</span>
              </div>
              {pageItems.map((p, i) => (
                <ProjectRow key={p.name} project={p} rank={pageStart + i + 1} tvl={tvlByProject[p.name]} />
              ))}
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pageItems.map((p) => (
                <ProjectCard key={p.name} project={p} tvl={tvlByProject[p.name]} />
              ))}
            </div>
          )}

          {/* PAGINATION */}
          {ranked.length > PAGE_SIZE && (
            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-text transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-muted">Page {page} of {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-text transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <aside className="hidden w-64 shrink-0 flex-col gap-6 lg:flex">
          <div>
            <p className="text-sm font-medium text-text">Categories</p>
            <div className="mt-3 flex flex-col gap-0.5">
              <button
                onClick={() => { setFilter("ALL"); setPage(1); }}
                className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition ${
                  filter === "ALL" ? "bg-accent-dim text-accent-text" : "text-muted hover:bg-surface hover:text-text"
                }`}
              >
                All categories
                <span className="font-mono text-xs">{projects.length}</span>
              </button>
              {categoryCounts.map((c) => (
                <button
                  key={c.name}
                  onClick={() => { setFilter(c.name); setPage(1); }}
                  className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition ${
                    filter === c.name ? "bg-accent-dim text-accent-text" : "text-muted hover:bg-surface hover:text-text"
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="font-mono text-xs">{c.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-secondary/25 bg-secondary-dim p-4">
            <p className="text-sm font-semibold text-text">Want to list your project?</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Open an issue on our GitHub with your project details and we&apos;ll review it for the directory.
            </p>
            <a
              href="https://github.com/sahmedonchain/microai/issues"
              target="_blank"
              rel="noreferrer"
              className="mt-2.5 inline-block text-xs font-medium text-secondary-text hover:underline"
            >
              Suggest a project on GitHub
            </a>
          </div>
        </aside>
      </div>

      {/* CTA */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-7xl px-4 py-14 text-center sm:px-6">
          <h2 className="text-2xl font-semibold text-text">Ask MicroAI</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
            Get instant answers about any Arc or Circle ecosystem project for just $0.001 USDC.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:brightness-110"
          >
            <MessageSquare className="size-4" aria-hidden="true" />
            Ask MicroAI
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-6">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-5" />
            <span className="text-xs text-muted">MicroAI · The Arc &amp; Circle hub</span>
          </div>
          <div className="flex flex-wrap gap-5">
            {[
              { l: "Arc", h: "https://arc.io" },
              { l: "Circle", h: "https://circle.com" },
              { l: "GitHub", h: "https://github.com/sahmedonchain/microai" },
              { l: "Explorer", h: "https://explorer.arc.io" },
            ].map((link) => (
              <a key={link.l} href={link.h} target="_blank" rel="noreferrer" className="text-xs text-muted transition hover:text-text">
                {link.l}
              </a>
            ))}
          </div>
        </div>
      </footer>

      <style>{`
        .ecosystem-grid { grid-template-columns: 28px 1fr 130px minmax(0,2fr) 100px 60px; }
        select { color-scheme: dark; }
        @media (max-width: 640px) {
          .hide-on-mobile { display: none; }
          .ecosystem-row.ecosystem-grid { grid-template-columns: 24px 1fr 70px 60px; }
        }
      `}</style>
    </div>
  );
}

// Decorative hero graphic — two overlapping circles with connection nodes,
// in our own brand colors. Purely visual, no data.
function EcosystemGlyph() {
  return (
    <svg width="120" height="88" viewBox="0 0 120 88" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="46" cy="44" r="34" stroke="var(--color-accent-text)" strokeOpacity="0.4" strokeWidth="1.5" />
      <circle cx="78" cy="44" r="34" stroke="var(--color-secondary-text)" strokeOpacity="0.4" strokeWidth="1.5" />
      <line x1="46" y1="44" x2="78" y2="44" stroke="var(--color-border)" strokeWidth="1" />
      <line x1="46" y1="44" x2="30" y2="20" stroke="var(--color-border)" strokeWidth="1" />
      <line x1="78" y1="44" x2="96" y2="66" stroke="var(--color-border)" strokeWidth="1" />
      <circle cx="46" cy="44" r="4" fill="var(--color-accent-text)" />
      <circle cx="78" cy="44" r="4" fill="var(--color-secondary-text)" />
      <circle cx="30" cy="20" r="3" fill="var(--color-accent-text)" fillOpacity="0.7" />
      <circle cx="96" cy="66" r="3" fill="var(--color-secondary-text)" fillOpacity="0.7" />
    </svg>
  );
}

function formatTvl(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(2)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
}

function ProjectRow({ project: p, rank, tvl }: { project: Project; rank: number; tvl?: number }) {
  const catColor = CATEGORY_COLORS[p.category] ?? "#664c88";
  return (
    <motion.a
      href={p.url}
      target="_blank"
      rel="noreferrer"
      whileHover={{ y: -2, backgroundColor: "rgba(255,255,255,0.03)" }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="ecosystem-grid ecosystem-row grid items-center gap-3 border-b border-border px-4 py-3 no-underline last:border-b-0"
    >
      <span className="font-mono text-xs text-muted">{rank}</span>

      <div className="flex min-w-0 items-center gap-2.5">
        <div
          className="flex size-7 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold"
          style={{ background: `${p.logoColor}20`, border: `1px solid ${p.logoColor}35`, color: p.logoColor }}
        >
          {p.logo}
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium text-text">{p.name}</span>
          {p.featured && (
            <span className="shrink-0 rounded border border-accent/30 bg-accent-dim px-1.5 py-0.5 font-mono text-[9px] text-accent-text">
              Featured
            </span>
          )}
        </div>
      </div>

      <span
        className="hide-on-mobile w-fit justify-self-start truncate rounded px-2 py-0.5 font-mono text-[10px] font-medium"
        style={{ background: `${catColor}18`, border: `1px solid ${catColor}30`, color: catColor }}
      >
        {p.category}
      </span>

      <p className="hide-on-mobile truncate text-xs text-muted">{p.desc}</p>

      <span className="text-right font-mono text-xs font-semibold text-accent-text">
        {typeof tvl === "number" ? formatTvl(tvl) : ""}
      </span>

      <span className="text-right font-mono text-[11px] font-medium" style={{ color: catColor }}>
        Visit →
      </span>
    </motion.a>
  );
}

function ProjectCard({ project: p, tvl }: { project: Project; tvl?: number }) {
  const catColor = CATEGORY_COLORS[p.category] ?? "#664c88";
  return (
    <motion.a
      href={p.url}
      target="_blank"
      rel="noreferrer"
      whileHover={{ y: -2, borderColor: "var(--color-accent)" }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 no-underline"
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold"
          style={{ background: `${p.logoColor}20`, border: `1px solid ${p.logoColor}35`, color: p.logoColor }}
        >
          {p.logo}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-text">{p.name}</span>
            {p.featured && (
              <span className="shrink-0 rounded border border-accent/30 bg-accent-dim px-1.5 py-0.5 font-mono text-[9px] text-accent-text">
                Featured
              </span>
            )}
          </div>
          <span
            className="mt-1 inline-block rounded px-1.5 py-0.5 font-mono text-[9px] font-medium"
            style={{ background: `${catColor}18`, border: `1px solid ${catColor}30`, color: catColor }}
          >
            {p.category}
          </span>
        </div>
      </div>
      <p className="line-clamp-2 flex-1 text-xs leading-relaxed text-muted">{p.desc}</p>
      {(p.usdcSupport || p.agentCompatible || p.apiAvailable || p.github || p.contract) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {p.usdcSupport && (
            <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] text-success">USDC Support</span>
          )}
          {p.agentCompatible && (
            <span className="rounded-full border border-secondary/30 bg-secondary-dim px-2 py-0.5 text-[10px] text-secondary-text">Agent Compatible</span>
          )}
          {p.apiAvailable && (
            <span className="rounded-full border border-border bg-surface-raised px-2 py-0.5 text-[10px] text-muted">API Available</span>
          )}
          {p.github && (
            <span
              role="link"
              tabIndex={0}
              aria-label={`${p.name} on GitHub`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(p.github, "_blank", "noopener,noreferrer"); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); window.open(p.github, "_blank", "noopener,noreferrer"); } }}
              className="inline-flex cursor-pointer items-center gap-1 text-[10px] text-muted hover:text-text"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
              </svg>
              GitHub
            </span>
          )}
          {p.contract && <span className="font-mono text-[10px] text-muted">{truncateAddress(p.contract)}</span>}
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold text-accent-text">
          {typeof tvl === "number" ? formatTvl(tvl) : ""}
        </span>
        <span className="font-mono text-[11px] font-medium" style={{ color: catColor }}>Visit →</span>
      </div>
    </motion.a>
  );
}
