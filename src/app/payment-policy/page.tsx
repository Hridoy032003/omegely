import type { Metadata } from "next";
import EarnPageLayout, { EarnCallout, EarnHeading, EarnList, EarnText } from "@/components/earn/EarnPageLayout";

export const metadata: Metadata = {
  title: "Omegley payment and payout policy",
  description: "Omegley policy for coin purchases, payment verification, refunds, and reward payouts.",
  alternates: { canonical: "/payment-policy" },
};

export default function PaymentPolicyPage() {
  return (
    <EarnPageLayout
      eyebrow="Payment policy"
      title="How purchases, refunds, and payouts are handled."
      description="This policy explains the difference between buying coins and requesting a reward payout, and what happens when a payment needs review."
    >
      <EarnCallout>
        Omegley does not promise income or guaranteed payouts. Reward balances are subject to eligibility, fraud checks, configured limits, and the availability of the selected payout method.
      </EarnCallout>

      <EarnHeading>Coin purchases</EarnHeading>
      <EarnList>
        <li>Purchases are started from the signed-in wallet using the payment checkout provided by Razorpay.</li>
        <li>Prices and coin quantities are shown before you confirm payment. Do not share payment credentials with Omegley support.</li>
        <li>A purchase is credited only after server-side payment verification. A browser success screen alone is not proof of payment.</li>
        <li>Coins purchased for the wallet are not the same as earned reward value and may be subject to separate refund rules.</li>
      </EarnList>

      <EarnHeading>Failed, pending, or duplicated payments</EarnHeading>
      <EarnText>
        If your bank or payment provider shows a debit but coins are missing, wait for verification and use the wallet’s payment-status check. If the issue remains, email <a href="mailto:support@omegley.in">support@omegley.in</a> with your Omegley account email, order ID, payment ID, amount, and date. Never send your card number, CVV, password, or one-time password.
      </EarnText>

      <EarnHeading>Refunds</EarnHeading>
      <EarnText>
        Refund requests are reviewed against the payment status, whether purchased coins were used or transferred, duplicate-charge evidence, and applicable payment-provider rules. Contact support promptly; approved refunds are returned through the original payment route where possible. Omegley may decline requests connected to abuse, fraud, chargebacks, or policy violations.
      </EarnText>

      <EarnHeading>Reward payouts</EarnHeading>
      <EarnList>
        <li>Only the available balance can be requested; reserved coins cannot be redeemed again.</li>
        <li>Requests are reviewed for eligibility, duplicate accounts, manipulation, and suspicious activity.</li>
        <li>Processing times depend on the selected method and manual review. A request may be approved, rejected, or held for more information.</li>
        <li>Keep your payout destination accurate. Omegley is not responsible for an incorrect destination supplied by the account holder.</li>
      </EarnList>

      <EarnHeading>Policy changes</EarnHeading>
      <EarnText>
        Payment providers, payout methods, fees, minimums, and review requirements can change. The wallet and checkout display the currently available options. This page is general product information and does not replace applicable law or payment-provider terms.
      </EarnText>
    </EarnPageLayout>
  );
}
