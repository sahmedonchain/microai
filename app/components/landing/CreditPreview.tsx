"use client";
import { useEffect, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";

const START_BALANCE = 1000;

// Scripted demo of a prepaid balance draining as messages are answered.
const DEMO = [
  { prompt: "How does CCTP mint USDC on Arc?", tokens: 184, cost: 18 },
  { prompt: "Debug this revert: ERC20 transfer failed", tokens: 412, cost: 41 },
  { prompt: "Summarize today's Arc ecosystem stats", tokens: 263, cost: 26 },
];

export function CreditPreview() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [balance, setBalance] = useState(START_BALANCE);
  const shown = useMotionValue(START_BALANCE);
  const text = useTransform(shown, (v) => Math.round(v).toLocaleString("en-US"));

  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => {
        const next = (s + 1) % (DEMO.length + 1);
        setBalance(
          next === 0 ? START_BALANCE : START_BALANCE - DEMO.slice(0, next).reduce((sum, m) => sum + m.cost, 0),
        );
        return next;
      });
    }, 3200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (reduce) {
      shown.set(balance);
      return;
    }
    const controls = animate(shown, balance, { duration: 0.8, ease: "easeOut" });
    return () => controls.stop();
  }, [balance, reduce, shown]);

  const last = step > 0 ? DEMO[step - 1] : null;
  const pct = (balance / START_BALANCE) * 100;

  return (
    <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6" aria-label="Credit balance preview">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">Credit balance</span>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">Preview</span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <motion.span className="font-mono text-2xl font-medium text-text tabular-nums">{text}</motion.span>
        <span className="text-sm text-muted">credits</span>
      </div>

      <div
        className="mt-4 h-1 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Share of starting balance remaining"
      >
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: reduce ? 0 : 0.8, ease: "easeOut" }}
        />
      </div>
      <p className="mt-2 font-mono text-xs text-muted">
        {Math.round(pct)}% of {START_BALANCE.toLocaleString("en-US")} remaining
      </p>

      <div className="mt-6 min-h-[88px] border-t border-border pt-4">
        {last ? (
          <motion.div key={step} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
            <p className="truncate text-sm text-text">{last.prompt}</p>
            <div className="mt-2 flex items-center justify-between font-mono text-xs text-muted">
              <span>{last.tokens} tokens</span>
              <span>-{last.cost} credits</span>
            </div>
            <span className="mt-3 inline-block rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-xs text-success">
              ● Confirmed
            </span>
          </motion.div>
        ) : (
          <p className="text-sm text-muted">Send your first message to begin.</p>
        )}
      </div>
    </div>
  );
}
