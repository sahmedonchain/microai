"use client";
import { createContext, useContext, type AnchorHTMLAttributes } from "react";

export type TabId =
  | "home"
  | "ecosystem"
  | "grants"
  | "build-status"
  | "stats"
  | "news"
  | "copilot"
  | "wallet"
  | "debugger"
  | "credits";

const HREF_TO_TAB: Record<string, TabId> = {
  "/": "home",
  "/chat": "home",
  "/ecosystem": "ecosystem",
  "/grants": "grants",
  "/build-status": "build-status",
  "/stats": "stats",
  "/news": "news",
  "/build": "copilot",
  "/wallet": "wallet",
  "/debug": "debugger",
  "/credits": "credits",
};

export const TabNavContext = createContext<(tab: TabId) => void>(() => {});

// Drop-in replacement for next/link inside tab content: internal hrefs
// switch the active tab instead of navigating. Keeps a real href so
// modified clicks (new tab, copy link) still reach the standalone route.
export function TabLink({ href, onClick, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const goTo = useContext(TabNavContext);
  const tab = HREF_TO_TAB[href];
  return (
    <a
      href={href}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (!tab || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        goTo(tab);
      }}
    >
      {children}
    </a>
  );
}
