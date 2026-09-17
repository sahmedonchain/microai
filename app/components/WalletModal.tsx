"use client";
import { useState, useEffect } from "react";

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

const ARC_CHAIN_ID = "0x13b2";
const ARC_CHAIN_PARAMS = {
  chainId: ARC_CHAIN_ID,
  chainName: "Arc MAINNET",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: ["https://rpc.mainnet.arc.io"],
  blockExplorerUrls: ["https://explorer.arc.io"],
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
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: "#020e06", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 20, padding: "24px 20px", width: "100%", maxWidth: 360, position: "relative", boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}
      >
        {/* Top shimmer */}
        <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1, background: "linear-gradient(90deg,transparent,rgba(52,211,153,0.4),transparent)" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>Connect Wallet</div>
            <div style={{ fontSize: 10, color: "#334155", fontFamily: "monospace", letterSpacing: "0.08em", marginTop: 2 }}>ARC MAINNET · USDC GAS</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#475569", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        {/* Wallet list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {wallets.map(wallet => (
            <button
              key={wallet.id}
              onClick={() => connect(wallet)}
              disabled={connecting !== null}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderRadius: 12,
                border: connecting === wallet.id ? `1px solid ${wallet.color}40` : "1px solid rgba(255,255,255,0.06)",
                background: connecting === wallet.id ? `${wallet.color}10` : "rgba(255,255,255,0.02)",
                cursor: connecting !== null ? "not-allowed" : "pointer",
                transition: "all 0.15s", width: "100%", textAlign: "left",
                opacity: connecting !== null && connecting !== wallet.id ? 0.4 : 1,
              }}
            >
              {/* Icon */}
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${wallet.color}15`, border: `1px solid ${wallet.color}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                {connecting === wallet.id ? (
                  <div style={{ width: 16, height: 16, border: `2px solid ${wallet.color}40`, borderTop: `2px solid ${wallet.color}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                ) : wallet.icon}
              </div>

              {/* Name */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{wallet.name}</div>
                <div style={{ fontSize: 9, fontFamily: "monospace", marginTop: 1 }}>
                  {connecting === wallet.id
                    ? <span style={{ color: wallet.color }}>Connecting...</span>
                    : wallet.detected
                    ? <span style={{ color: "#34d399" }}>Detected</span>
                    : <span style={{ color: "#475569" }}>Not installed — click to install</span>
                  }
                </div>
              </div>

              {/* Arrow */}
              {!connecting && (
                <span style={{ fontSize: 12, color: "#334155" }}>{wallet.detected ? "→" : "↗"}</span>
              )}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", fontSize: 11, color: "#f87171", fontFamily: "monospace" }}>
            {error}
          </div>
        )}

        {/* Info */}
        <div style={{ marginTop: 16, padding: "10px 12px", borderRadius: 10, background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.08)" }}>
          <div style={{ fontSize: 9, color: "#334155", fontFamily: "monospace", letterSpacing: "0.08em", marginBottom: 4 }}>NEED MAINNET USDC?</div>
          <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#34d399", textDecoration: "none", fontWeight: 600 }}>
            Get free USDC at faucet.circle.com ↗
          </a>
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}