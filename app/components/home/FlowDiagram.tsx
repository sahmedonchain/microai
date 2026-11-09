"use client";
import { useEffect, useRef, useState } from "react";
import { Eye, Landmark, Monitor, Server } from "lucide-react";

// x402 payment flow, drawn step by step. MicroAI sits beside it: it reads the
// 402 answer and, afterwards, matches the transaction. It is never in the payment path.

const X = { client: 16.67, server: 50, facilitator: 83.33 } as const;

type Step = {
  title: string;
  text: string;
  from: number;
  to: number;
  label: string;
  watch?: boolean;
};

const STEPS: Step[] = [
  {
    title: "Client asks",
    text: "A request for a paid resource, with no payment yet.",
    from: X.client,
    to: X.server,
    label: "GET /paid",
  },
  {
    title: "Server answers 402",
    text: "PAYMENT-REQUIRED states the price, network, USDC address and who gets paid.",
    from: X.server,
    to: X.client,
    label: "402 + PAYMENT-REQUIRED",
    watch: true,
  },
  {
    title: "Client signs",
    text: "The payment is signed in the client's own wallet. MicroAI never sees a key.",
    from: X.client,
    to: X.client,
    label: "signs in the wallet",
  },
  {
    title: "Client retries",
    text: "The same request again, now with PAYMENT-SIGNATURE.",
    from: X.client,
    to: X.server,
    label: "PAYMENT-SIGNATURE",
  },
  {
    title: "Facilitator settles",
    text: "The server has a facilitator check and settle the payment on Arc.",
    from: X.server,
    to: X.facilitator,
    label: "verify and settle",
  },
  {
    title: "Server delivers",
    text: "200 with PAYMENT-RESPONSE. Afterwards MicroAI can match the transaction and the delivery.",
    from: X.server,
    to: X.client,
    label: "200 + PAYMENT-RESPONSE",
    watch: true,
  },
];

const STEP_MS = 2800;
const isCalm = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Node({
  icon: Icon,
  name,
  active,
}: {
  icon: typeof Monitor;
  name: string;
  active: boolean;
}) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-2">
      <span
        className={`flex size-14 items-center justify-center rounded-2xl border bg-[#0b1020] transition-all duration-500 sm:size-16 ${
          active
            ? "border-accent-text/70 text-accent-text shadow-[0_0_34px_-4px_rgb(139_107_192/0.85)]"
            : "border-border text-muted"
        }`}
      >
        <Icon className="size-6 sm:size-7" aria-hidden="true" />
      </span>
      <span className="text-xs font-medium text-text sm:text-sm">{name}</span>
    </div>
  );
}

export function FlowDiagram() {
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLSpanElement>(null);
  const s = STEPS[step];

  // Autoplay only while the diagram is on screen.
  useEffect(() => {
    const el = root.current;
    if (!el || isCalm()) return;
    const io = new IntersectionObserver(
      ([en]) => setRunning(en.isIntersecting),
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(
      () => setStep((i) => (i + 1) % STEPS.length),
      STEP_MS,
    );
    return () => window.clearTimeout(id);
  }, [running, step]);

  // Move the dot: jump to the start, then glide to the end.
  useEffect(() => {
    const d = dot.current;
    if (!d) return;
    d.style.transition = "none";
    d.style.left = `${s.from}%`;
    d.style.opacity = s.from === s.to ? "0" : "1";
    if (isCalm() || s.from === s.to) {
      d.style.left = `${s.to}%`;
      return;
    }
    void d.offsetWidth;
    d.style.transition = "left 1.3s cubic-bezier(0.65, 0, 0.35, 1)";
    d.style.left = `${s.to}%`;
  }, [step, s]);

  const sender =
    s.from === X.client
      ? "client"
      : s.from === X.server
        ? "server"
        : "facilitator";
  const receiver =
    s.to === X.client ? "client" : s.to === X.server ? "server" : "facilitator";
  const lit = (who: string) => who === sender || who === receiver;

  return (
    <div
      ref={root}
      className="hm-card grid gap-8 p-5 sm:p-8 lg:grid-cols-[1.25fr_1fr] lg:items-center"
    >
      <div className="relative z-10">
        <div className="relative">
          <div
            className="absolute left-[16.67%] right-[16.67%] top-7 h-px bg-border sm:top-8"
            aria-hidden="true"
          />
          <div
            className="absolute left-[16.67%] right-[16.67%] top-7 h-px bg-gradient-to-r from-accent/0 via-accent/40 to-accent/0 sm:top-8"
            aria-hidden="true"
          />
          <span
            ref={dot}
            aria-hidden="true"
            className="absolute top-7 z-20 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary-text shadow-[0_0_18px_4px_rgb(94_162_236/0.7)] sm:top-8"
            style={{ left: `${s.from}%` }}
          />
          <div className="grid grid-cols-3">
            <Node icon={Monitor} name="Client" active={lit("client")} />
            <Node icon={Server} name="Server" active={lit("server")} />
            <Node
              icon={Landmark}
              name="Facilitator"
              active={lit("facilitator")}
            />
          </div>
        </div>

        <p
          className="mt-6 min-h-6 text-center font-mono text-xs text-secondary-text sm:text-sm"
          aria-hidden="true"
        >
          {s.label}
        </p>

        <div className="relative mt-4 flex flex-col items-center">
          <span
            className={`h-8 w-px border-l border-dashed transition-colors duration-500 ${s.watch ? "border-accent-text" : "border-border"}`}
            aria-hidden="true"
          />
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all duration-500 ${
              s.watch
                ? "border-accent-text/60 bg-accent-dim text-accent-text shadow-[0_0_32px_-6px_rgb(139_107_192/0.8)]"
                : "border-border bg-surface/60 text-muted"
            }`}
          >
            <Eye className="size-4" aria-hidden="true" />
            MicroAI, read-only
          </span>
          <p className="mt-2 text-center text-xs text-muted">
            Watches from the side. Never in the payment path.
          </p>
        </div>
      </div>

      <div className="relative z-10">
        <ol className="space-y-1.5" aria-label="Steps of an x402 payment">
          {STEPS.map((st, i) => {
            const on = i === step;
            return (
              <li key={st.title}>
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  aria-current={on ? "step" : undefined}
                  className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-300 ${
                    on
                      ? "border-accent/40 bg-accent-dim"
                      : "border-transparent hover:bg-surface-raised/60"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] ${
                      on
                        ? "border-accent-text text-accent-text"
                        : "border-border text-muted"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={`min-w-0 text-sm font-medium ${on ? "text-text" : "text-text/80"}`}
                  >
                    {st.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {/* All texts share one cell, so the box is as tall as the longest one and never changes size. */}
        <div
          className="mt-3 grid rounded-xl border border-border/60 bg-surface/40 px-4 py-3"
          aria-live="polite"
        >
          {STEPS.map((st, i) => (
            <p
              key={st.title}
              aria-hidden={i !== step}
              className={`col-start-1 row-start-1 text-xs leading-relaxed text-muted transition-opacity duration-300 sm:text-sm ${i === step ? "opacity-100" : "opacity-0"}`}
            >
              {st.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
