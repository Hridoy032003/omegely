import type { SVGProps } from "react";

/**
 * Line icons for the console. These replace the bare typographic glyphs
 * (▦ ◎ ! ✦) the sidebar used to render, which carried no meaning for a screen
 * reader and no shared weight or grid.
 */
type Props = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  width: 18,
  height: 18,
  "aria-hidden": true,
} as const;

export const Grid = (p: Props) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
  </svg>
);

export const Users = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M2.8 19.5c.6-3.6 2.9-5.4 6.2-5.4s5.6 1.8 6.2 5.4" />
    <path d="M16.5 5.2a3.4 3.4 0 0 1 0 6.1M18 14.4c2.2.6 3.4 2.3 3.8 5.1" />
  </svg>
);

export const Shield = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M12 3 5 5.8v5.4c0 4 2.8 7.7 7 9.1 4.2-1.4 7-5.1 7-9.1V5.8Z" />
    <path d="M12 9v3.6M12 16h.01" />
  </svg>
);

export const Chat = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M20 13.5a4 4 0 0 1-4 4H9l-5 3V7a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4Z" />
    <path d="M8.5 8.5h7M8.5 12h4.5" />
  </svg>
);

export const Coins = (p: Props) => (
  <svg {...base} {...p}>
    <ellipse cx="12" cy="6" rx="7" ry="3" />
    <path d="M5 6v5c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
    <path d="M5 11v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
  </svg>
);

export const Cog = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M19.4 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </svg>
);

export const Refresh = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M20 11a8 8 0 0 0-13.7-5L4 8.2" />
    <path d="M4 4v4.4h4.4M4 13a8 8 0 0 0 13.7 5L20 15.8" />
    <path d="M20 19.6v-4.4h-4.4" />
  </svg>
);

export const SignOut = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M9.5 4.5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3.5" />
    <path d="M15 8.5 19 12l-4 3.5M19 12H9.5" />
  </svg>
);

export const Chevron = (p: Props) => (
  <svg {...base} {...p}>
    <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
  </svg>
);

export const Ban = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="m6.2 6.2 11.6 11.6" />
  </svg>
);

export const Inbox = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M4 13.5V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6.5" />
    <path d="M4 13.5h4l1.4 2.5h5.2l1.4-2.5h4v3.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
  </svg>
);
