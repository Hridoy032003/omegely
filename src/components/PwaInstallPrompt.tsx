"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PwaInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (value: Event) => {
      value.preventDefault();
      setEvent(value as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);

    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    void navigator.serviceWorker?.register("/sw.js");

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  if (!event) {
    return ios ? (
      <div className="fixed bottom-4 left-4 right-4 z-[60] mx-auto max-w-md rounded-2xl border border-indigo-400/30 bg-neutral-900/95 p-4 text-sm text-neutral-200 shadow-2xl backdrop-blur-xl">
        <p className="font-medium text-white">Install Omegley</p>
        <p className="mt-1 text-neutral-400">Tap Share, then “Add to Home Screen”.</p>
      </div>
    ) : null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[60] mx-auto flex max-w-md items-center justify-between gap-4 rounded-2xl border border-indigo-400/30 bg-neutral-900/95 p-4 shadow-2xl backdrop-blur-xl">
      <div>
        <p className="font-medium text-white">Install Omegley</p>
        <p className="mt-1 text-xs text-neutral-400">Use Omegley like a mobile app.</p>
      </div>
      <button
        type="button"
        className="shrink-0 rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
        onClick={async () => {
          await event.prompt();
          await event.userChoice;
          setEvent(null);
        }}
      >
        Install
      </button>
    </div>
  );
}
