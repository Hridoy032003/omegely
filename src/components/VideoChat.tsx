"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useWebRTC } from "@/hooks/useWebRTC";
import { countryFlag } from "@/lib/flag";
import { LogoMark } from "@/components/logo";
import SearchingIndicator from "@/components/SearchingIndicator";
import DemoPreview from "@/components/DemoPreview";
import ChatPanel from "./ChatPanel";
import {
  Bell,
  MessageCircle,
  Mic,
  MicOff,
  Share,
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

  // Mobile: chat lives in a slide-up sheet with an unread badge.
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const seenCount = useRef(0);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swipeAnimationTimer = useRef<number | null>(null);
  const previousStatus = useRef(status);
  const [searchSeconds, setSearchSeconds] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "shared" | "copied" | "error">("idle");
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeAnimating, setSwipeAnimating] = useState(false);

  useEffect(() => {
    return () => {
      if (swipeAnimationTimer.current) {
        window.clearTimeout(swipeAnimationTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isSearching) {
      setSearchSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setSearchSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isSearching]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, []);

  useEffect(() => {
    const wasSearching = previousStatus.current === "searching";
    const foundRealPerson = wasSearching && status === "connected";
    if (
      foundRealPerson &&
      notificationsEnabled &&
      document.hidden &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification("You found someone new on Omegley", {
        body: "Your private video chat is ready.",
        icon: "/icon.svg",
      });
    }
    previousStatus.current = status;
  }, [notificationsEnabled, status]);

  useEffect(() => {
    if (messages.length === 0) {
      seenCount.current = 0;
      setUnread(0);
      return;
    }
    if (chatOpen) {
      seenCount.current = messages.length;
      setUnread(0);
      return;
    }
    const fresh = messages
      .slice(seenCount.current)
      .filter((m) => m.from === "them").length;
    seenCount.current = messages.length;
    if (fresh) setUnread((u) => u + fresh);
  }, [messages, chatOpen]);

  // On mobile, swiping up on the video behaves like a short-form video feed:
  // the card follows the finger, snaps back when the gesture is too short, or
  // animates off-screen before leaving the current stranger.
  const handleVideoTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return;
    if (swipeAnimationTimer.current) {
      window.clearTimeout(swipeAnimationTimer.current);
      swipeAnimationTimer.current = null;
    }
    setSwipeAnimating(false);
    setSwipeOffset(0);
    const touch = event.touches[0];
    swipeStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleVideoTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    if (!start || event.touches.length !== 1 || status === "idle") return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaY) <= Math.abs(deltaX)) return;

    // Only let the card move upward. Downward movement is kept subtle so a
    // normal browser pull gesture never drags the chat screen away.
    const maxOffset = window.innerHeight * 0.95;
    setSwipeOffset(Math.max(-maxOffset, Math.min(24, deltaY)));
  };

  const handleVideoTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const isVerticalSwipe = Math.abs(deltaY) > 64 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2;

    setSwipeAnimating(true);
    if (isVerticalSwipe && deltaY < 0 && status !== "idle") {
      setSwipeOffset(-window.innerHeight);
      swipeAnimationTimer.current = window.setTimeout(() => {
        next();
        setSwipeOffset(0);
        setSwipeAnimating(false);
        swipeAnimationTimer.current = null;
      }, 240);
      return;
    }

    setSwipeOffset(0);
    swipeAnimationTimer.current = window.setTimeout(() => {
      setSwipeAnimating(false);
      swipeAnimationTimer.current = null;
    }, 240);
  };

  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      setShareStatus("error");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === "granted");
  };

  const shareInvite = async () => {
    const inviteUrl = `${window.location.origin}/chat?ref=invite`;
    const shareData = {
      title: "Join me on Omegley",
      text: "Try Omegley with me — free random video chat with strangers.",
      url: inviteUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareStatus("shared");
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        setShareStatus("copied");
      }
    } catch {
      setShareStatus("error");
    }
    window.setTimeout(() => setShareStatus("idle"), 2500);
  };

  const knownCountry = partnerCountry && partnerCountry !== "XX";

  return (
    <main className="relative mx-auto flex h-[100dvh] max-w-6xl flex-col gap-3 overflow-hidden p-3 sm:gap-4 sm:p-4">
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

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {onlineCount} online
          </div>

          {/* Mobile-only chat toggle */}
          <button
            onClick={() => setChatOpen(true)}
            disabled={!isConnected}
            aria-label="Open chat"
            className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-neutral-200 transition hover:bg-white/10 disabled:opacity-40 md:hidden"
          >
            <MessageCircle className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-semibold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[1fr_340px]">
        {/* Video stage */}
        <section className="flex min-h-0 flex-col gap-3 sm:gap-4">
          <div
            onTouchStart={handleVideoTouchStart}
            onTouchMove={handleVideoTouchMove}
            onTouchEnd={handleVideoTouchEnd}
            onTouchCancel={() => {
              swipeStart.current = null;
              setSwipeAnimating(true);
              setSwipeOffset(0);
            }}
            style={{
              transform: `translate3d(0, ${swipeOffset}px, 0)`,
              transition: swipeAnimating
                ? "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)"
                : "none",
            }}
            className={`relative min-h-0 flex-1 touch-none will-change-transform overflow-hidden rounded-3xl border bg-black transition-colors ${
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
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden bg-neutral-950/85 px-3 text-center sm:gap-3 sm:px-6">
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
                {isSearching && (
                  <div className="flex w-full flex-col items-center gap-2 sm:gap-4">
                    {searchSeconds >= 5 ? <DemoPreview /> : <SearchingIndicator />}

                    <div className="max-w-md">
                      <p className="text-sm font-medium text-neutral-200">
                        {onlineCount > 1
                          ? `${onlineCount} people are online — finding your next match…`
                          : "You’re early — help bring the first people online."}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-neutral-500 sm:text-xs">
                        Real users are always prioritized. Invite a friend or
                        turn on a notification while you wait.
                      </p>
                    </div>

                    <div className="flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        onClick={shareInvite}
                        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-medium text-neutral-200 transition hover:bg-white/10"
                      >
                        <Share className="h-3.5 w-3.5" />
                        Invite a friend
                      </button>
                      <button
                        type="button"
                        onClick={enableNotifications}
                        disabled={notificationsEnabled}
                        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-medium text-neutral-200 transition hover:bg-white/10 disabled:cursor-default disabled:opacity-60"
                      >
                        <Bell className="h-3.5 w-3.5" />
                        {notificationsEnabled ? "Notifications on" : "Notify me"}
                      </button>
                    </div>

                    {shareStatus !== "idle" && (
                      <p className="text-xs text-neutral-400" role="status">
                        {shareStatus === "shared" && "Invite sheet opened."}
                        {shareStatus === "copied" && "Invite link copied."}
                        {shareStatus === "error" &&
                          "Sharing or notifications are unavailable here."}
                      </p>
                    )}
                  </div>
                )}
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

            {/* TikTok-style mobile gesture hint. The button remains available for keyboard and desktop users. */}
            {isConnected && remoteReady && (
              <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/45 px-3 py-1.5 text-[11px] text-neutral-300 backdrop-blur sm:hidden">
                <span aria-hidden="true">↑</span>
                Swipe up for next
              </div>
            )}

            {/* Local preview is useful before the demo appears, then stays out
                of the way so it cannot cover the waiting actions on small screens. */}
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`absolute right-3 rounded-xl border border-white/15 bg-neutral-900 object-cover shadow-lg ring-1 ring-black/30 ${
                isSearching
                  ? "top-3 h-16 w-24 sm:h-20 sm:w-28"
                  : "bottom-3 h-24 w-32 sm:h-28 sm:w-40"
              } ${isSearching && searchSeconds >= 5 ? "invisible" : ""}`}
            />
            {!isIdle && !isSearching && (
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
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 sm:px-6"
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

        {/* Chat — desktop side panel only */}
        <aside className="hidden md:block">
          <ChatPanel
            messages={messages}
            disabled={!isConnected}
            onSend={sendMessage}
          />
        </aside>
      </div>

      <footer className="hidden pb-1 text-center text-xs text-neutral-600 sm:block">
        Be kind. Conversations are peer-to-peer and not stored anywhere. You must
        be 18+ ·{" "}
        <Link
          href="/guidelines"
          className="cursor-pointer underline underline-offset-2 hover:text-neutral-400"
        >
          Community Guidelines
        </Link>
      </footer>

      {/* Mobile chat bottom sheet */}
      <div
        className={`fixed inset-0 z-50 md:hidden ${
          chatOpen ? "" : "pointer-events-none"
        }`}
        aria-hidden={!chatOpen}
      >
        {/* backdrop */}
        <div
          onClick={() => setChatOpen(false)}
          className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
            chatOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* sheet */}
        <div
          className={`absolute inset-x-0 bottom-0 flex h-[78dvh] flex-col rounded-t-2xl border-t border-white/10 bg-neutral-950 p-3 shadow-2xl transition-transform duration-300 ease-out ${
            chatOpen ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-white/15" />
          <div className="min-h-0 flex-1">
            <ChatPanel
              messages={messages}
              disabled={!isConnected}
              onSend={sendMessage}
              onClose={() => setChatOpen(false)}
            />
          </div>
        </div>
      </div>
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
