"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { LogoMark } from "@/components/logo";
import type { User } from "@supabase/supabase-js";

type Profile = {
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  interests: string[] | null;
};

const EMPTY_PROFILE: Profile = { display_name: "", avatar_url: "", bio: "", interests: [] };

function googleDetails(user: User) {
  const metadata = user.user_metadata ?? {};
  const name = typeof metadata.full_name === "string"
    ? metadata.full_name
    : typeof metadata.name === "string"
      ? metadata.name
      : user.email?.split("@")[0] || "Omegley user";
  const avatar = typeof metadata.avatar_url === "string"
    ? metadata.avatar_url
    : typeof metadata.picture === "string"
      ? metadata.picture
      : "";
  return { name, avatar };
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="google-mark" viewBox="0 0 24 24">
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
      else setProfile(EMPTY_PROFILE);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const loadProfile = async (currentUser: User) => {
    const google = googleDetails(currentUser);
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, bio, interests")
      .eq("id", currentUser.id)
      .maybeSingle();
    const nextProfile = {
      ...EMPTY_PROFILE,
      ...(data ?? {}),
      display_name: data?.display_name || google.name,
      avatar_url: google.avatar || data?.avatar_url || "",
    };
    setProfile(nextProfile);

    if (data && (google.name || google.avatar) && (!data.display_name || !data.avatar_url)) {
      void supabase.from("profiles").update({
        display_name: data.display_name || google.name || null,
        avatar_url: data.avatar_url || google.avatar || null,
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
    setMessage(error?.message ?? "Profile saved successfully.");
    if (!error) setEditing(false);
    setBusy(false);
  };

  const name = profile.display_name || (user ? googleDetails(user).name : "Omegley user");
  const initials = name.trim().slice(0, 1).toUpperCase() || "O";
  const provider = user?.app_metadata.provider === "google" || user?.app_metadata.providers?.includes("google") ? "Google" : "Email and password";

  return (
    <main className="account-page">
      <header className="account-nav">
        <Link href="/" className="account-logo"><LogoMark className="h-8 w-8" title="Omegley" /> Omegley</Link>
        <div className="account-nav-actions">
          <Link href="/chat" className="account-chat-link">Start chatting <span>→</span></Link>
          {user ? <button type="button" className="account-signout" onClick={() => void supabase.auth.signOut()}>Sign out</button> : <Link href="/" className="account-back-link">Back home</Link>}
        </div>
      </header>

      {user ? (
        <div className="account-content">
          <div className="account-page-heading">
            <div><p className="account-eyebrow">ACCOUNT SETTINGS</p><h1>Welcome back, {name.split(" ")[0]}.</h1><p>Manage your profile and account preferences.</p></div>
          </div>

          <section className="account-profile-hero">
            <div className="account-profile-summary">
              {profile.avatar_url ? <img src={profile.avatar_url} alt={`${name}'s Google profile`} className="account-avatar" referrerPolicy="no-referrer" /> : <span className="account-avatar account-avatar-fallback">{initials}</span>}
              <div className="account-summary-copy"><h2>{name}</h2><p>{user.email}</p></div>
              <button type="button" className="account-edit-button" onClick={() => { setEditing((value) => !value); setMessage(""); }}>{editing ? "Close editor" : "Edit profile"}</button>
            </div>
          </section>

          <div className="account-workspace">
            <section className="account-section">
              <div className="account-section-heading"><div><p className="account-eyebrow">PUBLIC PROFILE</p><h2>Profile details</h2><p>These details help people know who they are talking to.</p></div>{!editing && <button type="button" className="account-text-button" onClick={() => setEditing(true)}>Edit details</button>}</div>
              {editing ? (
                <form onSubmit={saveProfile} className="account-edit-form">
                  <label>Display name<input className="account-input" placeholder="Your name" value={profile.display_name ?? ""} onChange={(event) => setProfile({ ...profile, display_name: event.target.value })} /></label>
                  <label>About you<textarea className="account-input account-textarea" placeholder="A short introduction (optional)" value={profile.bio ?? ""} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} /></label>
                  <label>Interests <span className="field-hint">Separate with commas</span><input className="account-input" placeholder="Music, travel, gaming" value={(profile.interests ?? []).join(", ")} onChange={(event) => setProfile({ ...profile, interests: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label>
                  <div className="account-form-actions"><button disabled={busy} className="account-save-button" type="submit">{busy ? "Saving…" : "Save changes"}</button><button disabled={busy} type="button" className="account-cancel-button" onClick={() => { setEditing(false); setMessage(""); }}>Cancel</button></div>
                </form>
              ) : (
                <div className="profile-details-readonly"><div><span>Display name</span><strong>{name}</strong></div><div><span>About</span><strong>{profile.bio || "No bio added yet."}</strong></div><div><span>Interests</span><div className="interest-list">{profile.interests?.length ? profile.interests.map((interest) => <span key={interest}>{interest}</span>) : <strong>No interests added yet.</strong>}</div></div></div>
              )}
              {message && <p className={`account-message ${message.includes("success") || message === "Profile saved successfully." ? "success" : ""}`}>{message}</p>}
            </section>

            <aside className="account-sidebar-content">
              <section className="account-info-section"><p className="account-eyebrow">ACCOUNT</p><h2>Account details</h2><div className="account-info-row"><span>Email</span><strong>{user.email}</strong></div><div className="account-info-row"><span>Sign-in method</span><strong>{provider}</strong></div><div className="account-info-row"><span>Member since</span><strong>{formatMemberDate(user.created_at)}</strong></div></section>
              <section className="account-info-section account-privacy-note"><p className="account-eyebrow">YOUR PRIVACY</p><h2>Stay in control</h2><p>Your account is optional. You can still use random chat without signing in. Profile details are only used to improve your experience.</p><Link href="/privacy">Read our privacy policy →</Link></section>
            </aside>
          </div>
        </div>
      ) : (
        <div className="account-auth-layout">
          <section className="account-auth-intro"><p className="account-eyebrow">OMEGLEY ACCOUNT</p><h1>Your profile,<br /><span>your choice.</span></h1><p>An account is optional. Save a profile for a more personal experience, or jump straight into random chat without registering.</p><div className="auth-benefits"><span><i>✓</i> Google profile sync</span><span><i>✓</i> Your profile, your control</span><span><i>✓</i> Chat without an account</span></div></section>
          <section className="account-auth-panel"><div className="auth-tabs"><button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button><button type="button" className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Create account</button></div><form onSubmit={authenticate} className="auth-form"><label>Email<input className="account-input" required type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input className="account-input" required minLength={8} type="password" placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} /></label><button disabled={busy} className="account-save-button auth-submit" type="submit">{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}<span>→</span></button></form><div className="auth-divider"><span />or<span /></div><button type="button" className="google-button" onClick={() => void google()}><GoogleMark /> Continue with Google</button><p className="auth-note">By continuing, you agree to use Omegley respectfully and follow our community guidelines.</p>{message && <p className="account-message">{message}</p>}</section>
        </div>
      )}
    </main>
  );
}

function formatMemberDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(value));
}
