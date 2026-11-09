import { LogoMark } from "@/app/components/landing/LandingNavbar";

// Logo + name, one fixed size on every device and in every place it appears.
// The name uses the site's own accent colors (white into Arc violet and Circle blue).
export function Brand({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark className="size-10 shrink-0" />
      <span className="bg-gradient-to-r from-white via-accent-text to-secondary-text bg-clip-text text-xl font-semibold leading-none tracking-tight text-transparent">
        MicroAI
      </span>
    </span>
  );
}
