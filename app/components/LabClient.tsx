"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LAB_SCENARIOS, TESTNET, TESTNET_CHAIN_PARAMS, encodeErc20Transfer, tokenAddress, verifyLink, walletErrorMessage, type LabScenario } from "@/lib/verify/lab";

interface Eip1193 {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

function getProvider(): Eip1193 | undefined {
  return (window as unknown as { ethereum?: Eip1193 }).ethereum;
}

const SEVERITY_STYLE = {
  ok: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  error: "border-danger/20 bg-danger/10 text-danger",
} as const;

const BTN_PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const BTN_SECONDARY =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm text-text hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function LabClient() {
  const [account, setAccount] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, string>>({});

  // Keep the page in step with the wallet: another account or network chosen in
  // the wallet must never leave the page holding a stale account.
  useEffect(() => {
    const provider = getProvider();
    if (!provider?.on || !provider.removeListener) return;
    const onAccounts = (accounts: unknown) => {
      const list = Array.isArray(accounts) ? (accounts as string[]) : [];
      setAccount(list[0] ?? null);
      setError(null);
    };
    const onChain = () => setError(null);
    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, []);

  /** The account the wallet currently allows this site to use, asking again if needed. */
  async function currentAccount(provider: Eip1193): Promise<string> {
    let accounts = (await provider.request({ method: "eth_accounts" })) as string[];
    if (!accounts?.length) accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    if (!accounts?.length) throw new Error("No account is connected. Click Connect wallet.");
    return accounts[0];
  }

  // Only called for a payment that has been sent, so the browser is always there.
  const origin = () => window.location.origin;

  async function ensureTestnet(provider: Eip1193) {
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: TESTNET.chainIdHex }] });
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 4902 || code === -32603) {
        await provider.request({ method: "wallet_addEthereumChain", params: [TESTNET_CHAIN_PARAMS] });
      } else {
        throw err;
      }
    }
    const id = (await provider.request({ method: "eth_chainId" })) as string;
    if (id.toLowerCase() !== TESTNET.chainIdHex.toLowerCase()) throw new Error("Your wallet is not on Arc Testnet. Switch the network and try again.");
  }

  async function connect() {
    setError(null);
    const provider = getProvider();
    if (!provider) return setError("No wallet found. Install a browser wallet such as MetaMask.");
    try {
      await provider.request({ method: "eth_requestAccounts" });
      await ensureTestnet(provider);
      // Read the account again after the network switch: some wallets change it.
      setAccount(await currentAccount(provider));
    } catch (err) {
      setError(walletErrorMessage(err));
    }
  }

  async function send(s: LabScenario) {
    setError(null);
    const provider = getProvider();
    if (!provider) return setError("No wallet found. Install a browser wallet such as MetaMask.");
    setBusy(s.id);
    try {
      // This page only ever sends on Arc Testnet, so the network is checked again
      // right before sending, and the account is read fresh from the wallet.
      await ensureTestnet(provider);
      const transfer = async () => {
        const from = await currentAccount(provider);
        setAccount(from);
        return (await provider.request({
          method: "eth_sendTransaction",
          params: [{ from, to: tokenAddress(s.token), data: encodeErc20Transfer(s.to, s.units), value: "0x0" }],
        })) as string;
      };
      let hash: string;
      try {
        hash = await transfer();
      } catch (err) {
        // 4100: the wallet no longer lists this site as connected (it can happen
        // after a network switch). Ask for permission once more and retry once.
        if ((err as { code?: number }).code !== 4100) throw err;
        await provider.request({ method: "eth_requestAccounts" });
        hash = await transfer();
      }
      setSent((prev) => ({ ...prev, [s.id]: hash }));
    } catch (err) {
      setError(walletErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 text-text sm:px-5 sm:py-12">
      <Link href="/verify" className="text-sm text-accent-text hover:underline">
        ← MicroAI Verify
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Testnet lab</h1>
        <span className="inline-flex items-center rounded-full border border-warning/25 bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">Arc Testnet only</span>
      </div>
      <p className="mt-3 max-w-prose leading-relaxed text-muted">
        Send small test payments and see how MicroAI Verify judges each one. Every scenario below has a known right answer, so you can check that Verify gets it right. No real money is used.
      </p>

      <section className="mt-8 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-base font-semibold">Before you start</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
          <li>
            Use a <span className="text-text">test wallet</span>, not your main one. This page only sends from the wallet you connect, and you approve every payment.
          </li>
          <li>
            Get free test USDC (and EURC for the last scenario) from the{" "}
            <a href={TESTNET.faucetUrl} target="_blank" rel="noopener noreferrer" className="text-accent-text hover:underline">
              Circle faucet
            </a>
            . Pick Arc Testnet.
          </li>
          <li>Connect below. Your wallet will be switched to Arc Testnet.</li>
        </ol>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={connect} className={BTN_PRIMARY}>
            {account ? "Connected" : "Connect wallet"}
          </button>
          {account && <span className="break-all font-mono text-xs text-muted">{account}</span>}
        </div>
      </section>

      <div aria-live="polite">
        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      <h2 className="mt-8 text-lg font-semibold">Scenarios</h2>
      <ul className="mt-3 space-y-3">
        {LAB_SCENARIOS.map((s, i) => {
          const hash = sent[s.id];
          return (
            <li key={s.id} className="rounded-lg border border-border bg-surface p-4">
              <h3 className="text-base font-semibold">
                {i + 1}. {s.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.does}</p>
              <p className="mt-2 text-sm">
                <span className="text-muted">Verify should say: </span>
                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${SEVERITY_STYLE[s.severity]}`}>{s.expected}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={!account || busy !== null} onClick={() => send(s)} className={BTN_PRIMARY}>
                  {busy === s.id ? "Waiting for your wallet…" : "Send this test payment"}
                </button>
              </div>

              {hash && (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-sm font-medium">Sent</p>
                  <p className="mt-1 break-all font-mono text-xs text-muted">{hash}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={verifyLink(origin(), { txHash: hash, network: "testnet", useEndpoint: true })} className={BTN_SECONDARY}>
                      Check it with Verify
                    </Link>
                    <a href={`${TESTNET.explorerUrl}/tx/${hash}`} target="_blank" rel="noopener noreferrer" className={BTN_SECONDARY}>
                      View on Arc Explorer
                    </a>
                  </div>
                  {s.id === "exact" && (
                    <p className="mt-3 text-sm leading-relaxed text-muted">
                      Extra check, the wrong network:{" "}
                      <Link href={verifyLink(origin(), { txHash: hash, network: "mainnet", useEndpoint: false })} className="text-accent-text hover:underline">
                        check the same payment as if it were on Mainnet
                      </Link>
                      . Verify should say it is on Arc Testnet, not Arc Mainnet.
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted">If Verify says it cannot find the transaction, wait a few seconds and run the check again.</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <section className="mt-10 border-t border-border pt-6">
        <p className="max-w-prose text-sm leading-relaxed text-muted">
          Other test endpoints that fail on purpose (they answer too slowly, or answer HTTP 503) are listed on the{" "}
          <Link href="/verify" className="text-accent-text hover:underline">
            Verify page
          </Link>{" "}
          under the examples. MicroAI is an independent project, not an official Arc or Circle product.
        </p>
      </section>
    </main>
  );
}
