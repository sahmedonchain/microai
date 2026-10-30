import type { Metadata } from "next";
import { VerifyClient } from "@/app/components/VerifyClient";

export const metadata: Metadata = {
  title: "Verify: check an x402 payment setup on Arc — MicroAI",
  description: "Early preview. Check an x402 endpoint's payment setup on Arc and match a transaction against it. No payment is sent.",
  // Early preview: shared by link, not indexed yet.
  robots: { index: false, follow: false },
};

export default function VerifyPage() {
  return <VerifyClient />;
}
