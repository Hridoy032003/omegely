import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/logo";
import { ArrowRight } from "@/components/icons";

/**
 * Shared surface + control primitives for the signed-in product pages.
 *
 * Everything here is Tailwind over the tokens in `globals.css`, so the account
 * and wallet screens inherit the same palette, radii and type scale as the
 * marketing pages instead of carrying their own stylesheet.
 */

export function Panel({
  children,
  className = "",
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "brand";
}) {
  const skin =
    tone === "brand"
      ? "border-brand/25 bg-gradient-to-br from-brand/12 via-panel/80 to-panel/80"
      : "border-line bg-panel/70";
  return (
    <section className={`rounded-panel border ${skin} ${className}`}>
      {children}
    </section>
  );
}

export function PanelHead({
  label,
  title,
  description,
  action,
}: {
  label?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {label && <p className="eyebrow">{label}</p>}
        <h2 className={`font-display text-lg font-semibold tracking-tight text-ink ${label ? "mt-2" : ""}`}>
          {title}
        </h2>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:opacity-50";

const BUTTON_VARIANTS = {
  primary: "bg-white text-neutral-950 hover:bg-neutral-200",
  brand: "bg-brand-hi text-white hover:bg-brand",
  outline: "border border-line-hi text-ink hover:bg-white/5",
  ghost: "text-ink-2 hover:bg-white/5 hover:text-ink",
} as const;

const BUTTON_SIZES = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
} as const;

type ButtonLook = {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  block?: boolean;
};

export function buttonClass({ variant = "primary", size = "md", block = false }: ButtonLook = {}) {
  return `${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${block ? "w-full" : ""}`;
}

export function Button({
  children,
  variant,
  size,
  block,
  className = "",
  ...rest
}: ButtonLook &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; className?: string }) {
  return (
    <button className={`${buttonClass({ variant, size, block })} ${className}`} {...rest}>
      {children}
    </button>
  );
}

/** Shared input/select/textarea skin. */
export const CONTROL =
  "w-full rounded-control border border-line bg-black/25 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-4 focus:border-brand/60 disabled:opacity-60";

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={htmlFor} className="flex flex-wrap items-baseline gap-2 text-sm font-medium text-ink-2">
        {label}
        {hint && <span className="text-2xs font-normal text-ink-4">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const BADGE_TONES = {
  neutral: "border-line bg-white/5 text-ink-2",
  brand: "border-brand/30 bg-brand-soft text-brand-ink",
  positive: "border-positive/25 bg-positive/10 text-positive",
  caution: "border-caution/25 bg-caution/10 text-caution",
  critical: "border-critical/25 bg-critical/10 text-critical",
} as const;

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_TONES;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-2xs font-semibold capitalize ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** One figure with its label and an optional sub-line. */
export function Stat({
  label,
  value,
  sub,
  size = "md",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <div className="min-w-0">
      <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</p>
      <p
        className={`mt-2 font-display font-semibold tracking-tight text-ink ${
          size === "lg" ? "text-4xl" : "text-2xl"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-sm text-ink-3">{sub}</p>}
    </div>
  );
}

export function Notice({ tone, children }: { tone: "success" | "error"; children: ReactNode }) {
  return (
    <p
      role="status"
      className={`rounded-control border px-3.5 py-2.5 text-sm ${
        tone === "success"
          ? "border-positive/25 bg-positive/10 text-positive"
          : "border-critical/25 bg-critical/10 text-critical"
      }`}
    >
      {children}
    </p>
  );
}

/** Top bar shared by /account and /wallet. */
export function AppHeader({
  links,
  action,
}: {
  links?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-ink">
          <LogoMark className="h-8 w-8" title="Omegley" />
          Omegley
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          {links}
          <Link href="/chat" className={buttonClass({ size: "sm" })}>
            Start chatting
            <ArrowRight className="h-4 w-4" />
          </Link>
          {action}
        </div>
      </div>
    </header>
  );
}

/** Page title block: eyebrow → h1 → lede, with optional right-hand slot. */
export function PageHeading({
  label,
  title,
  lede,
  aside,
}: {
  label: string;
  title: ReactNode;
  lede?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="eyebrow">{label}</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          {title}
        </h1>
        {lede && <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-2">{lede}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

/** Ambient page glow used behind the signed-in screens. */
export function PageGlow() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
      <div className="absolute left-1/2 top-[-12%] h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-brand/15 blur-[120px]" />
    </div>
  );
}
