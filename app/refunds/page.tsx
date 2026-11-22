import type { Metadata } from "next";
import { ShellPage } from "@/app/components/tabs/ShellPage";

export const metadata: Metadata = {
  title: "MicroAI Refund & Disputes: Evidence for x402 Payments That Were Not Delivered",
  description: "Open a refund case for an x402 payment on Arc. The merchant approves or rejects and sends any refund from their own wallet.",
  robots: { index: false, follow: false },
};

export default function RefundsPage() {
  return <ShellPage panel="refunds" />;
}
