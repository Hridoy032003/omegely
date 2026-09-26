"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "@/components/icons";
import { LogoMark } from "@/components/logo";
import UserAccountBadge from "@/components/UserAccountBadge";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#why", label: "Why us" },
  { href: "#how", label: "How it works" },
  { href: "#earn", label: "Earn" },
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

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-40 transition-colors ${
        scrolled
          ? "border-b border-line bg-canvas/85 backdrop-blur-xl"
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
          <Link href="/account" className="text-sm text-ink-2 transition-colors hover:text-ink">Account</Link>
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-ink-2 transition-colors hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <UserAccountBadge compact />
          <Link
            href="/chat"
            className="group hidden items-center gap-1.5 rounded-full bg-white px-5 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200 md:inline-flex"
          >
            Start free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-ink-2 hover:bg-white/10 md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-line bg-canvas/95 backdrop-blur-xl md:hidden">
          <div className="container-page flex flex-col gap-1 py-4">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-3 text-sm text-ink-2 hover:bg-white/5 hover:text-ink"
              >
                {l.label}
              </a>
            ))}
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-3 text-sm text-ink-2 hover:bg-white/5 hover:text-ink"
            >
              Account
            </Link>
            <Link
              href="/chat"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-5 py-3 text-sm font-semibold text-neutral-950"
            >
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
