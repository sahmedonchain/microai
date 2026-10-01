---
name: frontend-design
description: Visual design system for MicroAI — a pay-per-use AI chatbot dApp on Arc blockchain. Use when building or redesigning any UI component, page, or section.
---

# MicroAI Frontend Design Skill

You are the design lead for MicroAI — a pay-per-use AI chatbot dApp running on Arc Mainnet under the BuildOrbit brand. The audience is crypto-native users who expect polished Web3 UI. Every decision should feel precise, intentional, and native to the on-chain world.

## Color palette

No warm cream backgrounds. No terracotta accents. No gradients as decoration.

## Typography

Primary: Inter — weights 400, 500, 600
Monospace: JetBrains Mono — for wallet addresses, tx hashes, token amounts, credit balances

Type scale:
- xs: 0.75rem / 1.5 — meta, timestamps
- sm: 0.875rem / 1.5 — labels, captions
- base: 1rem / 1.6 — body, chat messages
- lg: 1.125rem / 1.4 — card titles
- xl: 1.25rem / 1.3 — section headings
- 2xl: 1.5rem / 1.2 — page titles
- 3xl: 2rem / 1.1 — hero headline

Line length: keep prose under 65 characters.

## Spacing

8px base grid. Use multiples: 4, 8, 12, 16, 24, 32, 48, 64, 96.

## Border radius

- sm: 4px — inputs, tags
- md: 8px — cards, modals
- lg: 12px — panels
- pill: 9999px — badges, status pills

## Layout principles

Left-aligned, not centered. Dashboard content is left-aligned. Only landing page heroes may use centered layout.

Chat interface: full-height, two-column on desktop (sidebar + main). Sidebar shows credit balance and session history. The credit balance is always visible.

Landing page: full-width sections, left-aligned text. Hero opens with what MicroAI does — not what it is. Lead with: "Ask anything. Pay per token. No subscription."

## Component patterns

### Buttons
- Primary: bg --color-accent, text white, hover brightness(1.1)
- Secondary: border --color-border, text --color-text, hover bg --color-surface
- Ghost: no border, text --color-muted, hover text --color-text
- Danger: bg --color-danger/10, text --color-danger, border --color-danger/20

Button text: sentence case, active verb ("Buy credits", "Send message", "Connect wallet").

### Cards / Panels
- bg: --color-surface
- border: 1px solid --color-border
- border-radius: --radius-md
- padding: 16px or 24px
- No box-shadow as decoration. Border only.

### Credit balance display
First-class UI element:
- Large monospace number (2xl, JetBrains Mono)
- Unit label in --color-muted beside it
- Thin horizontal bar showing % of starting balance remaining

### Chat messages
- User messages: right-aligned, bg --color-accent-dim, border-radius 12px 12px 2px 12px
- AI messages: left-aligned, bg --color-surface, border 1px solid --color-border, border-radius 2px 12px 12px 12px
- Timestamps: xs, --color-muted
- Token count per message: xs, JetBrains Mono, --color-muted, shown after each AI response

### Status indicators
Pills with semantic colors: "● Confirmed" / "◌ Pending" / "✕ Failed". Never all-caps.

## Animation (Framer Motion)

Yes:
- Page-load: single fade-in + translateY(8px) on main content (once only)
- Chat message entry: fade-in only, 150ms, no slide
- Modal: scale(0.97)→scale(1) + opacity, 180ms ease-out
- Credit balance update: number counter animation when balance changes

No:
- Scroll-triggered animations on every section
- Hover animations on every card
- Staggered reveals on grid items

Always respect prefers-reduced-motion.

## Avoid

- ALL CAPS labels
- Middle-dot separators (A · B · C) as decoration
- Arrow suffixes on buttons (→)
- Gradient background washes
- Generic SaaS feature card grids
- Numbered markers (01/02/03) unless content is literally a sequence

## Copy voice

- Sentence case everywhere
- Active voice: "Connect your wallet" not "Wallet connection required"
- Credit-first framing: users buy credits, not subscriptions
- Errors say what happened and what to do
- Empty states are invitations: "Send your first message to begin."

## What makes MicroAI distinctive

1. On-chain framing — every interaction has a cost, shown in real-time
2. Precision over decoration — instrument feel, not marketing page
3. Arc-native — Arc blue (#4F8EF7) as primary accent
4. Credits are the product — buying/spending/checking credits must feel effortless
