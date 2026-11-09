import type { Metadata } from "next";
import { ShellPage } from "@/app/components/tabs/ShellPage";

export const metadata: Metadata = {
  title: "Testnet lab — MicroAI Verify",
  description: "Send small test payments on Arc Testnet and see how MicroAI Verify judges each one. No real money.",
  robots: { index: false, follow: false },
};

export default function LabPage() {
  return <ShellPage panel="lab" />;
}
