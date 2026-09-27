import type { Metadata } from "next";
import EarnPageLayout, { EarnCallout, EarnHeading, EarnList, EarnText } from "@/components/earn/EarnPageLayout";

export const metadata: Metadata = {
  title: "Omegley referral rewards",
  description: "Learn how Omegley referral links, qualification, and referral rewards work.",
  alternates: { canonical: "/referrals" },
};

export default function ReferralsPage() {
  return (
    <EarnPageLayout
      eyebrow="Referral program"
      title="Invite people you know. Earn when they become active members."
      description="Your account includes a personal referral link. Share it honestly and your referral reward is recorded when the invited member qualifies."
    >
      <EarnCallout>
        The current reward amount and qualification period are shown in your wallet. Omegley may change these settings, pause the program, or reject ineligible activity.
      </EarnCallout>

      <EarnHeading>How it works</EarnHeading>
      <EarnList>
        <li>Sign in and copy your personal referral link from the wallet.</li>
        <li>Share the link directly with a real person. Do not spam, impersonate Omegley, or use misleading advertising.</li>
        <li>The new member creates an account through your link.</li>
        <li>The member returns after the qualification period configured for the program.</li>
        <li>The reward is recorded once for the eligible referral and appears in your transaction history.</li>
      </EarnList>

      <EarnHeading>What is not eligible?</EarnHeading>
      <EarnList>
        <li>Self-referrals, duplicate accounts, automated sign-ups, or attempts to manipulate the program.</li>
        <li>Referrals that do not return or do not satisfy the qualification rules.</li>
        <li>Spam, paid traffic that misrepresents Omegley, or links shared where promotion is not allowed.</li>
        <li>Activity connected to fraud, abuse, chargebacks, or violations of the Community Guidelines.</li>
      </EarnList>

      <EarnHeading>When is the reward paid?</EarnHeading>
      <EarnText>
        Referral rewards are not paid at the moment someone clicks a link. They are credited only after the configured qualification check succeeds. A referral can be credited once because the referral record is idempotent. If you believe an eligible referral is missing, contact <a href="mailto:support@omegley.in">support@omegley.in</a> with the account email and relevant dates.
      </EarnText>
    </EarnPageLayout>
  );
}
