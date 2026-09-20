"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase-browser";

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else setSignedIn(true);
    setBusy(false);
  };

  if (signedIn) {
    return (
      <main className="admin-shell">
        <p className="eyebrow">OMEGLEY OPERATIONS</p>
        <h1>Admin dashboard</h1>
        <p className="muted">Authentication works. Reports, bans, and user metrics will appear after the shared Supabase schema is applied.</p>
        <button type="button" onClick={() => void supabase.auth.signOut().then(() => setSignedIn(false))}>Sign out</button>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <p className="eyebrow">OMEGLEY ADMIN</p>
      <h1>Sign in</h1>
      <p className="muted">This area is private. Only approved admin accounts should be able to continue.</p>
      <form onSubmit={submit}>
        <input required type="email" placeholder="Admin email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <input required type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <button disabled={busy} type="submit">{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      {message && <p className="error">{message}</p>}
    </main>
  );
}
