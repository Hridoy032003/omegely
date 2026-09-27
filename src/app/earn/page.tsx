import type { Metadata } from "next";
import Link from "next/link";
import EarnPageLayout, { EarnCallout, EarnHeading, EarnList, EarnText } from "@/components/earn/EarnPageLayout";

export const metadata: Metadata = {
  title: "Earn coins on Omegley",
  description: "Learn how Omegley connection rewards, referrals, coins, and payouts work.",
  alternates: { canonical: "/earn" },
};

export default function EarnPage() {
  return (
    <EarnPageLayout
      eyebrow="Omegley rewards"
      title="Earn coins by taking part in the community."
      description="Omegley rewards genuine participation with connection and referral rewards. This page explains the rules clearly, so you know when coins can be earned and how the wallet works."
    >
      <EarnCallout>
        Coins are a reward unit, not guaranteed income. Rewards may be limited, reviewed, reversed for abuse, or disabled in the wallet settings.
      </EarnCallout>

      <EarnHeading>Ways to earn</EarnHeading>
      <EarnList>
        <li><strong>Mutual connections:</strong> remain connected to the same person for at least 30 seconds. Both peers must have a successful WebRTC/data-channel connection and confirm the qualifying session.</li>
        <li><strong>Referrals:</strong> share your personal referral link. The referred member must create an account and return after the qualification period shown in your wallet.</li>
        <li><strong>Community bonuses:</strong> occasional promotions or administrator-approved adjustments may appear in your wallet history.</li>
      </EarnList>

      <EarnHeading>Explore the details</EarnHeading>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Referrals", "How invite links and qualification work.", "/referrals"],
          ["Coins", "Value, wallet balances, and redemption.", "/coins"],
          ["Payment policy", "Purchases, refunds, and payout review.", "/payment-policy"],
        ].map(([label, text, href]) => (
          <Link key={href} href={href} className="rounded-panel border border-line bg-panel/70 p-5 transition hover:border-brand/40 hover:bg-panel-hi">
            <h3 className="font-semibold text-ink">{label}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-3">{text}</p>
          </Link>
        ))}
      </div>

      <EarnHeading>What counts as a successful connection?</EarnHeading>
      <EarnText>
        A match request or a brief connection is not enough. The reward check begins only after the peer connection reaches a working connected state and the data channel is open. If either person leaves, skips, blocks, or the connection fails before 30 seconds, that session does not qualify. Each connection event can be rewarded only once.
      </EarnText>

      <EarnText>
        <Link href="/account?mode=signup" className="text-brand-ink underline underline-offset-2 hover:text-ink">Create an account</Link> to keep a profile and claim account-based rewards, or <Link href="/chat" className="text-brand-ink underline underline-offset-2 hover:text-ink">start chatting</Link> anonymously.
      </EarnText>
    </EarnPageLayout>
  );
}
