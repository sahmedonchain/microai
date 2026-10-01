const STEPS = [
  {
    title: "Connect your wallet",
    body: "Use MetaMask, Coinbase Wallet or any browser wallet. MicroAI adds Arc Mainnet for you. No account or email.",
  },
  {
    title: "Buy credits",
    body: "Top up with USDC on Arc. Credits are prepaid and settled onchain, so you never get a surprise bill.",
  },
  {
    title: "Access everything",
    body: "Chat, debugger, ecosystem stats and DeFi tools all draw from one balance. You pay only for what you use.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-b border-border" aria-labelledby="how-heading">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <h2 id="how-heading" className="text-2xl font-semibold leading-tight text-text">
          Start in three steps
        </h2>
        <p className="mt-3 max-w-[60ch] text-base text-muted">From wallet to first answer in under a minute.</p>

        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((step, i) => (
            <li key={step.title} className="border-t border-border pt-6">
              <span className="font-mono text-sm text-accent">Step {i + 1}</span>
              <h3 className="mt-3 text-lg font-semibold leading-snug text-text">{step.title}</h3>
              <p className="mt-2 max-w-[40ch] text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
