"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadPending, removePending, resolvePurchase, savePending, type PendingPurchase, type ResolveResult } from "@/lib/pendingPurchase";

interface Options {
  // Connected wallet address, or null while disconnected.
  wallet: string | null;
  // Re-establish the signed-in session. Prompts a signature, so it is only
  // used right after the user paid, never silently on page load.
  ensureSession: () => Promise<boolean>;
  // Called when credits were added; `credits` is the new balance when known.
  onCredited: (credits: number | null) => void;
}

// Tracks credit purchases that were paid but not yet confirmed by the server:
// shows a "Payment pending, verifying…" notice, resumes saved purchases when
// the app loads, and keeps retrying until the server answers definitively.
export function usePendingPurchases({ wallet, ensureSession, onCredited }: Options) {
  const [pending, setPending] = useState<PendingPurchase[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const running = useRef(new Set<string>());
  const latest = useRef({ ensureSession, onCredited });
  useEffect(() => {
    latest.current = { ensureSession, onCredited };
  });

  const refresh = useCallback(() => {
    setPending(wallet ? loadPending(wallet) : []);
  }, [wallet]);

  const run = useCallback(
    async (p: PendingPurchase, interactive: boolean): Promise<ResolveResult | null> => {
      const key = p.txHash.toLowerCase();
      if (running.current.has(key)) return null; // already being verified
      running.current.add(key);
      setError("");
      setNotice("Payment pending, verifying…");
      try {
        const result = await resolvePurchase(p, {
          ensureSession: () => (interactive ? latest.current.ensureSession() : Promise.resolve(false)),
          onStatus: setNotice,
        });
        if (result.status === "credited") {
          setNotice("");
          latest.current.onCredited(result.credits);
        } else if (result.status === "already") {
          setNotice("");
          latest.current.onCredited(null);
        } else if (result.status === "rejected") {
          setNotice("");
          setError(result.message);
        } else if (result.status === "needs-session") {
          setNotice("Payment pending. Sign in again to finish verifying it.");
        } else {
          setNotice("Payment still pending. We will keep checking when you reopen the app.");
        }
        return result;
      } finally {
        running.current.delete(key);
        refresh();
      }
    },
    [refresh]
  );

  // Save first, verify second: the txHash is on disk before anything can go wrong.
  const track = useCallback(
    (p: PendingPurchase) => {
      savePending(p);
      refresh();
      return run(p, true);
    },
    [refresh, run]
  );

  // Resume purchases left over from an earlier visit (tab closed, slow receipt).
  // Call it once a valid session is known; it never asks for a signature itself.
  const resume = useCallback(
    (address: string) => {
      for (const p of loadPending(address)) void run(p, false);
      refresh();
    },
    [run, refresh]
  );

  const dismiss = useCallback(
    (txHash: string) => {
      removePending(txHash);
      refresh();
    },
    [refresh]
  );

  const clearError = useCallback(() => setError(""), []);

  return { pending, notice, error, track, resume, dismiss, clearError };
}
