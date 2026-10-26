import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/app/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Use — MicroAI",
  description: "The rules for using MicroAI, how credits and payments work, and what the service does not promise.",
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
      "Copilot output is not compiled or tested. Review and test generated code yourself before deploying it.",
      "Nothing from MicroAI is financial, legal, tax or security advice.",
    ],
  },
  {
    title: "Credits and payments",
    items: [
      "One credit costs 0.001 USDC and covers one chat message or one Copilot request. You buy credits with USDC on Arc Mainnet.",
      "Blockchain transactions are final. Check the network and the receiving address in your wallet before you confirm.",
      "A payment is credited once, after the server confirms the transaction on Arc. If a confirmed payment has not been credited, use Recover a payment with its transaction hash.",
      "Credits do not expire and have no cash value.",
      "If your payment is confirmed on Arc but the credits were not added, tell us and we will fix it. Try Recover a payment first, then open an issue with the transaction hash.",
      "If the AI fails to answer, the credit is returned automatically. We do not otherwise refund credits that were spent on an answer.",
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
      "MicroAI changes often. Features can be added, changed or retired, and the focus is moving toward payment verification tools for Arc builders. Chat and Copilot may be wound down, and retired features are announced in advance where possible.",
      "We work to improve security with each update, but no service is risk free and we make no guarantee.",
      "The service may be paused at any time, for example in an emergency.",
      "Directory, grants and news listings link to third parties and are provided for information only. We do not guarantee that they are complete or current.",
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
      updated="October 2026"
      intro="By connecting a wallet or using MicroAI you agree to these terms. They are written in plain language and describe how the service works today."
      sections={SECTIONS}
    />
  );
}
