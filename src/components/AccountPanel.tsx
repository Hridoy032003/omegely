"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase-browser";
import { ArrowRight, Check } from "@/components/icons";
import {
  AppHeader,
  Badge,
  Button,
  CONTROL,
  Field,
  Notice,
  PageGlow,
  PageHeading,
  Panel,
  PanelHead,
  buttonClass,
} from "@/components/ui";

type Profile = {
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  interests: string[] | null;
  profile_visibility: "public" | "private";
  referral_code: string | null;
  coin_balance: number;
  total_earned: number;
  reserved_coins: number;
};

const EMPTY_PROFILE: Profile = {
  display_name: "",
  avatar_url: "",
  bio: "",
  interests: [],
  profile_visibility: "private",
  referral_code: null,
  coin_balance: 0,
  total_earned: 0,
  reserved_coins: 0,
};

type Feedback = { tone: "success" | "error"; text: string } | null;

function googleDetails(user: User) {
  const metadata = user.user_metadata ?? {};
  const name =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : user.email?.split("@")[0] || "Omegley user";
  const avatar =
    typeof metadata.avatar_url === "string"
      ? metadata.avatar_url
      : typeof metadata.picture === "string"
        ? metadata.picture
        : "";
  return { name, avatar };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("Authentication is taking too long. Check your connection and try again.")),
      timeoutMs,
    );
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M21.35 12.27c0-.79-.07-1.55-.23-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42Z" />
      <path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.93-3.31.93-2.54 0-4.7-1.72-5.47-4.03H3.28v2.52A9.75 9.75 0 0 0 12 21.75Z" />
      <path fill="#FBBC05" d="M6.53 13.84A5.86 5.86 0 0 1 6.22 12c0-.64.11-1.26.31-1.84V7.64H3.28A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.03 4.36l3.25-2.52Z" />
      <path fill="#EA4335" d="M12 6.13c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.2 14.63 2.25 12 2.25a9.75 9.75 0 0 0-8.72 5.39l3.25 2.52c.77-2.31 2.93-4.03 5.47-4.03Z" />
    </svg>
  );
}

export default function AccountPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  const loadProfile = useCallback(async (currentUser: User) => {
    const google = googleDetails(currentUser);
    void supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", currentUser.id);
    const anonymousWallet = window.localStorage.getItem("omegley_anonymous_wallet");
    if (anonymousWallet) {
      const { data: claimed } = await supabase.rpc("claim_anonymous_wallet", { p_wallet_id: anonymousWallet });
      if (Number(claimed ?? 0) > 0) window.localStorage.removeItem("omegley_anonymous_wallet");
    }

    const referralCode = window.localStorage.getItem("omegley_referral_code");
    if (referralCode) {
      const { data: claimed } = await supabase.rpc("claim_referral", { p_referral_code: referralCode });
      if (claimed) window.localStorage.removeItem("omegley_referral_code");
    }
    await supabase.rpc("qualify_referrals");

    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, bio, interests, profile_visibility, referral_code, coin_balance, total_earned, reserved_coins")
      .eq("id", currentUser.id)
      .maybeSingle();

    const fallbackReferralCode = data?.referral_code || currentUser.id.replaceAll("-", "").slice(0, 10);
    setProfile({
      ...EMPTY_PROFILE,
      ...(data ?? {}),
      display_name: data?.display_name || google.name,
      avatar_url: google.avatar || data?.avatar_url || "",
      profile_visibility: data?.profile_visibility === "public" ? "public" : "private",
      referral_code: fallbackReferralCode,
    });

    if (!data?.referral_code) {
      void supabase.from("profiles").update({ referral_code: fallbackReferralCode }).eq("id", currentUser.id);
    }

    if (data && (google.name || google.avatar) && (!data.display_name || !data.avatar_url)) {
      void supabase
        .from("profiles")
        .update({
          display_name: data.display_name || google.name || null,
          avatar_url: data.avatar_url || google.avatar || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentUser.id);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const referralCode = params.get("ref");
    if (params.get("mode") === "signup") setMode("signup");
    if (referralCode) window.localStorage.setItem("omegley_referral_code", referralCode.toLowerCase());

    void supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      if (data.user) void loadProfile(data.user);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) void loadProfile(session.user);
      else setProfile(EMPTY_PROFILE);
    });

    const refreshOnFocus = () => {
      void supabase.auth.getUser().then(({ data: current }) => {
        if (current.user) void loadProfile(current.user);
      });
    };
    window.addEventListener("focus", refreshOnFocus);

    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [loadProfile]);

  const authenticate = async (event: FormEvent) => {
    event.preventDefault();
    if (!isSupabaseConfigured) {
      setFeedback({ tone: "error", text: "Account access is not configured on this deployment. Add the public Supabase URL and publishable key, then redeploy." });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const result = await withTimeout(
        mode === "login"
          ? supabase.auth.signInWithPassword({ email, password })
          : supabase.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: `${window.location.origin}/account` },
            }),
        15000,
      );

      if (result.error) {
        setFeedback({ tone: "error", text: result.error.message });
      } else {
        setFeedback({
          tone: "success",
          text:
            mode === "signup"
              ? "Account created. Check your email if confirmation is enabled."
              : "Signed in.",
        });
      }
    } catch (error) {
      setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Could not reach the account service. Try again." });
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setFeedback(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/account` },
    });
    if (error) setFeedback({ tone: "error", text: error.message });
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: profile.display_name?.trim() || null,
        avatar_url: profile.avatar_url?.trim() || null,
        bio: profile.bio?.trim() || null,
        interests: profile.interests ?? [],
        profile_visibility: profile.profile_visibility,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) setFeedback({ tone: "error", text: error.message });
    else {
      setFeedback({ tone: "success", text: "Profile saved." });
      setEditing(false);
    }
    setBusy(false);
  };

  const name = profile.display_name || (user ? googleDetails(user).name : "Omegley user");
  const initials = name.trim().slice(0, 1).toUpperCase() || "O";
  const provider =
    user?.app_metadata.provider === "google" || user?.app_metadata.providers?.includes("google")
      ? "Google"
      : "Email and password";
  const availableCoins = Math.max(0, profile.coin_balance - profile.reserved_coins);

  if (!user) {
    return (
      <main className="min-h-dvh">
        <PageGlow />
        <AppHeader
          links={
            <Link href="/" className="hidden text-sm text-ink-2 transition-colors hover:text-ink sm:inline">
              Back home
            </Link>
          }
        />
        <div className="container-page grid items-center gap-12 py-16 lg:grid-cols-[1fr_minmax(360px,420px)] lg:gap-20 lg:py-24">
          <div>
            <p className="eyebrow">Omegley account</p>
            <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl">
              Your profile,
              <br />
              <span className="gradient-text">your choice.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-ink-2">
              An account is optional. Save a profile for a more personal experience, or jump
              straight into random chat without registering.
            </p>
            <ul className="mt-9 grid gap-3">
              {[
                "Sign in with Google or an email address",
                "Earn 100 coins for every qualified referral",
                "Chat without an account whenever you prefer",
              ].map((line) => (
                <li key={line} className="flex items-center gap-3 text-sm text-ink-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-positive/15 text-positive">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <Panel className="p-6 sm:p-7">
            <div
              role="tablist"
              aria-label="Account access"
              className="grid grid-cols-2 gap-1 rounded-control border border-line bg-black/20 p-1"
            >
              {(["login", "signup"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => {
                    setMode(value);
                    setFeedback(null);
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    mode === value ? "bg-brand-soft text-ink" : "text-ink-3 hover:text-ink"
                  }`}
                >
                  {value === "login" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            <form onSubmit={authenticate} className="mt-6 grid gap-4">
              <Field label="Email" htmlFor="account-email">
                <input
                  id="account-email"
                  className={CONTROL}
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field label="Password" htmlFor="account-password">
                <input
                  id="account-password"
                  className={CONTROL}
                  required
                  minLength={8}
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
              <Button type="submit" disabled={busy} block size="md" className="mt-1">
                {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
                {!busy && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3 text-2xs uppercase tracking-[0.16em] text-ink-4">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>

            <Button variant="outline" block onClick={() => void signInWithGoogle()} type="button">
              <GoogleMark /> Continue with Google
            </Button>

            <p className="mt-6 text-center text-2xs leading-relaxed text-ink-4">
              By continuing, you agree to use Omegley respectfully and follow our{" "}
              <Link href="/guidelines" className="text-brand-ink hover:text-ink">
                community guidelines
              </Link>
              .
            </p>
            {feedback && <div className="mt-4"><Notice tone={feedback.tone}>{feedback.text}</Notice></div>}
          </Panel>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh">
      <PageGlow />
      <AppHeader
        action={
          <button
            type="button"
            className="text-sm text-ink-2 transition-colors hover:text-ink"
            onClick={() => void supabase.auth.signOut()}
          >
            Sign out
          </button>
        }
      />

      <div className="container-page py-12 md:py-16">
        <PageHeading
          label="Account settings"
          title={`Welcome back, ${name.split(" ")[0]}.`}
          lede="Manage your profile, see how your rewards are adding up, and control what a match can see."
        />

        <div className="mt-10 flex flex-wrap items-center gap-5 border-y border-line py-6">
          {profile.avatar_url ? (
            // Remote Google avatars aren't a configured next/image domain, and this
            // is a single fixed-size thumbnail, so a plain img is the right call.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              width={72}
              height={72}
              referrerPolicy="no-referrer"
              className="h-18 w-18 shrink-0 rounded-full border border-line object-cover"
            />
          ) : (
            <span className="flex h-18 w-18 shrink-0 items-center justify-center rounded-full border border-line bg-brand-soft font-display text-2xl font-bold text-brand-ink">
              {initials}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-xl font-semibold tracking-tight text-ink">{name}</h2>
            <p className="mt-1 truncate text-sm text-ink-3">{user.email}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing((value) => !value);
              setFeedback(null);
            }}
          >
            {editing ? "Close editor" : "Edit profile"}
          </Button>
        </div>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
          <Panel className="p-6 sm:p-7">
            <PanelHead
              label="Public profile"
              title="Profile details"
              description="These details are shared with a match only while your chat profile is public."
              action={
                !editing && (
                  <button
                    type="button"
                    className="text-sm font-medium text-brand-ink transition-colors hover:text-ink"
                    onClick={() => setEditing(true)}
                  >
                    Edit details
                  </button>
                )
              }
            />

            {editing ? (
              <form onSubmit={saveProfile} className="mt-7 grid gap-5">
                <Field label="Display name" htmlFor="profile-name">
                  <input
                    id="profile-name"
                    className={CONTROL}
                    placeholder="Your name"
                    value={profile.display_name ?? ""}
                    onChange={(event) => setProfile({ ...profile, display_name: event.target.value })}
                  />
                </Field>
                <Field label="About you" htmlFor="profile-bio">
                  <textarea
                    id="profile-bio"
                    className={`${CONTROL} min-h-28 resize-y`}
                    placeholder="A short introduction (optional)"
                    value={profile.bio ?? ""}
                    onChange={(event) => setProfile({ ...profile, bio: event.target.value })}
                  />
                </Field>
                <Field label="Interests" hint="Separate with commas" htmlFor="profile-interests">
                  <input
                    id="profile-interests"
                    className={CONTROL}
                    placeholder="Music, travel, gaming"
                    value={(profile.interests ?? []).join(", ")}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        interests: event.target.value.split(",").map((item) => item.trim()).filter(Boolean),
                      })
                    }
                  />
                </Field>

                <Field label="Chat profile" htmlFor="profile-visibility">
                  <select
                    id="profile-visibility"
                    className={CONTROL}
                    value={profile.profile_visibility}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        profile_visibility: event.target.value === "public" ? "public" : "private",
                      })
                    }
                  >
                    <option value="private">Private — nothing is shared with your match</option>
                    <option value="public">Public — share my name, photo, bio and interests</option>
                  </select>
                  <p className="text-2xs leading-relaxed text-ink-4">
                    Public sends these details straight to the person you are matched with, peer to
                    peer. Switch back to private at any time.
                  </p>
                </Field>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button type="submit" variant="brand" disabled={busy}>
                    {busy ? "Saving…" : "Save changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setEditing(false);
                      setFeedback(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <dl className="mt-7 border-t border-line">
                <ReadRow label="Display name">{name}</ReadRow>
                <ReadRow label="About">{profile.bio || "No bio added yet."}</ReadRow>
                <ReadRow label="Interests">
                  {profile.interests?.length ? (
                    <span className="flex flex-wrap gap-2">
                      {profile.interests.map((interest) => (
                        <Badge key={interest} tone="brand">
                          {interest}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    "No interests added yet."
                  )}
                </ReadRow>
                <ReadRow label="Chat profile">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone={profile.profile_visibility === "public" ? "positive" : "neutral"}>
                      {profile.profile_visibility}
                    </Badge>
                    <span className="text-ink-3">
                      {profile.profile_visibility === "public"
                        ? "Shared with your match"
                        : "Not shared with anyone"}
                    </span>
                  </span>
                </ReadRow>
              </dl>
            )}

            {feedback && <div className="mt-6"><Notice tone={feedback.tone}>{feedback.text}</Notice></div>}
          </Panel>

          <div className="grid gap-6">
            <Panel tone="brand" className="p-6">
              <PanelHead label="Omegley wallet" title="Your rewards" />
              <p className="mt-4 text-sm leading-relaxed text-ink-2">
                Earn coins through connections and referrals, then manage redemptions in your wallet.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-3">Total wallet</p>
                  <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">
                    {profile.coin_balance.toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-brand-ink">coins</p>
                </div>
                <div>
                  <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-3">Available to withdraw</p>
                  <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">
                    {availableCoins.toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-brand-ink">coins</p>
                </div>
              </div>
              <p title="100 coins = 1 dollar" className="mt-2 text-2xs text-ink-4">100 coins = 1 dollar. Coins are the wallet unit.</p>
              <Link href="/wallet" className={`${buttonClass({ variant: "brand", size: "sm", block: true })} mt-5`}>
                Open wallet
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Panel>

            <Panel className="p-6">
              <PanelHead label="Account" title="Account details" />
              <dl className="mt-5 border-t border-line">
                <ReadRow label="Email" compact>{user.email}</ReadRow>
                <ReadRow label="Sign-in method" compact>{provider}</ReadRow>
                <ReadRow label="Member since" compact>{formatMemberDate(user.created_at)}</ReadRow>
              </dl>
            </Panel>

            <Panel className="p-6">
              <PanelHead label="Your privacy" title="Stay in control" />
              <p className="mt-4 text-sm leading-relaxed text-ink-2">
                Your account is optional — random chat works without signing in, and conversations
                are never recorded either way.
              </p>
              <Link
                href="/privacy"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-ink transition-colors hover:text-ink"
              >
                Read our privacy policy
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Panel>
          </div>
        </div>
      </div>
    </main>
  );
}

function ReadRow({
  label,
  children,
  compact = false,
}: {
  label: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`grid gap-1.5 border-b border-line py-4 ${
        compact ? "sm:grid-cols-[1fr_auto] sm:gap-4" : "sm:grid-cols-[150px_1fr] sm:gap-5"
      }`}
    >
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd
        className={`min-w-0 text-sm leading-relaxed text-ink ${
          compact ? "sm:truncate sm:text-right" : ""
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

function formatMemberDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(value));
}
