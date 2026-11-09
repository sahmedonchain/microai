import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/app/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Use — MicroAI",
  description: "The rules for using MicroAI, what the service does not promise.",
};

const SECTIONS: LegalSection[] = [
  {
    title: "What MicroAI is",
    body: [
      "MicroAI is an independent project that offers an AI assistant and tools for developers building on Arc and Circle. It is not an official Arc or Circle product, and it is not affiliated with or endorsed by either company.",
    ],
  },
  {
    title: "Not advice, and it can be wrong",
    items: [
      "MicroAI is experimental and has not been independently audited. Do not rely on it for large amounts.",
      "AI answers can be wrong. Check addresses, chain IDs and parameters against docs.arc.io before sending funds.",
      "Nothing from MicroAI is financial, legal, tax or security advice.",
    ],
  },
  {
    title: "Credits are retired: refunds for everyone who paid",
    items: [
      "On 10 November 2026 MicroAI retired credits, Chat and Copilot. MicroAI no longer sells credits and no longer takes payments of any kind.",
      "If you bought credits and have not used them all, you can get the unspent ones back in USDC. The refund is 0.001 USDC per unspent credit, the same price you paid.",
      "If you sent a payment that was never turned into credits, you can get all of it back.",
      "Refunds are sent on Arc Mainnet, only to the same wallet that made the payment, never to a different address. MicroAI pays the network fee.",
      "To ask, open an issue at github.com/sahmedonchain/microai/issues with your wallet address (and the transaction hash for an uncredited payment). Do not post private information, and never share a private key or seed phrase. We check your wallet against our payment records and the Arc blockchain, reply in the issue, and send the refund.",
      "You can ask until 8 February 2027. After that date unclaimed credit records are deleted and can no longer be refunded.",
      "Credits spent on answers that were already delivered are not refunded.",
      "Blockchain transactions are final. Check the network and the receiving address in your wallet before you confirm any transaction, on MicroAI or anywhere else.",
    ],
  },
  {
    title: "Your wallet",
    body: [
      "You control your wallet and your keys. Connecting a wallet and signing the sign-in message does not give MicroAI access to your funds. MicroAI will never ask for your private key or seed phrase. If anyone claiming to be MicroAI asks for it, do not share it.",
    ],
  },
  {
    title: "Acceptable use",
    items: [
      "Do not attack, overload or probe the service, bypass rate limits or payments, or try to make the AI reveal its instructions or other users' data.",
      "Do not use MicroAI for anything illegal.",
      "Found a vulnerability? Report it privately through GitHub Private Vulnerability Reporting, linked on the Security page. Do not test against other users' wallets or funds.",
    ],
  },
  {
    title: "A new network and a changing service",
    items: [
      "Arc Mainnet is new. Network, RPC or explorer outages and changes can affect payments, balances and answers, and we do not control Arc or Circle.",
      "MicroAI changes often. Features can be added, changed or retired, and the focus is moving toward payment verification tools for Arc builders. Retired features are announced where possible.",
      "We work to improve security with each update, but no service is risk free and we make no guarantee.",
      "The service may be paused at any time, for example in an emergency.",
      "Directory and news listings link to third parties and are provided for information only. We do not guarantee that they are complete or current.",
    ],
  },
  {
    title: "No warranty, limited liability",
    body: [
      "MicroAI is provided as is and as available, without warranties of any kind. To the extent the law allows, the operator is not liable for losses that come from using the service or relying on its answers, including lost funds, failed transactions or errors in generated code.",
    ],
  },
  {
    title: "Changes and contact",
    body: [
      "These terms may be updated. The date above shows the latest version, and continued use means you accept the current version. Questions: open an issue at github.com/sahmedonchain/microai/issues. Do not post private information there.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      updated="November 2026"
      intro="By connecting a wallet or using MicroAI you agree to these terms. They are written in plain language and describe how the service works today."
      sections={SECTIONS}
    />
  );
}
