import Link from "next/link";

const LINKS = [
  { href: "/security", label: "Security" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
] as const;

// Small footer row shared by the app sidebar, the mobile menu and the legal pages.
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={`flex flex-wrap items-center gap-x-3 text-xs text-muted ${className}`}>
      {LINKS.map((l, i) => (
        <span key={l.href} className="flex items-center gap-3">
          {i > 0 && <span aria-hidden="true">·</span>}
          <Link href={l.href} className="py-1 transition hover:text-text hover:underline">
            {l.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
