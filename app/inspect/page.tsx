import type { Metadata } from "next";
import { ShellPage } from "@/app/components/tabs/ShellPage";

export const metadata: Metadata = {
  title: "Payload inspector — MicroAI Verify",
  description: "Paste x402 payment headers and check what was asked, signed and reported. Runs in your browser. Nothing is sent.",
  robots: { index: false, follow: false },
};

export default function InspectPage() {
  return <ShellPage panel="inspect" />;
}
