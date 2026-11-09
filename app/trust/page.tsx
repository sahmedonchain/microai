import type { Metadata } from "next";
import { ShellPage } from "@/app/components/tabs/ShellPage";

export const metadata: Metadata = {
  title: "Trust API — MicroAI Verify",
  description: "A read-only, machine-readable check of an x402 endpoint's payment setup on Arc. Sends no payment.",
  robots: { index: false, follow: false },
};

export default function TrustPage() {
  return <ShellPage panel="trust" />;
}
