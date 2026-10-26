import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/app/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — MicroAI",
  description: "What data MicroAI collects, why, who processes it, and the choices you have.",
};

const SECTIONS: LegalSection[] = [
  {
    title: "Who runs MicroAI",
    body: [
      "MicroAI is built and operated by Sahmed Zayan under the BuildOrbit brand. Contact: open an issue at github.com/sahmedonchain/microai/issues and do not post private information there.",
    ],
  },
  {
    title: "What we collect and why",
    items: [
      "Wallet address: when you sign in with Ethereum. It identifies your session and your credit balance. Wallet addresses are public on the blockchain.",
      "Session cookie: one httpOnly cookie that keeps you signed in for up to 24 hours. There are no advertising or analytics cookies.",
      "Credits and purchases: your credit balance, and for each credited payment its transaction hash, your wallet, the number of credits and the time. We keep this so a payment can never be credited twice.",
      "Sign-in codes: a one-time code, kept for 5 minutes.",
      "Rate-limit counters: counts tied to your IP address and wallet, which expire when their time window ends (up to 24 hours).",
      "Technical logs: our hosting setup records request details such as IP address, time, a request ID and error information, and browsers may send content-security reports with URLs shortened to the address without the query. Retention follows our hosting provider settings. MicroAI is hosted on Vercel for now, and this page will be updated if that changes.",
    ],
  },
  {
    title: "Your questions and AI answers",
    items: [
      "Chat messages, Copilot requests and the transaction or wallet details you submit for AI analysis are sent to our AI provider, Groq, to generate the answer. Do not enter secrets or private keys.",
      "Chat answers are not stored on our servers after they are delivered.",
      "If a long Copilot answer is cut off, the request and the partial answer are held on our server for up to 15 minutes so you can continue it.",
      "Your chat history (the last 30 messages) and any unsent draft are saved only in your own browser. You can clear them with the Clear button or in your browser settings.",
    ],
  },
  {
    title: "Who else handles data",
    items: [
      "Vercel hosts the website.",
      "Upstash stores credits, purchase records, sign-in codes and rate-limit counters.",
      "Groq processes the text you send for AI answers.",
      "The Arc RPC and Explorer provide public blockchain data. Transaction hashes and addresses you look up are sent to them.",
      "Your wallet app handles your keys and signatures.",
    ],
    body: ["We do not sell your data and we do not show ads."],
  },
  {
    title: "The blockchain is public and permanent",
    body: [
      "Payments you make on Arc are public and cannot be deleted by us or anyone else.",
    ],
  },
  {
    title: "Your choices",
    items: [
      "Disconnect your wallet at any time. This ends your session.",
      "Clear MicroAI data in your browser to remove local chat history.",
      "To ask us to delete the data we hold for your wallet, contact us as described above. Deleting your credit record means giving up the credits it holds.",
      "Payment records cannot be deleted: they are public on the blockchain, and we keep a record of each credited payment so it cannot be credited twice.",
    ],
  },
  {
    title: "Children",
    body: ["MicroAI is built for developers and is not directed at children."],
  },
  {
    title: "Changes",
    body: [
      "MicroAI is changing quickly and new features may collect new kinds of data. We update this page when they go live, and the date above shows the latest version.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="October 2026"
      intro="This page explains what MicroAI collects and why. It describes how the service works today, in plain language."
      sections={SECTIONS}
    />
  );
}
