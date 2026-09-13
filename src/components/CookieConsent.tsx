"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cookie } from "@/components/icons";

const STORAGE_KEY = "rt-cookie-consent";

/**
 * Minimal, honest cookie banner. Omegley only uses a single essential
 * localStorage flag (this consent choice) plus the ephemeral tokens the
 * realtime service needs — no tracking/advertising cookies — so the choices are
 * "Accept" or "Essential only". We persist the decision and never re-ask.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      /* storage blocked — don't block the app */
    }
  }, []);

  const choose = (value: "accepted" | "essential") => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
    // Let analytics (PostHog) start the moment the user accepts.
    window.dispatchEvent(new CustomEvent("rt-consent", { detail: value }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-3xl animate-fadeUp rounded-2xl border border-white/10 bg-neutral-900/90 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300">
            <Cookie className="h-5 w-5" />
          </span>
          <p className="text-sm leading-relaxed text-neutral-300">
            We use only <span className="font-medium text-white">essential</span>{" "}
            storage to keep Omegley working — no ads, no tracking. Read our{" "}
            <Link href="/cookies" className="cursor-pointer text-indigo-300 underline underline-offset-2 hover:text-indigo-200">
              Cookie Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 gap-2 sm:ml-auto">
          <button
            onClick={() => choose("essential")}
            className="flex-1 cursor-pointer rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:bg-white/5 sm:flex-none"
          >
            Essential only
          </button>
          <button
            onClick={() => choose("accepted")}
            className="flex-1 cursor-pointer rounded-full bg-white px-5 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200 sm:flex-none"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
