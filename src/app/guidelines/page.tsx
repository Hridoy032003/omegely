import type { Metadata } from "next";
import LegalPage, { H2, P, UL } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Community Guidelines",
  description: "How to keep Omegley safe and welcoming for everyone.",
  alternates: { canonical: "/guidelines" },
};

export default function GuidelinesPage() {
  return (
    <LegalPage
      title="Community Guidelines"
      updated="September 13, 2026"
      active="/guidelines"
    >
      <P>
        Omegley is a place to meet new people from around the world. To keep it
        welcoming, everyone agrees to a few simple rules. Breaking them can get
        your access removed. These guidelines work alongside our Terms of Service.
      </P>

      <H2>You must be 18 or older</H2>
      <P>
        Omegley is strictly for adults. If you are under 18, you may not use the
        Service.
      </P>

      <H2>Be respectful</H2>
      <UL>
        <li>Treat others the way you'd want to be treated.</li>
        <li>
          No harassment, hate speech, threats, or discrimination of any kind.
        </li>
        <li>Respect when someone doesn't want to continue a conversation.</li>
      </UL>

      <H2>Keep it clean</H2>
      <UL>
        <li>No nudity, sexual content, or sexual activity on camera.</li>
        <li>No violence, gore, self-harm, or other disturbing content.</li>
        <li>No illegal activity or content of any kind.</li>
      </UL>

      <H2>Protect privacy — yours and theirs</H2>
      <UL>
        <li>
          Don't record, screenshot, or share other users without their consent.
        </li>
        <li>
          Never share your own sensitive details (address, financial info,
          passwords) and don't pressure others to share theirs.
        </li>
      </UL>

      <H2>No spam or scams</H2>
      <UL>
        <li>No advertising, solicitation, phishing, or fraud.</li>
        <li>No links or files intended to deceive or harm.</li>
      </UL>

      <H2>Staying safe</H2>
      <UL>
        <li>
          You're always one click from a new match — press “Next” or close the tab
          to leave instantly.
        </li>
        <li>Trust your instincts and end anything that feels wrong.</li>
        <li>
          Remember that anonymous strangers may not be who they claim to be.
        </li>
      </UL>

      <H2>Reporting</H2>
      <P>
        If someone breaks these rules or you witness harmful behavior, please
        report it to{" "}
        <a
          className="cursor-pointer text-indigo-300 underline underline-offset-2 hover:text-indigo-200"
          href="mailto:hello@omegley.in"
        >
          hello@omegley.in
        </a>
        . In an emergency, contact your local authorities.
      </P>
    </LegalPage>
  );
}
