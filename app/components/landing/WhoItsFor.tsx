import { Code, Coins, Hammer, Landmark, type LucideIcon } from "lucide-react";

const ROLES: { name: string; icon: LucideIcon; pitch: string; ask: string }[] = [
  {
    name: "Developers",
    icon: Code,
    pitch: "Ship on Arc faster. Get contract answers, SDK examples and revert debugging on demand.",
    ask: "Why does my USDC transfer revert on Arc?",
  },
  {
    name: "Builders",
    icon: Hammer,
    pitch: "Find grants, track what other teams are shipping and get unblocked on your next milestone.",
    ask: "Which Arc projects are hiring contributors?",
  },
  {
    name: "Fintech startups",
    icon: Landmark,
    pitch: "Understand USDC settlement, CCTP and compliance options before you commit engineering time.",
    ask: "How do I settle cross-border payouts with CCTP?",
  },
  {
    name: "Crypto natives",
    icon: Coins,
    pitch: "Follow Arc ecosystem stats, TVL and new protocols without digging through five dashboards.",
    ask: "Which Arc protocols gained the most TVL this week?",
  },
];

export function WhoItsFor() {
  return (
    <section className="border-b border-border" aria-labelledby="who-heading">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <h2 id="who-heading" className="text-2xl font-semibold leading-tight text-text">
          Built for everyone on Arc
        </h2>
        <p className="mt-3 max-w-[60ch] text-base text-muted">
          Pick your role. MicroAI answers in the context of what you are building.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map(({ name, icon: Icon, pitch, ask }) => (
            <article key={name} className="flex flex-col rounded-lg border border-border bg-surface p-6">
              <Icon className="size-5 text-accent" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-semibold leading-snug text-text">{name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{pitch}</p>
              <p className="mt-auto pt-6 font-mono text-xs leading-relaxed text-text/80">&ldquo;{ask}&rdquo;</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
