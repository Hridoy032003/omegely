"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/hooks/useWebRTC";
import { X } from "@/components/icons";

interface ChatPanelProps {
  messages: ChatMessage[];
  disabled: boolean;
  onSend: (text: string) => boolean;
  /** When provided, renders a close button in the header (used by the mobile sheet). */
  onClose?: () => void;
}

export default function ChatPanel({ messages, disabled, onSend, onClose }: ChatPanelProps) {
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
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-neutral-900/60">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-sm font-medium text-neutral-300">Chat</span>
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
          <p className="mt-6 text-center text-sm text-neutral-600">
            {disabled
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
                    ? "bg-indigo-600 text-white"
                    : "bg-neutral-800 text-neutral-100"
                }`}
              >
                {m.text}
              </span>
            </div>
          ))
        )}
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-neutral-800 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={disabled}
          placeholder={disabled ? "Not connected" : "Type a message…"}
          className="flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:opacity-50"
          maxLength={1000}
        />
        <button
          type="submit"
          disabled={disabled || !draft.trim()}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
