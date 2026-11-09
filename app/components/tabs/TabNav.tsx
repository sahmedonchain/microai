"use client";
import { createContext, useContext, type AnchorHTMLAttributes } from "react";

export type TabId =
  | "home"
  | "verify"
  | "inspect"
  | "lab"
  | "trust"
  | "chat"
  | "ecosystem"
  | "build-status"
  | "stats"
  | "news"
  | "copilot"
  | "wallet"
  | "debugger"
  | "credits";

const HREF_TO_TAB: Record<string, TabId> = {
  "/": "home",
  "/verify": "verify",
  "/inspect": "inspect",
  "/lab": "lab",
  "/trust": "trust",
  "/chat": "chat",
  "/ecosystem": "ecosystem",
  "/build-status": "build-status",
  "/stats": "stats",
  "/news": "news",
  "/build": "copilot",
  "/wallet": "wallet",
  "/debug": "debugger",
  "/credits": "credits",
};

export const TabNavContext = createContext<((tab: TabId) => void) | null>(null);

// Drop-in replacement for next/link inside tab content: internal hrefs
// switch the active tab instead of navigating. Keeps a real href so
// modified clicks (new tab, copy link) still reach the standalone route.
// Outside a TabNavContext provider it is a plain link.
export function TabLink({ href, onClick, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const goTo = useContext(TabNavContext);
  const tab = HREF_TO_TAB[href];
  return (
    <a
      href={href}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (!goTo || !tab || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        goTo(tab);
      }}
    >
      {children}
    </a>
  );
}
