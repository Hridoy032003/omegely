import Link from "next/link";
import Footer from "@/components/marketing/Footer";

export default function EarnPageLayout({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <main className="min-h-[70vh] bg-canvas">
        <div className="container-page py-12 sm:py-16 md:py-24">
          <Link href="/" className="text-sm text-ink-3 transition-colors hover:text-ink">
            ← Back to Omegley
          </Link>
          <article className="mx-auto mt-14 max-w-4xl">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
              {title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-2">{description}</p>
            <div className="legal-prose mt-12 space-y-7">{children}</div>
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}

export function EarnHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="pt-5 font-display text-2xl font-bold text-ink">{children}</h2>;
}

export function EarnText({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

export function EarnList({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-brand-ink">{children}</ul>;
}

export function EarnCallout({ children }: { children: React.ReactNode }) {
  return <div className="rounded-panel border border-brand/25 bg-brand-soft p-5 text-ink-2">{children}</div>;
}
