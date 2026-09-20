"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase-browser";

type DashboardData = {
  counts: { users: number; banned: number; reports: number; openReports: number };
  users: Array<{ id: string; email: string | null; display_name: string | null; role: string; is_banned: boolean; created_at: string; last_seen: string | null }>;
  reports: Array<{ id: string; reporter_id: string | null; target_user_id: string | null; reason: string; details: string | null; status: string; created_at: string; reviewed_at: string | null }>;
};

const EMPTY: DashboardData = { counts: { users: 0, banned: 0, reports: 0, openReports: 0 }, users: [], reports: [] };

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadDashboard = useCallback(async (accessToken: string) => {
    const response = await fetch("/api/admin/overview", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "Could not load dashboard.");
    setData(await response.json());
  }, []);

  const verifyAdmin = useCallback(async (nextSession: Session) => {
    const response = await fetch("/api/admin/session", { headers: { Authorization: `Bearer ${nextSession.access_token}` } });
    if (!response.ok) {
      await supabase.auth.signOut();
      throw new Error(response.status === 403 ? "This account is not an approved admin." : "Admin session expired.");
    }
    setSession(nextSession);
    await loadDashboard(nextSession.access_token);
  }, [loadDashboard]);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: current }) => {
      if (current.session) void verifyAdmin(current.session).catch((error: Error) => setMessage(error.message));
    });
  }, [verifyAdmin]);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { data: result, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else if (result.session) {
      try { await verifyAdmin(result.session); } catch (failure) { setMessage((failure as Error).message); }
    }
    setBusy(false);
  };

  const update = async (path: string, body: Record<string, unknown>) => {
    if (!session) return;
    setBusy(true);
    setMessage("");
    const response = await fetch(path, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body) });
    if (!response.ok) setMessage((await response.json().catch(() => ({}))).error ?? "Update failed.");
    else await loadDashboard(session.access_token);
    setBusy(false);
  };

  if (!session) {
    return (
      <main className="admin-shell">
        <p className="eyebrow">OMEGLEY ADMIN</p>
        <h1>Sign in</h1>
        <p className="muted">Private operations dashboard. Admin accounts are created and approved manually.</p>
        <form onSubmit={signIn}>
          <input required type="email" placeholder="Admin email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <input required type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <button disabled={busy} type="submit">{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        {message && <p className="error">{message}</p>}
      </main>
    );
  }

  return (
    <main className="admin-shell admin-wide">
      <header className="admin-header"><div><p className="eyebrow">OMEGLEY OPERATIONS</p><h1>Dashboard</h1></div><div className="header-actions"><button type="button" className="secondary" disabled={busy} onClick={() => void loadDashboard(session.access_token)}>Refresh</button><button type="button" className="secondary" onClick={() => void supabase.auth.signOut().then(() => setSession(null))}>Sign out</button></div></header>
      <section className="stats-grid"><Stat label="Total users" value={data.counts.users} /><Stat label="Open reports" value={data.counts.openReports} danger={data.counts.openReports > 0} /><Stat label="All reports" value={data.counts.reports} /><Stat label="Banned users" value={data.counts.banned} /></section>
      <section className="panel"><div className="panel-heading"><div><h2>Users</h2><p>Review profiles and control account access.</p></div></div><div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th><th>Action</th></tr></thead><tbody>
        {data.users.map((user) => <tr key={user.id}><td><strong>{user.display_name || "Unnamed user"}</strong><small>{user.email || "No email"}</small></td><td>{user.role}</td><td><span className={user.is_banned ? "badge red" : "badge green"}>{user.is_banned ? "Banned" : "Active"}</span></td><td>{formatDate(user.created_at)}</td><td><button className={user.is_banned ? "tiny" : "tiny danger"} disabled={busy} onClick={() => void update(`/api/admin/users/${user.id}`, { is_banned: !user.is_banned })}>{user.is_banned ? "Unban" : "Ban"}</button></td></tr>)}
        {!data.users.length && <tr><td colSpan={5} className="empty">No users yet.</td></tr>}
      </tbody></table></div></section>
      <section className="panel"><div className="panel-heading"><div><h2>Reports</h2><p>Review safety reports and record the decision.</p></div></div><div className="table-wrap"><table><thead><tr><th>Reason</th><th>Target</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody>
        {data.reports.map((report) => <tr key={report.id}><td><strong>{report.reason}</strong><small>{report.details || "No additional details"}</small></td><td>{report.target_user_id ? report.target_user_id.slice(0, 8) : "Guest session"}</td><td><span className="badge">{report.status}</span></td><td>{formatDate(report.created_at)}</td><td><select value={report.status} disabled={busy} onChange={(event) => void update(`/api/admin/reports/${report.id}`, { status: event.target.value })}><option value="open">Open</option><option value="reviewing">Reviewing</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></td></tr>)}
        {!data.reports.length && <tr><td colSpan={5} className="empty">No reports yet.</td></tr>}
      </tbody></table></div></section>
      {message && <p className="error">{message}</p>}
    </main>
  );
}

function Stat({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) { return <div className={`stat-card ${danger ? "stat-danger" : ""}`}><span>{label}</span><strong>{value}</strong></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)); }
