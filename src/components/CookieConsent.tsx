"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cookie } from "@/components/icons";
import { CONSENT_EVENT, CONSENT_KEY, readConsent, type ConsentChoice } from "@/lib/consent";
import { Button } from "@/components/ui";

/**
 * Minimal, honest cookie banner. Omegley stores one essential localStorage flag
 * (this choice) plus the ephemeral tokens the realtime service needs — no
 * tracking or advertising cookies — so the options are "Accept" or
 * "Essential only". The decision is persisted and never re-asked.
 *
 * Owns the bottom of the viewport while visible: `useConsentResolved` keeps the
 * install prompt and feedback launcher out of the way until it is dismissed.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (readConsent() === null) setVisible(true);
  }, []);

  const choose = (value: ConsentChoice) => {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch {
      /* storage blocked — the choice just isn't remembered */
    }
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-3xl animate-fadeUp rounded-panel border border-line bg-panel/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-ink">
            <Cookie className="h-5 w-5" />
          </span>
          <p className="text-sm leading-relaxed text-ink-2">
            We use only <span className="font-medium text-ink">essential</span> storage to keep
            Omegley working — no ads, no tracking. Read our{" "}
            <Link href="/cookies" className="text-brand-ink underline underline-offset-2 hover:text-ink">
              Cookie Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => choose("essential")}>
            Essential only
          </Button>
          <Button size="sm" className="flex-1 sm:flex-none" onClick={() => choose("accepted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
