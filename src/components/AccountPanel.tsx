"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import type { User } from "@supabase/supabase-js";

type Profile = {
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  interests: string[] | null;
};

const EMPTY_PROFILE: Profile = { display_name: "", avatar_url: "", bio: "", interests: [] };

export default function AccountPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      if (data.user) void loadProfile(data.user);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) void loadProfile(session.user);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const loadProfile = async (currentUser: User) => {
    const metadata = currentUser.user_metadata ?? {};
    const googleName = typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : "";
    const googleAvatar = typeof metadata.avatar_url === "string"
      ? metadata.avatar_url
      : typeof metadata.picture === "string"
        ? metadata.picture
        : "";
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, bio, interests")
      .eq("id", currentUser.id)
      .maybeSingle();
    const nextProfile = {
      ...EMPTY_PROFILE,
      ...(data ?? {}),
      display_name: data?.display_name || googleName,
      avatar_url: googleAvatar || data?.avatar_url || "",
    };
    setProfile(nextProfile);

    // Persist Google profile details once so the admin dashboard can use them.
    if (data && (googleName || googleAvatar) && (!data.display_name || !data.avatar_url)) {
      void supabase.from("profiles").update({
        display_name: data.display_name || googleName || null,
        avatar_url: data.avatar_url || googleAvatar || null,
        updated_at: new Date().toISOString(),
      }).eq("id", currentUser.id);
    }
  };

  const authenticate = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/account` } });
    if (result.error) setMessage(result.error.message);
    else setMessage(mode === "signup" ? "Account created. Check your email if confirmation is enabled." : "Signed in.");
    setBusy(false);
  };

  const google = async () => {
    setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/account` } });
    if (error) setMessage(error.message);
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      display_name: profile.display_name?.trim() || null,
      avatar_url: profile.avatar_url?.trim() || null,
      bio: profile.bio?.trim() || null,
      interests: profile.interests ?? [],
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    setMessage(error?.message ?? "Profile saved.");
    setBusy(false);
  };

  return (
    <main className="container-page min-h-screen py-16">
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Omegley account</p>
        <h1 className="mt-4 font-display text-4xl font-extrabold text-white">Your profile, your choice.</h1>
        <p className="mt-4 text-neutral-400">An account is optional. You can still start a random chat without registering.</p>

        {user ? (
          <form onSubmit={saveProfile} className="mt-10 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-sm text-neutral-400">Signed in as <span className="text-white">{user.email}</span></p>
            {profile.avatar_url && (
              <img src={profile.avatar_url} alt="Your Google profile" className="h-16 w-16 rounded-full border border-white/15 object-cover" referrerPolicy="no-referrer" />
            )}
            <input className="account-input" placeholder="Display name" value={profile.display_name ?? ""} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} />
            <textarea className="account-input min-h-28" placeholder="Short bio" value={profile.bio ?? ""} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
            <input className="account-input" placeholder="Interests, separated by commas" value={(profile.interests ?? []).join(", ")} onChange={(e) => setProfile({ ...profile, interests: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} />
            <div className="flex flex-wrap gap-3">
              <button disabled={busy} className="rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white" type="submit">Save profile</button>
              <button type="button" className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-neutral-200" onClick={() => void supabase.auth.signOut()}>Sign out</button>
            </div>
          </form>
        ) : (
          <form onSubmit={authenticate} className="mt-10 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex gap-2 rounded-full bg-white/5 p-1 text-sm">
              <button type="button" className={`flex-1 rounded-full px-4 py-2 ${mode === "login" ? "bg-white text-neutral-950" : "text-neutral-300"}`} onClick={() => setMode("login")}>Sign in</button>
              <button type="button" className={`flex-1 rounded-full px-4 py-2 ${mode === "signup" ? "bg-white text-neutral-950" : "text-neutral-300"}`} onClick={() => setMode("signup")}>Create account</button>
            </div>
            <input className="account-input" required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="account-input" required minLength={8} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button disabled={busy} className="w-full rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white" type="submit">{mode === "login" ? "Sign in" : "Register"}</button>
            <div className="flex items-center gap-3 text-xs text-neutral-600"><span className="h-px flex-1 bg-white/10" />OR<span className="h-px flex-1 bg-white/10" /></div>
            <button type="button" className="w-full rounded-full border border-white/15 px-5 py-2.5 text-sm text-neutral-200" onClick={() => void google()}>Continue with Google</button>
          </form>
        )}
        {message && <p className="mt-4 text-sm text-indigo-200">{message}</p>}
      </div>
    </main>
  );
}
