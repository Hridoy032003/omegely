"use client";

import { useEffect, useState } from "react";
import { Globe } from "@/components/icons";

const CAPTIONS = [
  "Scanning the globe…",
  "Finding someone new…",
  "Connecting the dots…",
  "Almost there…",
];

/**
 * A radar-scope "searching for people" animation — a rotating beam sweeping over
 * a scope of rings and crosshairs, expanding pings, and pulsing blips (other
 * people out there). Captions rotate to keep it feeling alive. All motion is
 * CSS and is disabled automatically under prefers-reduced-motion.
 */
export default function SearchingIndicator() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % CAPTIONS.length), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center gap-7">
      <div className="relative h-44 w-44">
        {/* scope rings */}
        <div className="absolute inset-0 rounded-full border border-white/10" />
        <div className="absolute inset-6 rounded-full border border-white/10" />
        <div className="absolute inset-[3.25rem] rounded-full border border-white/10" />

        {/* crosshairs */}
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/[0.06]" />
        <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/[0.06]" />

        {/* expanding pings */}
        <span className="absolute inset-0 animate-ripple rounded-full border border-indigo-500/50" />
        <span className="absolute inset-0 animate-ripple rounded-full border border-indigo-500/50 [animation-delay:1.3s]" />

        {/* rotating radar beam */}
        <div
          className="absolute inset-0 animate-radar rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, rgba(99,102,241,0) 0deg, rgba(99,102,241,0.05) 40deg, rgba(129,140,248,0.45) 78deg, rgba(99,102,241,0) 90deg)",
          }}
        />

        {/* blips — other people out there */}
        <Blip className="left-[24%] top-[32%]" delay="0s" />
        <Blip className="left-[70%] top-[38%]" delay="0.6s" />
        <Blip className="left-[58%] top-[70%]" delay="1.1s" />
        <Blip className="left-[38%] top-[62%]" delay="1.7s" />

        {/* center hub */}
        <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-900 text-indigo-300 shadow-lg ring-1 ring-inset ring-indigo-500/40">
          <Globe className="h-6 w-6 animate-pulseGlow" />
        </div>
      </div>

      <p
        key={i}
        className="animate-fadeUp text-sm font-medium tracking-wide text-neutral-300"
        aria-live="polite"
      >
        {CAPTIONS[i]}
      </p>
    </div>
  );
}

function Blip({ className, delay }: { className: string; delay: string }) {
  return (
    <span
      className={`absolute h-2 w-2 animate-pulseGlow rounded-full bg-indigo-400 shadow-[0_0_10px_2px_rgba(129,140,248,0.55)] ${className}`}
      style={{ animationDelay: delay }}
    />
  );
}
