import type { Metadata } from "next";
import EarnPageLayout, { EarnCallout, EarnHeading, EarnList, EarnText } from "@/components/earn/EarnPageLayout";

export const metadata: Metadata = {
  title: "Omegley coins and wallet value",
  description: "Understand Omegley coins, available balances, purchases, and redemption requests.",
  alternates: { canonical: "/coins" },
};

export default function CoinsPage() {
  return (
    <EarnPageLayout
      eyebrow="Coins & wallet"
      title="A clear wallet for rewards and purchases."
      description="Omegley coins are the unit used for community rewards, optional purchases, member transfers, and redemption requests."
    >
      <EarnCallout>
        Display value: 100 Omegley coins = 1 dollar of reward value. The available balance excludes coins reserved for a pending redemption.
      </EarnCallout>

      <EarnHeading>How coins are added</EarnHeading>
      <EarnList>
        <li>Eligible mutual connections and qualified referrals are credited automatically.</li>
        <li>Optional coin packs may be purchased through the payment checkout shown in the wallet.</li>
        <li>Member transfers and approved administrator adjustments appear in your transaction history.</li>
      </EarnList>

      <EarnHeading>Balance terminology</EarnHeading>
      <EarnList>
        <li><strong>Total wallet:</strong> all credited coins, including coins reserved for a pending request.</li>
        <li><strong>Available balance:</strong> coins currently available to send or request for redemption.</li>
        <li><strong>Pending withdrawal:</strong> coins temporarily reserved while a payout request is reviewed.</li>
      </EarnList>

      <EarnHeading>Redemption requests</EarnHeading>
      <EarnText>
        When your available balance reaches the minimum shown in the wallet, you may submit a redemption request using an available method. Requests can require manual review, and the minimum, methods, processing time, and availability may change. Submitting a request does not guarantee approval or immediate payment.
      </EarnText>

      <EarnHeading>Protecting the ledger</EarnHeading>
      <EarnText>
        Rewards use unique transaction keys and server-side ledger functions to prevent the same connection or referral from being credited twice. Omegley may investigate or reverse balances connected to fraud, abuse, duplicate accounts, chargebacks, or policy violations.
      </EarnText>
    </EarnPageLayout>
  );
}
