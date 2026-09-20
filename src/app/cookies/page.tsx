import type { Metadata } from "next";
import LegalPage, { H2, P, UL } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "The very short story of cookies and storage on Omegley.",
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" updated="September 13, 2026" active="/cookies">
      <P>
        This Cookie Policy explains how Omegley uses cookies and similar
        browser storage. The short version: we use only what's essential to make
        the site work. We do not use advertising or cross-site tracking cookies.
      </P>

      <H2>What are cookies &amp; local storage?</H2>
      <P>
        Cookies are small text files a website can store in your browser. “Local
        storage” is a related mechanism for saving small values on your device.
        Both let a site remember simple information between page loads.
      </P>

      <H2>What we use</H2>
      <UL>
        <li>
          <strong>Consent preference (essential).</strong> When you make a choice
          in the cookie banner, we store a single value in your browser's local
          storage so we don't ask again. It contains only your choice.
        </li>
        <li>
          <strong>Session security (essential).</strong> Our hosting and realtime
          providers may set short-lived, strictly necessary values to establish
          and secure your connection while you use the Service.
        </li>
      </UL>

      <H2>Analytics (optional — only if you accept)</H2>
      <P>
        If you choose “Accept,” we enable privacy-respecting product analytics
        (PostHog) to understand how many people visit and roughly which countries
        they come from, so we can improve the service. This uses cookies/local
        storage to count visits. If you choose “Essential only,” analytics is not
        loaded at all. We do not use analytics to build advertising profiles.
      </P>

      <H2>What we do not use</H2>
      <UL>
        <li>No advertising or marketing cookies.</li>
        <li>No selling of personal data.</li>
        <li>No cookies that identify you by name.</li>
      </UL>

      <H2>Managing your choices</H2>
      <P>
        Because our storage is limited to essential functionality, choosing
        “Essential only” still lets the Service work. You can clear cookies and
        local storage at any time through your browser settings; doing so will
        reset your consent choice, and the banner will appear again on your next
        visit.
      </P>

      <H2>Changes</H2>
      <P>
        We may update this Cookie Policy as the Service evolves. Changes are
        reflected by the “Last updated” date above.
      </P>
    </LegalPage>
  );
}
