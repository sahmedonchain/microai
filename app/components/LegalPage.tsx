import Link from "next/link";
import { LegalLinks } from "@/app/components/LegalLinks";

export type LegalSection = { title: string; body?: string[]; items?: string[] };

// Shared layout for the Terms and Privacy pages. Plain server component, no client JS.
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 text-[var(--color-text)]">
      <Link href="/" className="text-sm text-[var(--color-accent-text)] hover:underline">
        ← MicroAI
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm text-[var(--color-muted)]">Last updated {updated}</p>
      <p className="mt-4 leading-relaxed text-[var(--color-muted)]">{intro}</p>

      {sections.map((s) => (
        <section key={s.title} className="mt-8">
          <h2 className="text-xl font-semibold">{s.title}</h2>
          {s.body?.map((p) => (
            <p key={p} className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
              {p}
            </p>
          ))}
          {s.items && (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--color-muted)]">
              {s.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <LegalLinks className="mt-12 border-t border-[var(--color-border)] pt-6" />
    </main>
  );
}
