import { describe, it, expect } from "vitest";
import {
  NAV_GROUPS,
  NAV_ITEMS,
  groupOfPanel,
  initialOpenGroups,
  isPanelId,
  itemsOfGroup,
  parseOpenGroups,
  serializeOpenGroups,
} from "@/lib/navConfig";

describe("menu config", () => {
  it("has the requested structure and order", () => {
    const shape = [
      ...NAV_ITEMS.filter((i) => !i.group).map((i) => i.label),
      ...NAV_GROUPS.map((g) => `${g.label}: ${itemsOfGroup(g.id).map((i) => i.label).join(", ")}`),
    ];
    expect(shape).toEqual([
      "Chat",
      "Build: Copilot, Debug",
      "Analyze: Wallet, Stats",
      "Ecosystem: Ecosystem, Grants, News, Build status",
      "Account: Credits",
      "Developer resources: Arc Developer Docs, Circle Documentation, USDC Resources",
    ]);
  });

  it("every grouped item names an existing group, and every group has items", () => {
    const ids = new Set(NAV_GROUPS.map((g) => g.id));
    for (const item of NAV_ITEMS) if (item.group) expect(ids.has(item.group), item.label).toBe(true);
    for (const g of NAV_GROUPS) expect(itemsOfGroup(g.id).length, g.id).toBeGreaterThan(0);
  });

  it("in-app items open a unique panel; external items are https links", () => {
    const panels = NAV_ITEMS.flatMap((i) => (i.panel ? [i.panel] : []));
    expect(new Set(panels).size).toBe(panels.length);
    for (const item of NAV_ITEMS.filter((i) => i.external)) {
      expect(item.href).toMatch(/^https:\/\//);
      expect(item.panel).toBeUndefined();
    }
    expect(panels.sort()).toEqual(["build-status", "copilot", "credits", "debugger", "ecosystem", "grants", "home", "news", "stats", "wallet"]);
  });

  it("labels are unique (they are used as React keys)", () => {
    const labels = NAV_ITEMS.map((i) => i.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("finds the group of a panel", () => {
    expect(groupOfPanel("debugger")).toBe("build");
    expect(groupOfPanel("stats")).toBe("analyze");
    expect(groupOfPanel("build-status")).toBe("ecosystem");
    expect(groupOfPanel("credits")).toBe("account");
    expect(groupOfPanel("home")).toBeUndefined();
  });

  it("validates panel ids", () => {
    expect(isPanelId("wallet")).toBe(true);
    expect(isPanelId("nope")).toBe(false);
    expect(isPanelId(undefined)).toBe(false);
  });
});

describe("open-groups cookie", () => {
  it("round-trips known group ids", () => {
    expect(parseOpenGroups(serializeOpenGroups(["build", "account"]))).toEqual(["build", "account"]);
  });
  it("drops unknown ids, duplicates and junk", () => {
    expect(parseOpenGroups("build,evil,build,,account")).toEqual(["build", "account"]);
    expect(parseOpenGroups(undefined)).toEqual([]);
    expect(parseOpenGroups("")).toEqual([]);
  });
  it("always opens the group of the current page, on top of the remembered ones", () => {
    expect(initialOpenGroups(undefined, "wallet")).toEqual(["analyze"]);
    expect(initialOpenGroups("build", "wallet").sort()).toEqual(["analyze", "build"]);
    expect(initialOpenGroups("analyze", "wallet")).toEqual(["analyze"]);
  });
  it("opens nothing extra for the standalone Chat page", () => {
    expect(initialOpenGroups(undefined, "home")).toEqual([]);
    expect(initialOpenGroups("developer", "home")).toEqual(["developer"]);
  });
  it("keeps a group closed when the user closed it and the page is elsewhere", () => {
    expect(initialOpenGroups("", "wallet")).not.toContain("build");
  });
});
