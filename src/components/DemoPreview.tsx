"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "@/components/icons";

const SCENES = [
  {
    gradient: "from-indigo-500/50 via-violet-500/25 to-sky-500/35",
    orb: "bg-indigo-300/40",
    accent: "bg-indigo-300",
  },
  {
    gradient: "from-emerald-500/40 via-cyan-500/20 to-blue-500/35",
    orb: "bg-cyan-300/40",
    accent: "bg-cyan-300",
  },
  {
    gradient: "from-amber-500/35 via-rose-500/20 to-fuchsia-500/35",
    orb: "bg-rose-300/40",
    accent: "bg-rose-300",
  },
];

const ROTATE_MS = 7000;

/**
 * A clearly disclosed animated placeholder for the cold-start experience.
 * This is intentionally abstract: it never pretends to be a real person.
 */
export default function DemoPreview() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ROTATE_MS / 1000);
  const scene = SCENES[sceneIndex];

  useEffect(() => {
    const rotate = window.setInterval(() => {
      setSceneIndex((value) => (value + 1) % SCENES.length);
      setSecondsLeft(ROTATE_MS / 1000);
    }, ROTATE_MS);
    const countdown = window.setInterval(() => {
      setSecondsLeft((value) => (value <= 1 ? ROTATE_MS / 1000 : value - 1));
    }, 1000);

    return () => {
      window.clearInterval(rotate);
      window.clearInterval(countdown);
    };
  }, []);

  return (
    <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-indigo-400/25 bg-neutral-900/80 text-left shadow-2xl shadow-indigo-950/30">
      <div
        className={`relative h-44 overflow-hidden bg-gradient-to-br ${scene.gradient} sm:h-56`}
        aria-label="Simulated demo preview, not a live person"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.18),transparent_36%)]" />
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur">
          <Sparkles className="h-3 w-3" />
          Simulated demo
        </div>

        {/* Abstract animated avatar; no real person is represented. */}
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
          <div className={`relative h-24 w-24 rounded-full ${scene.orb} shadow-[0_0_70px_rgba(255,255,255,0.2)] animate-pulseGlow`}>
            <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-[45%] bg-white/20 blur-sm" />
            <div className={`absolute bottom-[-1.25rem] left-1/2 h-20 w-32 -translate-x-1/2 rounded-t-[50%] ${scene.accent}/30 blur-sm`} />
          </div>
        </div>

        <div className="absolute inset-x-3 bottom-3 flex flex-col items-start gap-1 text-[10px] leading-tight text-white sm:flex-row sm:items-end sm:justify-between sm:text-xs">
          <span className="rounded-full bg-black/35 px-2 py-1 backdrop-blur">
            Illustration only · not live
          </span>
          <span className="rounded-full bg-black/35 px-2 py-1 backdrop-blur">
            Next in {secondsLeft}s
          </span>
        </div>
      </div>

      <div className="border-t border-white/10 px-3 py-2 sm:px-4 sm:py-3">
        <p className="text-xs font-medium text-white sm:text-sm">While we find a real person</p>
        <p className="mt-1 text-[10px] leading-relaxed text-neutral-400 sm:text-xs">
          This preview is simulated and clearly labeled. Real video and chat
          begin only after a live match connects.
        </p>
      </div>
    </div>
  );
}
