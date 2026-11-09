import type { Metadata } from "next";
import { Landing } from "@/app/components/home/Landing";

export const metadata: Metadata = {
  title: "MicroAI: x402 and USDC Payment Verification Toolkit for Arc",
  description:
    "Read-only tools to inspect, verify and debug USDC and x402 payments on Arc. Live on Arc Mainnet, early preview.",
};

export default function Page() {
  return <Landing />;
}
