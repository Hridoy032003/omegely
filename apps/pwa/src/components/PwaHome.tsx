"use client";

import { FormEvent, useEffect, useState } from "react";
import InstallPrompt from "./InstallPrompt";
import { supabase } from "../lib/supabase";

export default function PwaHome() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMessage(error?.message ?? "Signed in successfully.");
    setBusy(false);
  };

  const signUp = async () => {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signUp({ email, password });
    setMessage(error?.message ?? "Check your email to confirm your account.");
    setBusy(false);
  };

  return (
    <main className="shell">
      <InstallPrompt />
      <p className="eyebrow">OMEGLEY MOBILE</p>
      <h1>Meet someone new.</h1>
      <p className="lede">Install the app-like Omegley experience and start a real random video chat from your phone.</p>
      <a className="start" href={process.env.NEXT_PUBLIC_CHAT_URL ?? "https://www.omegley.in/chat"}>
        Start random chat
      </a>
      <section className="account-card">
        <h2>{userEmail ? `Signed in as ${userEmail}` : "Optional account"}</h2>
        {userEmail ? (
          <button type="button" className="secondary" onClick={() => void supabase.auth.signOut()}>
            Sign out
          </button>
        ) : (
          <form onSubmit={signIn}>
            <input required type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
            <input required minLength={6} type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
            <div className="form-actions">
              <button disabled={busy} type="submit">Sign in</button>
              <button disabled={busy} type="button" className="secondary" onClick={() => void signUp()}>Create account</button>
            </div>
          </form>
        )}
        {message && <p className="message">{message}</p>}
      </section>
      <p className="note">Your account is optional. Video and audio still connect peer-to-peer.</p>
    </main>
  );
}
