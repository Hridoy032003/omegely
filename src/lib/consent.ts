"use client";

import { useEffect, useState } from "react";

export const CONSENT_KEY = "rt-cookie-consent";
export const CONSENT_EVENT = "rt-consent";

export type ConsentChoice = "accepted" | "essential";

export function readConsent(): ConsentChoice | null {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === "accepted" || value === "essential" ? value : null;
  } catch {
    return null;
  }
}

/**
 * True once the visitor has answered the cookie banner.
 *
 * Every other bottom-anchored overlay (the install prompt, the feedback
 * launcher) waits on this so they can't stack on top of the banner.
 * `null` means "not decided yet on the client" — during SSR and the first paint
 * nothing should render.
 */
export function useConsentResolved() {
  const [resolved, setResolved] = useState<boolean | null>(null);

  useEffect(() => {
    setResolved(readConsent() !== null);
    const onConsent = () => setResolved(true);
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  return resolved === true;
}
