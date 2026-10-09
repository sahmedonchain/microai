"use client";
import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { LogoMark } from "@/app/components/landing/LandingNavbar";
import { WalletModal } from "@/app/components/WalletModal";
import { truncateAddress } from "@/lib/format";
import { TabNavContext, type TabId } from "@/app/components/tabs/TabNav";
import { HomeTab } from "@/app/components/tabs/HomeTab";
import { EcosystemTab } from "@/app/components/tabs/EcosystemTab";
import { GrantsTab } from "@/app/components/tabs/GrantsTab";
import { BuildStatusTab } from "@/app/components/tabs/BuildStatusTab";
import { StatsTab } from "@/app/components/tabs/StatsTab";
import { NewsTab } from "@/app/components/tabs/NewsTab";
import { CopilotTab } from "@/app/components/tabs/CopilotTab";
import { WalletTab } from "@/app/components/tabs/WalletTab";
import { DebuggerTab } from "@/app/components/tabs/DebuggerTab";
import { CreditsTab } from "@/app/components/tabs/CreditsTab";

const TABS: { id: TabId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "ecosystem", label: "Ecosystem" },
  { id: "grants", label: "Grants" },
  { id: "build-status", label: "Build status" },
  { id: "stats", label: "Stats" },
  { id: "news", label: "News" },
  { id: "copilot", label: "Copilot" },
  { id: "wallet", label: "Wallet" },
  { id: "debugger", label: "Debugger" },
  { id: "credits", label: "Credits" },
];

export function TabShell() {
  const [active, setActive] = useState<TabId>("home");
  const [modalOpen, setModalOpen] = useState(false);
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [active]);

  return (
    <TabNavContext.Provider value={setActive}>
      <div className="min-h-screen bg-space font-sans text-text">
        <header className="sticky top-0 z-50 border-b border-border bg-space/85 backdrop-blur-md">
          <nav className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6" aria-label="Main">
            <button
              type="button"
              onClick={() => setActive("home")}
              aria-label="MicroAI home"
              className="flex shrink-0 items-center gap-3"
            >
              <LogoMark className="size-8" />
              <span className="text-base font-semibold text-text">MicroAI</span>
            </button>

            <div className="flex flex-1 items-center gap-1 overflow-x-auto" role="tablist" aria-label="Sections">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active === tab.id}
                  onClick={() => setActive(tab.id)}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
                    active === tab.id
                      ? "bg-accent-dim font-medium text-accent-text"
                      : "text-muted hover:bg-surface hover:text-text"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {address ? (
              <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 font-mono text-sm text-text">
                <span className="size-2 rounded-full bg-success" aria-hidden="true" />
                {truncateAddress(address)}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Connect wallet
              </button>
            )}
          </nav>
        </header>

        <main role="tabpanel">
          {active === "home" && <HomeTab />}
          {active === "ecosystem" && <EcosystemTab />}
          {active === "grants" && <GrantsTab />}
          {active === "build-status" && <BuildStatusTab />}
          {active === "stats" && <StatsTab />}
          {active === "news" && <NewsTab />}
          {active === "copilot" && <CopilotTab />}
          {active === "wallet" && <WalletTab />}
          {active === "debugger" && <DebuggerTab />}
          {active === "credits" && <CreditsTab />}
        </main>

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
      </div>
    </TabNavContext.Provider>
  );
}
