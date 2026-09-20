"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", onInstalled);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    void navigator.serviceWorker?.register("/sw.js");

    return () => {
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  if (!installEvent) {
    return (
      <div className="install-card" role="status">
        <strong>Install Omegley on your phone</strong>
        <span>
          {ios
            ? "Tap Share, then Add to Home Screen."
            : "Open your browser menu and choose Install app or Add to Home screen."}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="install-button"
      onClick={async () => {
        await installEvent.prompt();
        await installEvent.userChoice;
        setInstallEvent(null);
      }}
    >
      Install Omegley
    </button>
  );
}
