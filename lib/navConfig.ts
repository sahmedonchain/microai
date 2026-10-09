import {
  Activity,
  BarChart3,
  BookOpen,
  Bug,
  Coins,
  Code2,
  Compass,
  Gift,
  Globe,
  Hammer,
  MessageSquare,
  Newspaper,
  User,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { TabId } from "@/app/components/tabs/TabNav";

// The whole sidebar menu lives here. To add an entry, add one object to
// NAV_ITEMS (and, for a new group, one object to NAV_GROUPS). Items without a
// `group` are standalone and always visible at the top.
//
// In-app items open a panel (`panel`); external items open `href` in a new tab.

export interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
}

export type NavItem = {
  label: string;
  icon: LucideIcon;
  group?: NavGroup["id"];
} & ({ panel: TabId; href?: undefined; external?: undefined } | { href: string; external: true; panel?: undefined });

export const NAV_GROUPS: readonly NavGroup[] = [
  { id: "build", label: "Build", icon: Wrench },
  { id: "analyze", label: "Analyze", icon: Activity },
  { id: "ecosystem", label: "Ecosystem", icon: Globe },
  { id: "account", label: "Account", icon: User },
  { id: "developer", label: "Developer resources", icon: BookOpen },
];

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Chat", icon: MessageSquare, panel: "home" },

  { group: "build", label: "Copilot", icon: Code2, panel: "copilot" },
  { group: "build", label: "Debug", icon: Bug, panel: "debugger" },

  { group: "analyze", label: "Wallet", icon: Wallet, panel: "wallet" },
  { group: "analyze", label: "Stats", icon: BarChart3, panel: "stats" },

  { group: "ecosystem", label: "Ecosystem", icon: Compass, panel: "ecosystem" },
  { group: "ecosystem", label: "Grants", icon: Gift, panel: "grants" },
  { group: "ecosystem", label: "News", icon: Newspaper, panel: "news" },
  { group: "ecosystem", label: "Build status", icon: Hammer, panel: "build-status" },

  { group: "account", label: "Credits", icon: Coins, panel: "credits" },

  { group: "developer", label: "Arc Developer Docs", icon: BookOpen, href: "https://arc.io/docs", external: true },
  { group: "developer", label: "Circle Documentation", icon: BookOpen, href: "https://circle.com/docs", external: true },
  { group: "developer", label: "USDC Resources", icon: BookOpen, href: "https://www.circle.com/usdc", external: true },
];

export const NAV_GROUPS_COOKIE = "microai_nav_groups";

const GROUP_IDS = new Set(NAV_GROUPS.map((g) => g.id));

export function isPanelId(value: string | undefined): value is TabId {
  // External items have no panel, so undefined must not match them.
  return value !== undefined && NAV_ITEMS.some((i) => i.panel === value);
}

export function groupOfPanel(panel: TabId): NavGroup["id"] | undefined {
  return NAV_ITEMS.find((i) => i.panel === panel)?.group;
}

export function itemsOfGroup(groupId: string): NavItem[] {
  return NAV_ITEMS.filter((i) => i.group === groupId);
}

// Cookie value: comma-separated ids of the groups the user left open.
// Unknown ids are dropped, so a stale cookie can never break the menu.
export function parseOpenGroups(value: string | undefined): string[] {
  if (!value) return [];
  return [...new Set(decodeURIComponent(value).split(",").filter((id) => GROUP_IDS.has(id)))];
}

export function serializeOpenGroups(open: readonly string[]): string {
  return encodeURIComponent(open.filter((id) => GROUP_IDS.has(id)).join(","));
}

// Groups to show open on first render. The group holding the current page is
// always open so its highlighted item is visible; server and client compute
// this from the same cookie value, so there is no jump after hydration.
export function initialOpenGroups(cookieValue: string | undefined, activePanel: TabId): string[] {
  const open = new Set(parseOpenGroups(cookieValue));
  const active = groupOfPanel(activePanel);
  if (active) open.add(active);
  return [...open];
}
