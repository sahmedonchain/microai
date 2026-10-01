"use client";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { WalletModal } from "@/app/components/WalletModal";
import { truncateAddress } from "@/lib/format";

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="8" fill="var(--color-accent)" />
      <ellipse
        cx="16"
        cy="16"
        rx="10"
        ry="4.5"
        fill="none"
        stroke="white"
        strokeOpacity="0.55"
        strokeWidth="1.5"
        transform="rotate(-30 16 16)"
      />
      <circle cx="16" cy="16" r="3.5" fill="white" />
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
