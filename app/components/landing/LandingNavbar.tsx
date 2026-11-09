"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { WalletModal } from "@/app/components/WalletModal";
import { truncateAddress } from "@/lib/format";

// MicroAI mark: split "M" on a dark tile with a cyan → blue → violet gradient.
// Same artwork as app/icon.svg (the browser favicon).
export function LogoMark({ className = "" }: { className?: string }) {
  const uid = useId();
  const mark = `${uid}-mark`;
  const border = `${uid}-border`;
  const bg = `${uid}-bg`;
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={mark} gradientUnits="userSpaceOnUse" x1="222" y1="441" x2="548" y2="197">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset="0.5" stopColor="#1D4FFF" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
        <linearGradient id={border} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
        <radialGradient id={bg} cx="50%" cy="40%" r="75%">
          <stop offset="0" stopColor="#0E1530" />
          <stop offset="1" stopColor="#050816" />
        </radialGradient>
      </defs>
      <rect x="8" y="8" width="496" height="496" rx="112" fill={`url(#${bg})`} stroke={`url(#${border})`} strokeWidth="6" />
      <g
        transform="translate(-71.25 -15.15) scale(0.85)"
        fill={`url(#${mark})`}
        stroke={`url(#${mark})`}
        strokeWidth="6"
        strokeLinejoin="round"
      >
        <polygon points="222,197 362,277 367,285 367,385 307,385 307,345 222,272" />
        <polygon points="222,328 307,385 307,441 222,441" />
        <polygon points="548,197 408,277 403,285 403,385 463,385 463,345 548,272" />
        <polygon points="548,328 463,385 463,441 548,441" />
      </g>
    </svg>
  );
}

export function LandingNavbar() {
  const [modalOpen, setModalOpen] = useState(false);
  const [address, setAddress] = useState<string | null>(null);

  // Modal renders outside <header>: its backdrop-filter would otherwise
  // become the containing block for the modal's fixed overlay.
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-space/85 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3" aria-label="MicroAI home">
            <LogoMark className="size-8 shrink-0" />
            <span className="flex flex-col leading-tight">
              <span className="text-base font-semibold text-text">MicroAI</span>
              <span className="hidden text-xs text-muted sm:block">by BuildOrbit on Arc</span>
            </span>
          </Link>

          {address ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 font-mono text-sm text-text">
              <span className="size-2 rounded-full bg-success" aria-hidden="true" />
              {truncateAddress(address)}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Connect wallet
            </button>
          )}
        </nav>
      </header>

      <AnimatePresence>
        {modalOpen && (
          <WalletModal
            onConnect={(addr) => {
              setAddress(addr);
              setModalOpen(false);
            }}
            onClose={() => setModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
