"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/hooks/useWebRTC";
import { X } from "@/components/icons";

interface ChatPanelProps {
  messages: ChatMessage[];
  disabled: boolean;
  onSend: (text: string) => boolean;
  /** Matched, but the data channel hasn't opened yet — the composer stays disabled. */
  connecting?: boolean;
  /** When provided, renders a close button in the header (used by the mobile sheet). */
  onClose?: () => void;
}

export default function ChatPanel({ messages, disabled, connecting = false, onSend, onClose }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSend(draft)) setDraft("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-card border border-line bg-panel/70">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="text-sm font-medium text-ink-2">Chat</span>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close chat"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-neutral-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div ref={logRef} className="thin-scroll flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="mt-6 text-center text-sm text-ink-4">
            {connecting
              ? "Opening the chat channel…"
              : disabled
                ? "Messages appear once you're connected to a stranger."
                : "Say hi 👋"}
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}
            >
              <span
                className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                  m.from === "me"
                    ? "bg-brand-hi text-white"
                    : "bg-panel-hi text-ink"
                }`}
              >
                {m.text}
              </span>
            </div>
          ))
        )}
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-line p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={disabled}
          placeholder={connecting ? "Connecting…" : disabled ? "Not connected" : "Type a message…"}
          className="min-w-0 flex-1 rounded-control border border-line bg-black/30 px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-4 focus:border-brand/60 disabled:opacity-50"
          maxLength={1000}
        />
        <button
          type="submit"
          disabled={disabled || !draft.trim()}
          className="shrink-0 rounded-control bg-brand-hi px-4 py-2 text-sm font-medium text-white transition hover:bg-brand disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
