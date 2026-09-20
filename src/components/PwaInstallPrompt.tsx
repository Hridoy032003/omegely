"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PwaInstallPrompt() {
  const pathname = usePathname();
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (value: Event) => {
      value.preventDefault();
      setEvent(value as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);

    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setDismissed(sessionStorage.getItem("omegley-install-dismissed") === "1");
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    void navigator.serviceWorker?.register("/sw.js");

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || dismissed || pathname.startsWith("/chat")) return null;

  const dismiss = () => {
    sessionStorage.setItem("omegley-install-dismissed", "1");
    setDismissed(true);
  };

  if (!event) {
    return ios ? (
      <div className="fixed bottom-4 left-4 right-4 z-[60] mx-auto hidden max-w-md rounded-2xl border border-indigo-400/30 bg-neutral-900/95 p-4 text-sm text-neutral-200 shadow-2xl backdrop-blur-xl sm:block">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium text-white">Install Omegley</p>
            <p className="mt-1 text-neutral-400">Tap Share, then “Add to Home Screen”.</p>
          </div>
          <button type="button" aria-label="Dismiss install prompt" className="text-lg leading-none text-neutral-500 hover:text-white" onClick={dismiss}>×</button>
        </div>
      </div>
    ) : null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[60] mx-auto hidden max-w-md items-center justify-between gap-4 rounded-2xl border border-indigo-400/30 bg-neutral-900/95 p-4 shadow-2xl backdrop-blur-xl sm:flex">
      <div>
        <p className="font-medium text-white">Install Omegley</p>
        <p className="mt-1 text-xs text-neutral-400">Use Omegley like a mobile app.</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" aria-label="Dismiss install prompt" className="text-lg leading-none text-neutral-500 hover:text-white" onClick={dismiss}>×</button>
        <button
          type="button"
          className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
          onClick={async () => {
            await event.prompt();
            await event.userChoice;
            setEvent(null);
          }}
        >
          Install
        </button>
      </div>
    </div>
  );
}
