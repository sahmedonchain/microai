"use client";
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { TabId } from "@/app/components/tabs/TabNav";
import { NAV_GROUPS, NAV_ITEMS, groupOfPanel, itemsOfGroup, type NavGroup, type NavItem } from "@/lib/navConfig";

// Sidebar menu: one standalone entry (Chat) plus collapsible groups, all driven
// by lib/navConfig.ts. Expanded mode shows accordion groups; icon-only mode
// shows one icon per group with a flyout menu.

interface SidebarNavProps {
  activePanel: TabId;
  openGroups: readonly string[];
  onToggleGroup: (groupId: string) => void;
  onSelectPanel: (panel: TabId) => void;
  // Icon-only mode (desktop collapsed sidebar).
  collapsed?: boolean;
  // Called after any item is chosen (the mobile drawer closes itself).
  onNavigate?: () => void;
}

const ITEM_BASE = "flex w-full items-center rounded-lg border-l-2 py-2 text-sm transition";
const ITEM_ACTIVE = "border-accent bg-accent-dim text-accent-text";
const ITEM_IDLE = "border-transparent text-muted hover:bg-surface-raised hover:text-text";

function itemClass(active: boolean, extra: string) {
  return `${ITEM_BASE} ${extra} ${active ? ITEM_ACTIVE : ITEM_IDLE}`;
}

function ItemRow({
  item,
  active,
  indent,
  onSelectPanel,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  indent: boolean;
  onSelectPanel: (panel: TabId) => void;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const spacing = indent ? "gap-3 pl-9 pr-3 text-left" : "gap-3 px-3 text-left";
  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer"
        onClick={onNavigate}
        className={itemClass(false, `${spacing} justify-between`)}
      >
        <span className="flex min-w-0 items-center gap-3">
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{item.label}</span>
        </span>
        <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    );
  }
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={() => {
        onSelectPanel(item.panel);
        onNavigate?.();
      }}
      className={itemClass(active, spacing)}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

function ExpandedGroup({
  group,
  open,
  activePanel,
  onToggle,
  onSelectPanel,
  onNavigate,
  reduceMotion,
}: {
  group: NavGroup;
  open: boolean;
  activePanel: TabId;
  onToggle: () => void;
  onSelectPanel: (panel: TabId) => void;
  onNavigate?: () => void;
  reduceMotion: boolean;
}) {
  const uid = useId();
  const headerId = `${uid}-header`;
  const panelId = `${uid}-panel`;
  const items = itemsOfGroup(group.id);
  const holdsActive = groupOfPanel(activePanel) === group.id;
  const Icon = group.icon;

  return (
    <div>
      <button
        type="button"
        id={headerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-surface-raised ${
          holdsActive && !open ? "text-accent-text" : "text-muted hover:text-text"
        }`}
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate">{group.label}</span>
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden="true" />
      </button>
      {/* initial={false}: the first paint is already in its final state, so a
          reload never animates. */}
      <motion.div
        id={panelId}
        role="group"
        aria-labelledby={headerId}
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
        className="overflow-hidden"
        inert={!open}
      >
        <div className="flex flex-col gap-0.5 pb-1 pt-0.5">
          {items.map((item) => (
            <ItemRow
              key={item.label}
              item={item}
              indent
              active={item.panel === activePanel}
              onSelectPanel={onSelectPanel}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function CollapsedGroup({
  group,
  activePanel,
  onSelectPanel,
  onNavigate,
}: {
  group: NavGroup;
  activePanel: TabId;
  onSelectPanel: (panel: TabId) => void;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uid = useId();
  const items = itemsOfGroup(group.id);
  const holdsActive = groupOfPanel(activePanel) === group.id;
  const Icon = group.icon;

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.top, left: rect.right + 8 });
    setOpen(true);
  };
  const hideSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  return (
    <div ref={wrapRef} onMouseEnter={show} onMouseLeave={hideSoon}>
      <button
        ref={buttonRef}
        type="button"
        title={group.label}
        aria-label={group.label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${uid}-flyout`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className={`flex w-full items-center justify-center rounded-lg border-l-2 py-2 text-sm transition ${
          holdsActive ? ITEM_ACTIVE : ITEM_IDLE
        }`}
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={`${uid}-flyout`}
            role="menu"
            aria-label={group.label}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            style={{ top: pos.top, left: pos.left }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                buttonRef.current?.focus();
              }
            }}
            className="fixed z-50 w-56 rounded-lg border border-border bg-surface-raised p-1 shadow-lg"
          >
            <p className="px-3 pb-1 pt-1.5 text-xs font-medium text-muted">{group.label}</p>
            {items.map((item) => {
              const Item = item.icon;
              const active = item.panel === activePanel;
              if (item.external) {
                return (
                  <a
                    key={item.label}
                    role="menuitem"
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      setOpen(false);
                      onNavigate?.();
                    }}
                    className={itemClass(false, "justify-between gap-3 px-3 text-left")}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Item className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                );
              }
              return (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    onSelectPanel(item.panel);
                    setOpen(false);
                    onNavigate?.();
                  }}
                  className={itemClass(active, "gap-3 px-3 text-left")}
                >
                  <Item className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SidebarNav({ activePanel, openGroups, onToggleGroup, onSelectPanel, collapsed = false, onNavigate }: SidebarNavProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const standalone = NAV_ITEMS.filter((i) => !i.group);

  if (collapsed) {
    return (
      <nav className="flex flex-col gap-1 px-1.5 py-4" aria-label="Sections">
        {standalone.map((item) => {
          const Icon = item.icon;
          const active = item.panel === activePanel;
          return (
            <button
              key={item.label}
              type="button"
              title={item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              onClick={() => {
                if (item.panel) onSelectPanel(item.panel);
                onNavigate?.();
              }}
              className={`flex w-full items-center justify-center rounded-lg border-l-2 py-2 text-sm transition ${active ? ITEM_ACTIVE : ITEM_IDLE}`}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
            </button>
          );
        })}
        {NAV_GROUPS.map((group) => (
          <CollapsedGroup key={group.id} group={group} activePanel={activePanel} onSelectPanel={onSelectPanel} onNavigate={onNavigate} />
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-1 px-3 py-4" aria-label="Sections">
      {standalone.map((item) => (
        <ItemRow key={item.label} item={item} indent={false} active={item.panel === activePanel} onSelectPanel={onSelectPanel} onNavigate={onNavigate} />
      ))}
      {NAV_GROUPS.map((group) => (
        <ExpandedGroup
          key={group.id}
          group={group}
          open={openGroups.includes(group.id)}
          activePanel={activePanel}
          onToggle={() => onToggleGroup(group.id)}
          onSelectPanel={onSelectPanel}
          onNavigate={onNavigate}
          reduceMotion={reduceMotion}
        />
      ))}
    </nav>
  );
}
