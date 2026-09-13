import type { Metadata } from "next";
import LegalPage, { H2, P, UL } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using Omegley.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="September 13, 2026" active="/terms">
      <P>
        These Terms of Service (“Terms”) govern your access to and use of
        Omegley (the “Service”). By using the Service, you agree to these
        Terms. If you do not agree, do not use the Service. This document is
        provided for general information and is not legal advice.
      </P>

      <H2>1. Eligibility</H2>
      <P>
        You must be at least 18 years old to use Omegley. By using the
        Service you represent and warrant that you are 18 or older and legally
        able to enter into these Terms.
      </P>

      <H2>2. The Service</H2>
      <P>
        Omegley connects you with other users for real-time, one-to-one video
        and text conversations. Matches are random, anonymous, and temporary. The
        Service is provided free of charge and “as is.”
      </P>

      <H2>3. Acceptable use</H2>
      <P>You agree that you will not, and will not attempt to:</P>
      <UL>
        <li>Use the Service if you are under 18.</li>
        <li>
          Display nudity, sexual content, violence, or any illegal content, or
          engage in sexual conduct on camera.
        </li>
        <li>
          Harass, threaten, defame, stalk, or discriminate against other users.
        </li>
        <li>Record, screenshot, or redistribute another user without consent.</li>
        <li>
          Share content that infringes intellectual property or privacy rights.
        </li>
        <li>
          Transmit spam, scams, malware, or attempt to obtain others' personal or
          financial information.
        </li>
        <li>
          Interfere with, overload, reverse engineer, or abuse the Service or its
          infrastructure.
        </li>
      </UL>
      <P>
        See our{" "}
        <a
          className="cursor-pointer text-indigo-300 underline underline-offset-2 hover:text-indigo-200"
          href="/guidelines"
        >
          Community Guidelines
        </a>{" "}
        for more detail. Violations may result in immediate termination of access.
      </P>

      <H2>4. User conduct &amp; your responsibility</H2>
      <P>
        You are solely responsible for your interactions with other users. Because
        conversations are anonymous and not recorded, we cannot verify the
        identity or intentions of the people you meet. Use good judgment, never
        share sensitive personal information, and leave any conversation that
        makes you uncomfortable by pressing “Next” or closing the tab.
      </P>

      <H2>5. No warranty</H2>
      <P>
        The Service is provided “as is” and “as available,” without warranties of
        any kind, whether express or implied, including fitness for a particular
        purpose, availability, or that matches will be appropriate or safe. We do
        not pre-screen users or monitor conversations in real time.
      </P>

      <H2>6. Limitation of liability</H2>
      <P>
        To the maximum extent permitted by law, Omegley and its operators will
        not be liable for any indirect, incidental, special, consequential, or
        punitive damages, or any loss arising from your use of, or inability to
        use, the Service or from interactions with other users.
      </P>

      <H2>7. Indemnification</H2>
      <P>
        You agree to indemnify and hold harmless Omegley and its operators from
        any claims, damages, or expenses arising out of your use of the Service or
        your violation of these Terms.
      </P>

      <H2>8. Termination</H2>
      <P>
        We may suspend or terminate access to the Service at any time, without
        notice, for any reason, including suspected violation of these Terms.
      </P>

      <H2>9. Changes</H2>
      <P>
        We may modify these Terms from time to time. Continued use of the Service
        after changes take effect constitutes acceptance of the revised Terms.
      </P>

      <H2>10. Governing law</H2>
      <P>
        These Terms are governed by the laws of the operator's principal place of
        business, without regard to conflict-of-laws rules. Update this section to
        specify your jurisdiction before launch.
      </P>
    </LegalPage>
  );
}
