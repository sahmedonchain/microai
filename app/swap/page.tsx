import type { Metadata } from "next";
import { ShellPage } from "@/app/components/tabs/ShellPage";

export const metadata: Metadata = {
  title: "MicroAI Swap: USDC and EURC on Arc",
  description: "Type a swap in plain words, see the quote, fee and slippage, and sign with your own wallet. Non-custodial.",
  robots: { index: false, follow: false },
};

export default function SwapPage() {
  return <ShellPage panel="swap" />;
}
