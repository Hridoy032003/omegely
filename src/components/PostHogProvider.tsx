"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

const CONSENT_KEY = "rt-cookie-consent";

/**
 * PostHog analytics, wired to answer two questions:
 *   1. How many users?      → $pageview events (unique visitors in PostHog)
 *   2. Which countries?      → PostHog Cloud GeoIP ($geoip_country_code) PLUS a
 *                              `country` super-property we attach to every event
 *                              from our own /api/geo lookup (belt & suspenders).
 *
 * Analytics is OPTIONAL and only starts once the visitor clicks "Accept" in the
 * cookie banner — if they choose "Essential only", nothing loads. Set
 * NEXT_PUBLIC_POSTHOG_KEY (and optionally NEXT_PUBLIC_POSTHOG_HOST) to enable it;
 * with no key, this component is a no-op.
 */
export default function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    const startAnalytics = () => {
      if (posthog.__loaded) return;
      posthog.init(key, {
        api_host:
          process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        capture_pageview: false, // captured manually for App Router (below)
        capture_pageleave: true,
        persistence: "localStorage+cookie",
      });

      // Attach approximate country to every event, so a simple breakdown by
      // `country` shows where users come from even without GeoIP enrichment.
      fetch("/api/geo")
        .then((r) => r.json())
        .then((d) => {
          if (d?.country) posthog.register({ country: d.country });
        })
        .catch(() => {})
        .finally(() => posthog.capture("$pageview"));
    };

    let consent: string | null = null;
    try {
      consent = localStorage.getItem(CONSENT_KEY);
    } catch {
      /* storage blocked */
    }
    if (consent === "accepted") startAnalytics();

    // React to the cookie banner: start immediately when the user accepts.
    const onConsent = (e: Event) => {
      if ((e as CustomEvent<string>).detail === "accepted") startAnalytics();
    };
    window.addEventListener("rt-consent", onConsent);
    return () => window.removeEventListener("rt-consent", onConsent);
  }, []);

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </PHProvider>
  );
}

/** Capture a $pageview on every client-side route change (App Router). */
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || !posthog.__loaded) return;
    let url = window.location.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}
