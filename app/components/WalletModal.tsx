"use client";
import { ARC_MAINNET } from "@/lib/arcConfig";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isTrust?: boolean;
  isBraveWallet?: boolean;
  providers?: EthereumProvider[];
}
declare global {
  interface Window {
    ethereum?: EthereumProvider;
    coinbaseWalletExtension?: EthereumProvider;
  }
}

const ARC_CHAIN_ID = ARC_MAINNET.chainIdHex;
const ARC_CHAIN_PARAMS = {
  chainId: ARC_CHAIN_ID,
  chainName: "Arc MAINNET",
  nativeCurrency: ARC_MAINNET.nativeCurrency,
  rpcUrls: [ARC_MAINNET.rpcUrl],
  blockExplorerUrls: [ARC_MAINNET.explorerUrl],
};

type WalletOption = {
  id: string;
  name: string;
  icon: string;
  detected: boolean;
  installUrl: string;
  color: string;
};

function detectWallets(): WalletOption[] {
  const eth = window.ethereum;
  const providers = eth?.providers ?? [];

  const isMetaMask = !!(eth?.isMetaMask && !eth?.isCoinbaseWallet) || providers.some(p => p.isMetaMask);
  const isCoinbase = !!(eth?.isCoinbaseWallet) || !!window.coinbaseWalletExtension || providers.some(p => p.isCoinbaseWallet);
  const isTrust = !!(eth?.isTrust);
  const isBrave = !!(eth?.isBraveWallet);

  return [
    { id: "metamask", name: "MetaMask", icon: "🦊", detected: isMetaMask, installUrl: "https://metamask.io/download", color: "#f6851b" },
    { id: "coinbase", name: "Coinbase Wallet", icon: "🔵", detected: isCoinbase, installUrl: "https://www.coinbase.com/wallet/downloads", color: "#2563eb" },
    { id: "trust", name: "Trust Wallet", icon: "🛡️", detected: isTrust, installUrl: "https://trustwallet.com/download", color: "#3375bb" },
    { id: "brave", name: "Brave Wallet", icon: "🦁", detected: isBrave, installUrl: "https://brave.com/wallet", color: "#fb542b" },
  ];
}

async function getProviderForWallet(walletId: string): Promise<EthereumProvider | null> {
  const eth = window.ethereum;
  if (!eth) return null;
  const providers = eth.providers ?? [];
  if (providers.length > 0) {
    if (walletId === "metamask") return providers.find(p => p.isMetaMask && !p.isCoinbaseWallet) ?? null;
    if (walletId === "coinbase") return providers.find(p => p.isCoinbaseWallet) ?? null;
  }
  return eth;
}

interface WalletModalProps {
  onConnect: (address: string, provider: EthereumProvider) => void;
  onClose: () => void;
}

export function WalletModal({ onConnect, onClose }: WalletModalProps) {
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setWallets(detectWallets());
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const connect = async (wallet: WalletOption) => {
    if (!wallet.detected) {
      window.open(wallet.installUrl, "_blank");
      return;
    }
    setConnecting(wallet.id);
    setError("");
    try {
      const provider = await getProviderForWallet(wallet.id);
      if (!provider) throw new Error("Provider not found");

      // Switch or add Arc MAINNET
      try {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_CHAIN_ID }] });
      } catch (switchErr: unknown) {
        if ((switchErr as { code?: number }).code === 4902) {
          await provider.request({ method: "wallet_addEthereumChain", params: [ARC_CHAIN_PARAMS] });
        } else throw switchErr;
      }

      const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
      if (!accounts[0]) throw new Error("No account returned");
      onConnect(accounts[0], provider);
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string };
      if (e?.code === 4001) setError("Connection rejected.");
      else setError("Could not connect. Try again.");
    } finally {
      setConnecting(null);
    }
  };

  return (
    <motion.div
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Connect wallet"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="w-full max-w-sm rounded-xl border border-border bg-surface p-5"
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-text">Connect wallet</div>
            <div className="mt-0.5 font-mono text-xs text-muted">Arc Mainnet, gas paid in USDC</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex size-7 items-center justify-center rounded-md border border-border text-muted transition hover:bg-surface-raised hover:text-text"
          >
            ×
          </button>
        </div>

        {/* Wallet list */}
        <div className="flex flex-col gap-2">
          {wallets.map(wallet => (
            <button
              key={wallet.id}
              onClick={() => connect(wallet)}
              disabled={connecting !== null}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-space px-3.5 py-3 text-left transition disabled:cursor-not-allowed"
              style={{
                borderColor: connecting === wallet.id ? `${wallet.color}66` : undefined,
                background: connecting === wallet.id ? `${wallet.color}14` : undefined,
                opacity: connecting !== null && connecting !== wallet.id ? 0.4 : 1,
              }}
            >
              {/* Icon */}
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-lg"
                style={{ background: `${wallet.color}20`, border: `1px solid ${wallet.color}35` }}
              >
                {connecting === wallet.id ? (
                  <span
                    className="block size-4 animate-spin rounded-full"
                    style={{ border: `2px solid ${wallet.color}40`, borderTopColor: wallet.color }}
                  />
                ) : wallet.icon}
              </div>

              {/* Name */}
              <div className="flex-1">
                <div className="text-sm font-medium text-text">{wallet.name}</div>
                <div className="mt-0.5 font-mono text-xs">
                  {connecting === wallet.id
                    ? <span style={{ color: wallet.color }}>Connecting…</span>
                    : wallet.detected
                    ? <span className="text-success">Detected</span>
                    : <span className="text-muted">Not installed. Click to install</span>
                  }
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-3 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}

      </motion.div>
    </motion.div>
  );
}