"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "@/components/icons";
import { LogoMark } from "@/components/logo";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#why", label: "Why us" },
  { href: "#how", label: "How it works" },
  { href: "#faq", label: "FAQ" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors ${
        scrolled
          ? "border-b border-white/10 bg-neutral-950/80 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <nav className="container-page flex h-16 items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg font-display text-lg font-bold tracking-tight"
        >
          <LogoMark className="h-8 w-8" title="Omegley" />
          Omegley
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link href="/account" className="text-sm text-neutral-300 transition-colors hover:text-white">Account</Link>
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="cursor-pointer text-sm text-neutral-300 transition-colors hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/chat"
            className="group inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white px-5 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200"
          >
            Start free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex cursor-pointer items-center justify-center rounded-lg p-2 text-neutral-200 hover:bg-white/10 md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/10 bg-neutral-950/95 backdrop-blur-xl md:hidden">
          <div className="container-page flex flex-col gap-1 py-4">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-lg px-2 py-3 text-sm text-neutral-300 hover:bg-white/5 hover:text-white"
              >
                {l.label}
              </a>
            ))}
            <Link
              href="/chat"
              className="mt-2 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full bg-white px-5 py-3 text-sm font-semibold text-neutral-950"
            >
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/account" className="rounded-lg px-2 py-3 text-sm text-neutral-300 hover:bg-white/5 hover:text-white">Account</Link>
          </div>
        </div>
      )}
    </header>
  );
}
