"use client";

import { useState } from "react";
import { ChevronDown } from "@/components/icons";

const ITEMS = [
  {
    q: "Is Omegley really free?",
    a: "Yes — completely free, with no account, no trial, and no credit card. You click Start and you're matched.",
  },
  {
    q: "Do I need to sign up or download anything?",
    a: "No. Omegley runs entirely in your browser. There's no app to install and no profile to create — just allow your camera and microphone and go.",
  },
  {
    q: "Is my conversation recorded or stored?",
    a: "No. Video, audio and chat travel directly between you and the other person (peer-to-peer). We have no database and never record or store your conversations.",
  },
  {
    q: "How does the country flag work?",
    a: "We show an approximate country based on network location so you get a sense of who you're meeting. It's an approximation only and is never saved.",
  },
  {
    q: "What do I need for it to work?",
    a: "A modern browser (Chrome, Edge, Firefox or Safari), a working camera and microphone, and an internet connection. That's it.",
  },
  {
    q: "How do you keep it safe?",
    a: "You must be 18 or older, connections are encrypted in transit, and our Community Guidelines prohibit harmful behavior. You can skip to a new person instantly at any time.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-3xl divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.02]">
      {ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-5 text-left"
              aria-expanded={isOpen}
            >
              <span className="font-medium text-white">{item.q}</span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-neutral-400 transition-transform duration-300 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            <div
              className={`grid overflow-hidden px-5 transition-all duration-300 ${
                isOpen ? "grid-rows-[1fr] pb-5 opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <p className="min-h-0 text-sm leading-relaxed text-neutral-400">
                {item.a}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
