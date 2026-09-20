import Link from "next/link";
import { LogoMark } from "@/components/logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/chat", label: "Start chatting" },
      { href: "/#features", label: "Features" },
      { href: "/#how", label: "How it works" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
      { href: "/cookies", label: "Cookie Policy" },
      { href: "/guidelines", label: "Community Guidelines" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-neutral-950">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 md:grid-cols-4">
        <div className="sm:col-span-2 md:col-span-2">
          <Link href="/" className="flex w-fit items-center gap-2 font-display text-lg font-bold">
            <LogoMark className="h-8 w-8" title="Omegley" />
            Omegley
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-neutral-400">
            Meet someone new in one click. Free, anonymous, peer-to-peer video &
            text chat — private by design, with nothing stored.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold text-white">{col.title}</h3>
            <ul className="mt-4 space-y-3">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="cursor-pointer text-sm text-neutral-400 transition-colors hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h3 className="text-sm font-semibold text-white">Contact</h3>
          <ul className="mt-4 space-y-3">
            <li>
              <a
                href="mailto:support@omegley.in"
                className="text-sm text-neutral-400 transition-colors hover:text-white"
              >
                Support &amp; reports
              </a>
            </li>
            <li>
              <a
                href="mailto:info@omegley.in"
                className="text-sm text-neutral-400 transition-colors hover:text-white"
              >
                General enquiries
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-6 text-xs text-neutral-500 sm:flex-row">
          <p>© {new Date().getFullYear()} Omegley. All rights reserved.</p>
          <p>Be kind. You must be 18+ to use Omegley.</p>
        </div>
      </div>
    </footer>
  );
}
