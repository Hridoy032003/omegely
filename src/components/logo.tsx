import type { SVGProps } from "react";

/**
 * Omegley brand mark — an original design.
 *
 * A rounded speech bubble (the "O" of Omegley + the idea of conversation) with
 * a play glyph inside ("press start, meet someone"). Two small dots sit above
 * the play to hint at two people connecting. Flat, solid fills — deliberately
 * not the generic gradient-rounded-square + line-icon look.
 */
export function LogoMark({
  title,
  ...props
}: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {/* bubble body + tail share one fill so they read as a single shape */}
      <path
        d="M20 4C11.2 4 4 10.4 4 18.4c0 4.2 2 8 5.3 10.6-.3 2.6-1.4 5-3.1 6.9 3.4-.3 6.6-1.5 9.3-3.4 1.4.4 2.9.6 4.5.6 8.8 0 16-6.4 16-14.3S28.8 4 20 4Z"
        fill="#4f46e5"
      />
      {/* play glyph — centered, "press start to talk" */}
      <path
        d="M16.4 11.2c0-1 1.1-1.6 1.9-1.1l7.4 4.5c.8.5.8 1.6 0 2.1l-7.4 4.5c-.8.5-1.9-.1-1.9-1.1V11.2Z"
        fill="#ffffff"
      />
    </svg>
  );
}

/** Mark + wordmark, for headers and the footer. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`flex items-center gap-2 font-display text-lg font-bold tracking-tight text-white ${className}`}
    >
      <LogoMark className="h-8 w-8" title="Omegley" />
      Omegley
    </span>
  );
}
