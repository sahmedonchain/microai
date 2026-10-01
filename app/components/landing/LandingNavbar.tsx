"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { WalletModal } from "@/app/components/WalletModal";
import { truncateAddress } from "@/lib/format";

// M monogram: two overlapping arcs forming an "M", on an Arc violet → Circle
// blue gradient. Abstract, geometric, reads clean at favicon size.
export function LogoMark({ className = "" }: { className?: string }) {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-accent)" />
          <stop offset="100%" stopColor="var(--color-secondary)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradientId})`} />
      <path d="M8 23 V10 A4 4 0 0 1 16 10 V23" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 23 V10 A4 4 0 0 1 24 10 V23" fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="2.4" strokeLinecap="round" />
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
