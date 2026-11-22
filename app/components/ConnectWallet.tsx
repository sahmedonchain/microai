"use client";
import { useCallback, useEffect, useState } from "react";
import { ARC_MAINNET } from "@/lib/arcConfig";
import { WalletModal } from "@/app/components/WalletModal";

// Connect a browser wallet (any EIP-1193 wallet) and sign in with it, so pages
// that need to know your wallet (Refund & Disputes) can work.
//
// Only the public address is used. The sign-in asks the wallet to sign one
// plain-text message (Sign-In with Ethereum: no transaction, no cost, no
// permission to move funds). MicroAI never asks for a private key, seed phrase
// or recovery phrase, and never signs or sends anything for you.

type Eip1193 = { request(a: { method: string; params?: unknown[] }): Promise<unknown>; on?(e: string, h: (...a: unknown[]) => void): void; removeListener?(e: string, h: (...a: unknown[]) => void): void };
const wallet = () => (typeof window === "undefined" ? undefined : (window as unknown as { ethereum?: Eip1193 }).ethereum);

const BTN =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const BTN2 =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm text-text hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Request failed.");
  return data as T;
}

export function ConnectWallet({ onChange }: { onChange?: (address: string | null) => void }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainOk, setChainOk] = useState(true);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const update = useCallback((a: string | null) => {
    setAddress(a);
    onChange?.(a);
  }, [onChange]);

  const checkChain = useCallback(async () => {
    const eth = wallet();
    if (!eth) return;
    try {
      setChainOk(String(await eth.request({ method: "eth_chainId" })).toLowerCase() === ARC_MAINNET.chainIdHex);
    } catch { /* optional */ }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await json<{ authenticated: boolean; address?: string }>(await fetch("/api/session"));
        if (s.authenticated && s.address) update(s.address);
      } catch { /* not signed in */ }
    })();
    void checkChain();
    const eth = wallet();
    eth?.on?.("chainChanged", checkChain);
    return () => eth?.removeListener?.("chainChanged", checkChain);
  }, [update, checkChain]);

  const signIn = async (addr: string, provider: Eip1193) => {
    setPicking(false);
    setBusy(true);
    setError("");
    try {
      const { message } = await json<{ message: string }>(await fetch(`/api/session/nonce?address=${addr}`));
      const signature = (await provider.request({ method: "personal_sign", params: [message, addr] })) as string;
      const ok = await json<{ address: string }>(await fetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: addr, signature, message }) }));
      update(ok.address);
      void checkChain();
    } catch (e) {
      const err = e as { code?: number; message?: string };
      setError(err.code === 4001 ? "You rejected the signature request. Nothing was sent." : (err.message || "Could not sign in.").slice(0, 200));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await fetch("/api/session", { method: "DELETE" });
    } finally {
      update(null);
      setBusy(false);
    }
  };

  const switchNetwork = async () => {
    try {
      await wallet()?.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_MAINNET.chainIdHex }] });
    } catch {
      setError("Could not switch network. Add Arc Mainnet in your wallet, then try again.");
    }
    void checkChain();
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="mb-3 text-xs text-muted">Connect wallet</div>
      {address ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-success/25 bg-success/10 px-3 py-1 text-xs text-success">
            <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />Connected
          </span>
          <span className="break-all font-mono text-xs text-text">{address}</span>
          <button type="button" className={BTN2} onClick={disconnect} disabled={busy}>Disconnect</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={BTN} onClick={() => setPicking(true)} disabled={busy}>{busy ? "Waiting for your wallet…" : "Connect wallet"}</button>
          <span className="text-xs text-muted">MicroAI never stores your private key or seed phrase.</span>
        </div>
      )}
      {address && !chainOk && (
        <p role="alert" className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm text-warning">
          Your wallet is not on {ARC_MAINNET.name}. Switch before sending or approving anything.
          <button type="button" className={BTN2} onClick={switchNetwork}>Switch to Arc Mainnet</button>
        </p>
      )}
      {error && <p role="alert" className="mt-3 rounded-lg border border-danger/20 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      <p className="mt-3 text-xs leading-relaxed text-muted">
        Works with MetaMask, Rabby, Rainbow, Coinbase Wallet, Trust Wallet and other EVM wallets. Connecting signs one plain message to prove the address is yours. It is not a transaction and cannot move funds.
      </p>
      {picking && <WalletModal onConnect={(addr, provider) => void signIn(addr, provider as Eip1193)} onClose={() => setPicking(false)} />}
    </div>
  );
}
