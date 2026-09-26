"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useConsentResolved } from "@/lib/consent";
import { Button } from "@/components/ui";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "omegley-install-dismissed";

export default function PwaInstallPrompt() {
  const pathname = usePathname();
  const consentResolved = useConsentResolved();
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const onBeforeInstall = (value: Event) => {
      value.preventDefault();
      setEvent(value as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);

    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    // Already running as an installed app — never prompt.
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    void navigator.serviceWorker?.register("/sw.js").catch(() => {});

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Wait for the cookie banner to clear the bottom of the screen first.
  if (installed || dismissed || !consentResolved || pathname.startsWith("/chat")) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  // iOS Safari never fires `beforeinstallprompt`, so it gets the manual hint.
  if (!event && !ios) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-[55] mx-auto flex max-w-md items-center justify-between gap-4 rounded-panel border border-brand/30 bg-panel/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">Install Omegley</p>
        <p className="mt-1 text-2xs text-ink-3">
          {event ? "Use Omegley like a mobile app." : "Tap Share, then “Add to Home Screen”."}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          aria-label="Dismiss install prompt"
          className="px-1 text-lg leading-none text-ink-4 transition-colors hover:text-ink"
          onClick={dismiss}
        >
          ×
        </button>
        {event && (
          <Button
            size="sm"
            variant="brand"
            onClick={async () => {
              await event.prompt();
              await event.userChoice;
              setEvent(null);
            }}
          >
            Install
          </Button>
        )}
      </div>
    </div>
  );
}
