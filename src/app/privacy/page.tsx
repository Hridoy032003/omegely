import type { Metadata } from "next";
import LegalPage, { H2, P, UL } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Omegley handles (and doesn't store) your data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="September 13, 2026" active="/privacy">
      <P>
        Omegley (“we”, “us”) is built to be private by design. This policy
        explains what limited information is involved when you use the service
        and, importantly, what we <strong>do not</strong> collect or store. This
        document is provided for general information and is not legal advice; you
        should review it with your own counsel before relying on it for a
        production service.
      </P>

      <H2>The short version</H2>
      <UL>
        <li>We do not require an account, name, email, or phone number.</li>
        <li>We do not record your video, audio, or text conversations.</li>
        <li>We do not sell or share personal data with advertisers.</li>
        <li>
          Your media flows peer-to-peer (device to device), not through a
          database we control.
        </li>
      </UL>

      <H2>Information involved when you use Omegley</H2>
      <P>
        Because there are no accounts, we don't build user profiles. The only
        data involved is:
      </P>
      <UL>
        <li>
          <strong>Approximate country.</strong> Our servers read a country code
          derived from your IP address (via your network/CDN) so we can show a
          country flag during a match. This is an approximation, is shown to your
          match, and is not stored.
        </li>
        <li>
          <strong>Temporary connection data.</strong> To connect two people, a
          realtime signaling service exchanges short-lived technical messages
          (session descriptions and network candidates) and a randomly generated
          session identifier. These exist only for the duration of your session.
        </li>
        <li>
          <strong>Local device storage.</strong> A single browser storage value
          remembers your cookie choice. See our Cookie Policy.
        </li>
      </UL>

      <H2>What we do not collect</H2>
      <UL>
        <li>No conversation recordings — video, audio, and chat are never saved.</li>
        <li>No persistent identifiers, advertising IDs, or cross-site trackers.</li>
        <li>No sold or rented personal data.</li>
      </UL>

      <H2>How your conversation travels</H2>
      <P>
        Omegley uses WebRTC, which establishes a direct, encrypted connection
        between you and your match wherever network conditions allow. The
        content of your call does not pass through, and is not accessible to, our
        servers. Signaling (the initial “handshake”) and matchmaking use a
        third-party realtime provider that relays only the technical messages
        needed to connect you.
      </P>

      <H2>Third-party services</H2>
      <UL>
        <li>
          <strong>Realtime provider</strong> — relays signaling messages and
          presence needed to match and connect users.
        </li>
        <li>
          <strong>Hosting / CDN</strong> — serves the website and provides the
          approximate country header. Providers may process technical request
          data (such as IP address) transiently to deliver and secure the site.
        </li>
        <li>
          <strong>Analytics (optional)</strong> — if you accept in the cookie
          banner, we use PostHog to count visits and approximate country so we
          can improve the service. It is not loaded if you choose “Essential
          only,” and we do not use it for advertising.
        </li>
      </UL>

      <H2>Children</H2>
      <P>
        Omegley is intended only for adults aged 18 and over. We do not
        knowingly allow minors to use the service. If you believe a minor is
        using Omegley, please contact us so we can respond.
      </P>

      <H2>Your choices &amp; rights</H2>
      <P>
        Because we don't hold an account or a profile tied to you, there is
        generally no stored personal data for us to export or delete. You can
        stop all processing at any time by closing the tab, and you can manage
        your cookie choice from the banner or your browser settings. Depending on
        where you live, you may have rights under laws such as the GDPR or CCPA;
        contact us to exercise any applicable rights.
      </P>

      <H2>Changes to this policy</H2>
      <P>
        We may update this policy from time to time. Material changes will be
        reflected by the “Last updated” date above.
      </P>
    </LegalPage>
  );
}
