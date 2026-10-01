import Link from "next/link";
import { CreditPreview } from "./CreditPreview";

export function Hero() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-24">
        <div>
          <p className="font-mono text-sm text-accent">The intelligence hub for Arc and Circle</p>
          <h1 className="mt-4 text-4xl text-balance font-semibold leading-[1.1] text-text sm:text-5xl">
            One Hub. Every Role.
          </h1>
          <p className="mt-6 max-w-[60ch] text-base leading-relaxed text-muted">
            Ask anything about Arc and Circle. Debug contracts, track ecosystem stats and meet other builders in one
            place. Pay per token with prepaid credits. No subscription.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/chat"
              className="rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Start for free
            </Link>
            <span className="text-sm text-muted">Built on Arc Mainnet by BuildOrbit</span>
          </div>
        </div>
        <CreditPreview />
      </div>
    </section>
  );
}
