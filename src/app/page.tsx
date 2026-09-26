import Link from "next/link";
import Nav from "@/components/marketing/Nav";
import Footer from "@/components/marketing/Footer";
import Faq from "@/components/marketing/Faq";
import {
  ArrowRight,
  Check,
  EyeOff,
  Globe,
  Lock,
  MessageCircle,
  Mic,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Video,
  X,
  Zap,
} from "@/components/icons";

const STATS = [
  { value: "0", label: "Sign-ups required" },
  { value: "<3s", label: "Time to first match" },
  { value: "100%", label: "Peer-to-peer" },
  { value: "$0", label: "Forever free" },
];

const FEATURES = [
  {
    icon: Zap,
    title: "Instant random matching",
    body: "Start a random chat with someone new in seconds. No forms, no lobbies, and no account to create.",
  },
  {
    icon: Video,
    title: "Video chat with strangers",
    body: "Talk face-to-face with real-time video and voice in your browser, powered by modern WebRTC technology.",
  },
  {
    icon: MessageCircle,
    title: "Chat while you talk",
    body: "A built-in text panel rides alongside the call for links, names, or when you'd rather type.",
  },
  {
    icon: Globe,
    title: "See where they're from",
    body: "An approximate country flag adds context to every match, so the world feels a little smaller.",
  },
  {
    icon: EyeOff,
    title: "Anonymous chat",
    body: "No account, profile, or conversation history. When you leave a chat, there is nothing left behind.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    body: "Conversations flow directly between devices and are encrypted in transit — not through our servers.",
  },
];

const COMPARISON = [
  { label: "No account or sign-up", us: true, them: false },
  { label: "Nothing recorded or stored", us: true, them: false },
  { label: "Peer-to-peer, encrypted media", us: true, them: false },
  { label: "Built-in text chat", us: true, them: true },
  { label: "Works in the browser, no install", us: true, them: true },
  { label: "No intrusive ads", us: true, them: false },
  { label: "Free forever", us: true, them: false },
];

const STEPS = [
  {
    n: "01",
    title: "Allow camera & mic",
    body: "Open Omegley and give your browser permission. Nothing is stored — it stays on your device until the call.",
  },
  {
    n: "02",
    title: "Get matched instantly",
    body: "We pair you with a random person who's online right now. No repeats where we can avoid them.",
  },
  {
    n: "03",
    title: "Talk, chat, or skip",
    body: "Say hi, type a message, or hit Next to meet someone else. You're always one click from a fresh conversation.",
  },
];

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://www.omegley.in/#website",
      url: "https://www.omegley.in/",
      name: "Omegley",
      description:
        "Free random video chat with strangers for anonymous video, voice, and text conversations.",
      inLanguage: "en-US",
    },
    {
      "@type": "Organization",
      "@id": "https://www.omegley.in/#organization",
      name: "Omegley",
      url: "https://www.omegley.in/",
      logo: "https://www.omegley.in/icon.svg",
    },
    {
      "@type": "WebApplication",
      "@id": "https://www.omegley.in/#application",
      name: "Omegley Random Video Chat",
      url: "https://www.omegley.in/chat",
      applicationCategory: "SocialNetworkingApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires a modern browser with camera and microphone access.",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      description:
        "A free browser-based random video chat with strangers, including anonymous video, voice, and text chat.",
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <Nav />

      <main>
        {/* ---------------- HERO ---------------- */}
        <section className="relative overflow-hidden">
          {/* ambient background */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-[-10%] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[120px]" />
            <div className="absolute right-[8%] top-[30%] h-[320px] w-[320px] rounded-full bg-sky-500/10 blur-[100px]" />
            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
                backgroundSize: "56px 56px",
                maskImage:
                  "radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent)",
              }}
            />
          </div>

          <div className="container-page grid gap-14 py-20 md:py-28 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="animate-fadeUp">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-neutral-300">
                <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
                No sign-up · Browser or installable app · Free forever
              </span>

              <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
                Free random video chat
                <br />
                with <span className="gradient-text">strangers.</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-300">
                Omegley helps you talk to strangers online through free,
                anonymous 1-to-1 video, voice, and text chat. Meet someone new
                anywhere in the world—no signup, no download, and no history.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/chat"
                  className="group inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-semibold text-neutral-950 shadow-lg shadow-indigo-500/10 transition hover:bg-neutral-200"
                >
                  Start talking — free
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
                <a
                  href="#how"
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-white/15 px-7 py-3.5 text-base font-medium text-white transition hover:bg-white/5"
                >
                  See how it works
                </a>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-400">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-4 w-4 text-emerald-400" /> Encrypted in transit
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-indigo-300" /> Real people, right now
                </span>
              </div>
            </div>

            {/* Hero mockup — pure CSS, no external assets */}
            <div className="animate-fadeUp [animation-delay:120ms]">
              <HeroMockup />
            </div>
          </div>

          {/* stats bar */}
          <div className="container-page pb-16">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.label} className="bg-neutral-950 px-6 py-6 text-center">
                  <div className="font-display text-3xl font-bold text-white">
                    {s.value}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- FEATURES ---------------- */}
        <section id="features" className="scroll-mt-20 border-t border-white/10 py-20 md:py-28">
          <div className="container-page">
            <SectionHeading
              eyebrow="Features"
              title="Everything you need to just talk"
              subtitle="No clutter, no gimmicks — the features that matter, done really well."
            />

            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-white/20 hover:bg-white/[0.04]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-indigo-300 ring-1 ring-inset ring-white/10">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-semibold text-white">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                    {f.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- WHY BETTER ---------------- */}
        <section id="why" className="scroll-mt-20 border-t border-white/10 py-20 md:py-28">
          <div className="container-page grid gap-14 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionHeading
                align="left"
                eyebrow="Why Omegley"
                title="A better alternative to random chat sites"
                subtitle="Most “talk to strangers” sites bury you in ads, hoard your data, or route everything through their servers. We built the opposite."
              />
              <ul className="mt-8 space-y-4">
                {[
                  {
                    t: "Private by architecture, not by promise",
                    d: "Your video and chat go straight to the other person. We have no database and keep no logs of your conversations.",
                  },
                  {
                    t: "Zero friction",
                    d: "No account walls, no email verification, no “download our app.” Open the page and you're one click away.",
                  },
                  {
                    t: "Built to feel great",
                    d: "A fast, modern, accessible interface — keyboard-friendly, motion-aware, and beautiful on any screen.",
                  },
                ].map((row) => (
                  <li key={row.t} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                      <Check className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-medium text-white">{row.t}</p>
                      <p className="mt-1 text-sm leading-relaxed text-neutral-400">
                        {row.d}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* comparison card */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-white/10 px-6 py-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                <span>Feature</span>
                <span className="w-20 text-center text-white">Omegley</span>
                <span className="w-20 text-center">Others</span>
              </div>
              {COMPARISON.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-white/5 px-6 py-3.5 last:border-b-0"
                >
                  <span className="text-sm text-neutral-200">{row.label}</span>
                  <span className="flex w-20 justify-center">
                    {row.us ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                        <Check className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-neutral-600">
                        <X className="h-4 w-4" />
                      </span>
                    )}
                  </span>
                  <span className="flex w-20 justify-center">
                    {row.them ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-neutral-400">
                        <Check className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-neutral-600">
                        <X className="h-4 w-4" />
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- HOW IT WORKS ---------------- */}
        <section id="how" className="scroll-mt-20 border-t border-white/10 py-20 md:py-28">
          <div className="container-page">
            <SectionHeading
              eyebrow="How it works"
              title="How random video chat works"
              subtitle="No manual, no learning curve. If you can open a website, you can use Omegley."
            />
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {STEPS.map((s) => (
                <div
                  key={s.n}
                  className="relative rounded-2xl border border-white/10 bg-white/[0.02] p-7"
                >
                  <span className="font-display text-5xl font-extrabold text-white/10">
                    {s.n}
                  </span>
                  <h3 className="mt-3 font-display text-lg font-semibold text-white">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- SOCIAL PROOF ---------------- */}
        <section className="border-t border-white/10 py-20 md:py-28">
          <div className="container-page">
            <SectionHeading
              eyebrow="Loved by curious people"
              title="A friendlier way to meet the world"
            />
            <div className="mt-14 grid gap-4 md:grid-cols-3">
              {[
                {
                  quote:
                    "Finally a random chat that isn't covered in ads. It just works and it's genuinely fun.",
                  name: "Ava R.",
                  role: "Student",
                },
                {
                  quote:
                    "The fact that nothing is stored made me actually comfortable using it. Clean and fast.",
                  name: "Marco D.",
                  role: "Designer",
                },
                {
                  quote:
                    "I practiced a new language with strangers all over the world. Matching is instant.",
                  name: "Priya S.",
                  role: "Traveler",
                },
              ].map((t) => (
                <figure
                  key={t.name}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
                >
                  <div className="flex gap-0.5 text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-4 w-4" />
                    ))}
                  </div>
                  <blockquote className="mt-4 text-sm leading-relaxed text-neutral-200">
                    “{t.quote}”
                  </blockquote>
                  <figcaption className="mt-5 text-sm">
                    <span className="font-medium text-white">{t.name}</span>
                    <span className="text-neutral-500"> · {t.role}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- REFERRALS ---------------- */}
        <section id="earn" className="scroll-mt-20 border-t border-white/10 py-20 md:py-28">
          <div className="container-page grid gap-10 rounded-3xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/10 via-white/[0.02] to-transparent p-8 md:grid-cols-[1fr_auto] md:items-center md:p-12">
            <div>
              <SectionHeading align="left" eyebrow="Referral rewards" title="Invite friends. Earn real value." subtitle="Create your free account, share your personal invite link, and earn 1 Omegley coin — worth $1 — for every successful referral." />
              <p className="mt-4 text-sm text-neutral-500">Your balance and referral history are always visible from your account. No hidden tiers or confusing points system.</p>
            </div>
            <Link href="/account" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200">Create your invite link <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section id="faq" className="scroll-mt-20 border-t border-white/10 py-20 md:py-28">
          <div className="container-page">
            <SectionHeading eyebrow="FAQ" title="Questions, answered" />
            <div className="mt-14">
              <Faq />
            </div>
          </div>
        </section>

        {/* ---------------- FINAL CTA ---------------- */}
        <section className="border-t border-white/10 py-20 md:py-28">
          <div className="container-page">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600/20 via-violet-600/10 to-transparent p-10 text-center md:p-16">
              <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute left-1/2 top-0 h-64 w-[600px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-[100px]" />
              </div>
              <h2 className="mx-auto max-w-2xl font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Someone interesting is online right now.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-neutral-300">
                No sign-up. No downloads. Just press start and say hello.
              </p>
              <Link
                href="/chat"
                className="group mt-8 inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-base font-semibold text-neutral-950 transition hover:bg-neutral-200"
              >
                Start talking — free
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <p className="mt-4 text-xs text-neutral-500">You must be 18+ to use Omegley.</p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">
        {eyebrow}
      </span>
      <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-base leading-relaxed text-neutral-400">{subtitle}</p>
      )}
    </div>
  );
}

function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-indigo-500/20 to-violet-600/10 blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/80 shadow-2xl shadow-black/50 backdrop-blur">
        {/* browser chrome */}
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-3 rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-neutral-500">
            omegley.in/chat
          </span>
        </div>

        {/* remote video */}
        <div className="relative aspect-[4/5] bg-gradient-to-br from-neutral-800 to-neutral-900">
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs text-neutral-200 backdrop-blur">
            <Globe className="h-3.5 w-3.5" /> Japan
          </div>
          {/* animated "person" placeholder */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-24 w-24 animate-float rounded-full bg-gradient-to-br from-indigo-400/40 to-violet-500/40 blur-sm" />
          </div>

          {/* self preview */}
          <div className="absolute bottom-3 right-3 h-24 w-20 overflow-hidden rounded-lg border border-white/15 bg-gradient-to-br from-sky-500/30 to-emerald-500/20" />

          {/* controls */}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/60 to-transparent p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white">
              <Mic className="h-4 w-4" />
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-indigo-500 px-4 py-2 text-xs font-semibold text-white">
              Next
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white">
              <Video className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
