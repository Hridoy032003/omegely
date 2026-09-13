"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWebRTC } from "@/hooks/useWebRTC";
import { countryFlag } from "@/lib/flag";
import { LogoMark } from "@/components/logo";
import SearchingIndicator from "@/components/SearchingIndicator";
import ChatPanel from "./ChatPanel";
import {
  Mic,
  MicOff,
  SkipForward,
  Square,
  Video,
  VideoOff,
} from "@/components/icons";

export default function VideoChat() {
  const rtc = useWebRTC();
  const {
    status,
    messages,
    partnerCountry,
    onlineCount,
    mediaError,
    micOn,
    camOn,
    localVideoRef,
    remoteVideoRef,
    start,
    next,
    stop,
    sendMessage,
    toggleMic,
    toggleCam,
  } = rtc;

  const isIdle = status === "idle";
  const isSearching = status === "searching";
  const isConnected = status === "connected";

  // Show a brief "Connecting…" veil after we're matched but before the
  // stranger's video actually starts playing, so the black frame never shows.
  const [remoteReady, setRemoteReady] = useState(false);
  useEffect(() => {
    if (status !== "connected") setRemoteReady(false);
  }, [status]);

  const knownCountry = partnerCountry && partnerCountry !== "XX";

  return (
    <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-4 p-4">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-[-15%] h-[440px] w-[720px] -translate-x-1/2 rounded-full bg-indigo-600/15 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-bold tracking-tight"
        >
          <LogoMark className="h-8 w-8" title="Omegley" />
          Omegley
        </Link>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          {onlineCount} online
        </div>
      </header>

      <div className="grid flex-1 gap-4 md:grid-cols-[1fr_340px]">
        {/* Video stage */}
        <section className="flex min-h-0 flex-col gap-4">
          <div
            className={`relative flex-1 overflow-hidden rounded-3xl border bg-black transition-colors ${
              isConnected ? "border-indigo-500/40" : "border-white/10"
            }`}
          >
            {/* Remote (stranger) video */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              onPlaying={() => setRemoteReady(true)}
              onLoadedData={() => setRemoteReady(true)}
              className="h-full w-full bg-black object-cover"
            />

            {/* Partner country badge */}
            {isConnected && remoteReady && (
              <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-sm backdrop-blur">
                <span className="text-lg leading-none">
                  {countryFlag(partnerCountry)}
                </span>
                <span className="text-neutral-200">
                  {knownCountry ? partnerCountry : "Unknown region"}
                </span>
              </div>
            )}

            {/* Idle / searching overlay */}
            {!isConnected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-950/85 px-6 text-center">
                {isIdle && (
                  <>
                    <LogoMark className="mb-1 h-12 w-12" />
                    <p className="font-display text-xl font-semibold text-white">
                      Meet someone new, instantly.
                    </p>
                    <p className="max-w-sm text-sm text-neutral-400">
                      Peer-to-peer video, voice and text. No signup, no history.
                    </p>
                    {mediaError && (
                      <p className="max-w-sm rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
                        {mediaError}
                      </p>
                    )}
                  </>
                )}
                {isSearching && <SearchingIndicator />}
              </div>
            )}

            {/* Connecting veil (matched, awaiting first frame) */}
            {isConnected && !remoteReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-950/85 text-center">
                <span className="text-3xl leading-none">
                  {countryFlag(partnerCountry)}
                </span>
                <p className="text-sm text-neutral-300">
                  Connecting{knownCountry ? ` to ${partnerCountry}` : ""}…
                </p>
              </div>
            )}

            {/* Local (self) preview */}
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute bottom-3 right-3 h-28 w-40 rounded-xl border border-white/15 bg-neutral-900 object-cover shadow-lg ring-1 ring-black/30"
            />
            {!isIdle && (
              <span className="absolute bottom-4 left-3 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-300 backdrop-blur">
                You
              </span>
            )}
          </div>

          {/* Controls — unified glass bar */}
          <div className="flex justify-center">
            {isIdle ? (
              <button
                onClick={start}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-10 py-3.5 text-sm font-semibold text-neutral-950 shadow-lg shadow-indigo-500/10 transition hover:bg-neutral-200"
              >
                <Video className="h-4 w-4" />
                Start
              </button>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 p-1.5 backdrop-blur">
                <button
                  onClick={next}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
                >
                  <SkipForward className="h-4 w-4" />
                  {isConnected ? "Next" : "Skip"}
                </button>

                <IconToggle
                  on={micOn}
                  onClick={toggleMic}
                  onLabel="Mute microphone"
                  offLabel="Unmute microphone"
                  IconOn={Mic}
                  IconOff={MicOff}
                />
                <IconToggle
                  on={camOn}
                  onClick={toggleCam}
                  onLabel="Turn camera off"
                  offLabel="Turn camera on"
                  IconOn={Video}
                  IconOff={VideoOff}
                />

                <button
                  onClick={stop}
                  aria-label="Stop"
                  title="Stop"
                  className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-neutral-200 transition hover:bg-red-600 hover:text-white"
                >
                  <Square className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Chat */}
        <aside className="min-h-[320px] md:min-h-0">
          <ChatPanel
            messages={messages}
            disabled={!isConnected}
            onSend={sendMessage}
          />
        </aside>
      </div>

      <footer className="pb-2 text-center text-xs text-neutral-600">
        Be kind. Conversations are peer-to-peer and not stored anywhere. You must
        be 18+ ·{" "}
        <Link
          href="/guidelines"
          className="cursor-pointer underline underline-offset-2 hover:text-neutral-400"
        >
          Community Guidelines
        </Link>
      </footer>
    </main>
  );
}

function IconToggle({
  on,
  onClick,
  onLabel,
  offLabel,
  IconOn,
  IconOff,
}: {
  on: boolean;
  onClick: () => void;
  onLabel: string;
  offLabel: string;
  IconOn: (p: { className?: string }) => React.ReactElement;
  IconOff: (p: { className?: string }) => React.ReactElement;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={!on}
      aria-label={on ? onLabel : offLabel}
      title={on ? onLabel : offLabel}
      className={`inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition ${
        on
          ? "bg-white/10 text-neutral-100 hover:bg-white/15"
          : "bg-red-600/90 text-white hover:bg-red-600"
      }`}
    >
      {on ? <IconOn className="h-4 w-4" /> : <IconOff className="h-4 w-4" />}
    </button>
  );
}
