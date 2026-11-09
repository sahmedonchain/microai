"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { TabLink as Link, TabNavContext, type TabId } from "@/app/components/tabs/TabNav";
import { EcosystemTab } from "@/app/components/tabs/EcosystemTab";
import { OverviewTab } from "@/app/components/tabs/OverviewTab";
import { VerifyClient } from "@/app/components/VerifyClient";
import { LabClient } from "@/app/components/LabClient";
import { TrustClient } from "@/app/components/TrustClient";
import { BuildStatusTab } from "@/app/components/tabs/BuildStatusTab";
import { StatsTab } from "@/app/components/tabs/StatsTab";
import { NewsTab } from "@/app/components/tabs/NewsTab";
import { WalletTab } from "@/app/components/tabs/WalletTab";
import { DebuggerTab } from "@/app/components/tabs/DebuggerTab";
import { AnimatePresence, motion } from "framer-motion";
import { SidebarNav } from "@/app/components/SidebarNav";
import { LegalLinks } from "@/app/components/LegalLinks";
import { NAV_GROUPS_COOKIE, groupOfPanel, initialOpenGroups, isPanelId, serializeOpenGroups } from "@/lib/navConfig";
import { ChevronRight, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { LogoMark } from "@/app/components/landing/LandingNavbar";

// Loaded on demand: it pulls in the Verify checks (and ethers), which the other panels do not need.
const InspectorClient = dynamic(() => import("@/app/components/InspectorClient").then((m) => m.InspectorClient), { ssr: false });

// UI state lives in cookies, not localStorage, so app/page.tsx can read it on
// the server and the very first paint already shows the right panel and
// sidebar width. Restoring it after mount made the highlight (and the
// sidebar) visibly jump on reload.
const ACTIVE_PANEL_COOKIE = "microai_active_tab";
const SIDEBAR_COLLAPSED_COOKIE = "microai_sidebar_collapsed";

function saveUiCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

function parsePanel(value: string | undefined): TabId {
  return isPanelId(value) ? value : "home";
}

export function HomeTab({
  initialPanel,
  initialSidebarCollapsed = false,
  initialNavGroups,
}: {
  initialPanel?: string;
  initialSidebarCollapsed?: boolean;
  initialNavGroups?: string;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarCollapsed);
  const [activePanel, setActivePanel] = useState<TabId>(() => parsePanel(initialPanel));
  // Open menu groups come from a cookie the server also read, so the first
  // paint already has the right groups open (no jump after hydration).
  const [openGroups, setOpenGroups] = useState<string[]>(() => initialOpenGroups(initialNavGroups, parsePanel(initialPanel)));
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const saveOpenGroups = (next: string[]) => saveUiCookie(NAV_GROUPS_COOKIE, serializeOpenGroups(next));
  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id];
      saveOpenGroups(next);
      return next;
    });
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      saveUiCookie(SIDEBAR_COLLAPSED_COOKIE, next ? "1" : "0");
      return next;
    });
  };

  const goToPanel = (tab: TabId) => {
    setActivePanel(tab);
    saveUiCookie(ACTIVE_PANEL_COOKIE, tab);
    // Opening a page from anywhere (menu, in-page link) reveals its group.
    const group = groupOfPanel(tab);
    if (group) {
      setOpenGroups((prev) => {
        if (prev.includes(group)) return prev;
        const next = [...prev, group];
        saveOpenGroups(next);
        return next;
      });
    }
  };
  const selectFromMenu = goToPanel;

  // Mobile drawer: Escape closes it, growing past the breakpoint closes it,
  // and focus returns to the menu button.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileNavOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => { if (mq.matches) setMobileNavOpen(false); };
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onChange);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onChange);
    };
  }, [mobileNavOpen]);

  return (
    <TabNavContext.Provider value={goToPanel}>
    <div className="relative flex h-dvh overflow-hidden bg-space font-sans text-text">
      {/* LEFT SIDEBAR */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 52 : 256 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="hidden shrink-0 overflow-hidden border-r border-border bg-surface md:flex"
      >
        <div className="flex w-full min-w-0 shrink-0 flex-col">
        <div className={`flex items-center border-b border-border ${sidebarCollapsed ? "justify-center px-2 py-5" : "justify-between gap-2 px-5 py-5"}`}>
          {!sidebarCollapsed && (
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <LogoMark className="size-8 shrink-0" />
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-semibold text-text">MicroAI</span>
                <span className="text-xs text-muted">Build on Arc</span>
              </span>
            </Link>
          )}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="shrink-0 rounded-md p-1.5 text-muted transition hover:bg-surface-raised hover:text-text"
          >
            {sidebarCollapsed ? <PanelLeftOpen className="size-4" aria-hidden="true" /> : <PanelLeftClose className="size-4" aria-hidden="true" />}
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <SidebarNav
            activePanel={activePanel}
            openGroups={openGroups}
            onToggleGroup={toggleGroup}
            onSelectPanel={selectFromMenu}
            collapsed={sidebarCollapsed}
          />
        {!sidebarCollapsed && (
        <div className="m-4 mt-auto rounded-lg border border-accent/20 bg-accent-dim p-4">
          <LogoMark className="size-6" />
          <p className="mt-2 text-sm font-semibold text-text">Explore. Build. Earn.</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            The best place for builders, founders and crypto natives on Arc.
          </p>
          <Link href="/ecosystem" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent-text hover:underline">
            Learn more <ChevronRight className="size-3" aria-hidden="true" />
          </Link>
        </div>
        )}
        {!sidebarCollapsed && <LegalLinks className="-mt-2 px-5 pb-4" />}
        </div>
        </div>
      </motion.aside>

      {/* CENTER + RIGHT */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* TOP BAR */}
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileNavOpen}
              className="-ml-1 shrink-0 rounded-md p-1.5 text-muted transition hover:bg-surface-raised hover:text-text md:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
            <LogoMark className="size-7 shrink-0" />
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-text">MicroAI</span>
              <span className="hidden text-xs text-muted sm:block">Payment & integration tools for Arc</span>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-accent/25 bg-accent-dim px-3 py-1.5 text-xs text-accent-text sm:inline-flex">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-text opacity-75" aria-hidden="true" />
                <span className="relative inline-flex size-1.5 rounded-full bg-accent-text" aria-hidden="true" />
              </span>
              Arc Mainnet
            </span>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {activePanel === "home" && <OverviewTab />}
          {activePanel === "verify" && <VerifyClient embedded />}
          {activePanel === "inspect" && <InspectorClient embedded />}
          {activePanel === "lab" && <LabClient embedded />}
          {activePanel === "trust" && <TrustClient />}
          {activePanel === "debugger" && <DebuggerTab />}
          {activePanel === "wallet" && <WalletTab />}
          {activePanel === "stats" && <StatsTab />}
          {activePanel === "ecosystem" && <EcosystemTab />}
          {activePanel === "news" && <NewsTab />}
          {activePanel === "build-status" && <BuildStatusTab />}
        </div>
      </div>

            <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              key="nav-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setMobileNavOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              aria-hidden="true"
            />
            <motion.aside
              key="nav-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface md:hidden"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-5">
                <div className="flex min-w-0 items-center gap-3">
                  <LogoMark className="size-8 shrink-0" />
                  <span className="flex flex-col leading-tight">
                    <span className="text-sm font-semibold text-text">MicroAI</span>
                    <span className="text-xs text-muted">Build on Arc</span>
                  </span>
                </div>
                <button
                  type="button"
                  autoFocus
                  onClick={() => { setMobileNavOpen(false); menuButtonRef.current?.focus(); }}
                  aria-label="Close menu"
                  className="shrink-0 rounded-md p-1.5 text-muted transition hover:bg-surface-raised hover:text-text"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <SidebarNav
                  activePanel={activePanel}
                  openGroups={openGroups}
                  onToggleGroup={toggleGroup}
                  onSelectPanel={selectFromMenu}
                  onNavigate={() => setMobileNavOpen(false)}
                />
              </div>
              <div className="shrink-0 border-t border-border px-5 py-3">
                <LegalLinks />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
    </TabNavContext.Provider>
  );
}
