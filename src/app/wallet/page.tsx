import type { Metadata } from "next";
import WalletPanel from "@/components/WalletPanel";

export const metadata: Metadata = {
  title: "Wallet and earnings",
  description: "View your Omegley coin balance, referral rewards, and withdrawal options.",
  robots: { index: false, follow: false },
};

export default function WalletPage() {
  return <WalletPanel />;
}
