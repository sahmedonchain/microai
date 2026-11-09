import type { Metadata } from "next";
import { ShellPage } from "@/app/components/tabs/ShellPage";

export const metadata: Metadata = {
  title: "MicroAI Tools: Verify, Inspect and Debug x402 Payments on Arc",
  description: "All MicroAI tools for USDC and x402 payments on Arc.",
};

export default function OverviewPage() {
  return <ShellPage panel="home" />;
}
