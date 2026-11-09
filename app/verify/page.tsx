import type { Metadata } from "next";
import { ShellPage } from "@/app/components/tabs/ShellPage";

export const metadata: Metadata = {
  title: "MicroAI Verify: Check an x402 Payment Setup on Arc",
  description: "Early preview. Check an x402 endpoint's payment setup on Arc and match a transaction against it. No payment is sent.",
  // Early preview: shared by link, not indexed yet.
  robots: { index: false, follow: false },
};

export default function VerifyPage() {
  return <ShellPage panel="verify" />;
}
