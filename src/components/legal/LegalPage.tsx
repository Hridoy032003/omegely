import Link from "next/link";
import Nav from "@/components/marketing/Nav";
import Footer from "@/components/marketing/Footer";

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/cookies", label: "Cookie Policy" },
  { href: "/guidelines", label: "Community Guidelines" },
];

export default function LegalPage({
  title,
  updated,
  active,
  children,
}: {
  title: string;
  updated: string;
  active: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <main className="container-page py-16 md:py-24">
        <div className="mx-auto max-w-5xl gap-12 lg:grid lg:grid-cols-[220px_1fr]">
          {/* side nav */}
          <aside className="mb-10 lg:mb-0">
            <div className="lg:sticky lg:top-24">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                Legal
              </p>
              <nav className="flex flex-col gap-1">
                {LEGAL_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`cursor-pointer rounded-lg px-3 py-2 text-sm transition ${
                      l.href === active
                        ? "bg-white/10 font-medium text-white"
                        : "text-neutral-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
            </div>
          </aside>

          {/* content */}
          <article>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 text-sm text-neutral-500">Last updated: {updated}</p>

            <div className="legal-prose mt-10 space-y-6 text-[15px] leading-relaxed text-neutral-300">
              {children}
            </div>

            <div className="mt-14 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm text-neutral-400">
              Questions about this document? Contact us at{" "}
              <a
                href="mailto:support@omegley.in"
                className="cursor-pointer text-indigo-300 underline underline-offset-2 hover:text-indigo-200"
              >
                support@omegley.in
              </a>
              .
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}

/** Small styled building blocks so each legal page stays readable & consistent. */
export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="pt-4 font-display text-xl font-bold text-white">{children}</h2>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-neutral-600">
      {children}
    </ul>
  );
}
