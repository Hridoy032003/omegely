"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase-browser";

type Section = "dashboard" | "users" | "reports" | "feedback";

type DashboardData = {
  counts: { users: number; banned: number; reports: number; openReports: number; feedback: number; openFeedback: number };
  users: Array<{ id: string; email: string | null; display_name: string | null; role: string; is_banned: boolean; created_at: string; last_seen: string | null }>;
  reports: Array<{ id: string; reporter_id: string | null; target_user_id: string | null; reason: string; details: string | null; status: string; created_at: string; reviewed_at: string | null }>;
  feedback: Array<{ id: string; user_id: string | null; email: string | null; kind: string; message: string; page_url: string | null; status: string; admin_note: string | null; created_at: string; updated_at: string }>;
};

const EMPTY: DashboardData = {
  counts: { users: 0, banned: 0, reports: 0, openReports: 0, feedback: 0, openFeedback: 0 },
  users: [],
  reports: [],
  feedback: [],
};

const NAV_ITEMS: Array<{ id: Section; label: string; icon: string }> = [
  { id: "dashboard", label: "Overview", icon: "▦" },
  { id: "users", label: "Users", icon: "◎" },
  { id: "reports", label: "Safety reports", icon: "!" },
  { id: "feedback", label: "Feedback", icon: "✦" },
];

type UpdateAction = (path: string, body: Record<string, unknown>) => Promise<void>;

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadDashboard = useCallback(async (accessToken: string) => {
    const response = await fetch("/api/admin/overview", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error((await response.json().catch(() => ({}))).error ?? "Could not load dashboard.");
    }
    setData(await response.json());
  }, []);

  const verifyAdmin = useCallback(async (nextSession: Session) => {
    const response = await fetch("/api/admin/session", {
      headers: { Authorization: `Bearer ${nextSession.access_token}` },
    });
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
      try {
        await verifyAdmin(result.session);
      } catch (failure) {
        setMessage((failure as Error).message);
      }
    }
    setBusy(false);
  };

  const refresh = async () => {
    if (!session) return;
    setBusy(true);
    setMessage("");
    try {
      await loadDashboard(session.access_token);
    } catch (error) {
      setMessage((error as Error).message);
    }
    setBusy(false);
  };

  const update = async (path: string, body: Record<string, unknown>) => {
    if (!session) return;
    setBusy(true);
    setMessage("");
    const response = await fetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) setMessage((await response.json().catch(() => ({}))).error ?? "Update failed.");
    else await loadDashboard(session.access_token);
    setBusy(false);
  };

  if (!session) return <LoginScreen email={email} password={password} busy={busy} message={message} setEmail={setEmail} setPassword={setPassword} onSubmit={signIn} />;

  const adminName = session.user.email?.split("@")[0] || "Admin";

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="brand-mark">O</span>
          <span><strong>omegley</strong><small>ADMIN CONSOLE</small></span>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Admin sections">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-link ${activeSection === item.id ? "active" : ""}`}
              onClick={() => setActiveSection(item.id)}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === "reports" && data.counts.openReports > 0 && <em>{data.counts.openReports}</em>}
              {item.id === "feedback" && data.counts.openFeedback > 0 && <em>{data.counts.openFeedback}</em>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-status"><span className="status-dot" /> <span><strong>System status</strong><small>Admin services online</small></span></div>
          <button type="button" className="sidebar-signout" onClick={() => void supabase.auth.signOut().then(() => setSession(null))}>↪ <span>Sign out</span></button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-context"><span className="mobile-brand">O</span><span>Omegley / <strong>{sectionLabel(activeSection)}</strong></span></div>
          <div className="topbar-actions">
            <button type="button" className="icon-button" title="Refresh dashboard" aria-label="Refresh dashboard" disabled={busy} onClick={() => void refresh()}>↻</button>
            <div className="admin-identity"><span className="identity-avatar">{adminName.slice(0, 1).toUpperCase()}</span><span><strong>{adminName}</strong><small>Administrator</small></span></div>
          </div>
        </header>

        <div className="admin-content">
          {message && <div className="notice error"><span>!</span>{message}</div>}
          <div className="page-heading">
            <div><p className="eyebrow">OMEGLEY OPERATIONS</p><h1>{activeSection === "dashboard" ? "Overview" : sectionLabel(activeSection)}</h1><p className="page-subtitle">{sectionDescription(activeSection)}</p></div>
            <div className="heading-actions"><span className="last-updated">Live data</span><button type="button" className="primary-button" disabled={busy} onClick={() => void refresh()}>{busy ? "Refreshing…" : "Refresh data"}</button></div>
          </div>

          {activeSection === "dashboard" && <Overview data={data} onNavigate={setActiveSection} />}
          {activeSection === "users" && <UsersSection data={data} busy={busy} update={update} />}
          {activeSection === "reports" && <ReportsSection data={data} busy={busy} update={update} />}
          {activeSection === "feedback" && <FeedbackSection data={data} busy={busy} update={update} />}
        </div>
      </main>
    </div>
  );
}

function LoginScreen({ email, password, busy, message, setEmail, setPassword, onSubmit }: { email: string; password: string; busy: boolean; message: string; setEmail: (value: string) => void; setPassword: (value: string) => void; onSubmit: (event: FormEvent) => void }) {
  return (
    <main className="login-page">
      <div className="login-decoration" />
      <section className="login-card">
        <div className="admin-brand"><span className="brand-mark">O</span><span><strong>omegley</strong><small>ADMIN CONSOLE</small></span></div>
        <p className="eyebrow">PRIVATE WORKSPACE</p>
        <h1>Welcome back.</h1>
        <p className="muted">Sign in to manage users, safety reports, and product feedback.</p>
        <form onSubmit={onSubmit} className="login-form">
          <label>Email<input required type="email" placeholder="admin@omegley.in" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input required type="password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button disabled={busy} type="submit" className="primary-button full-width">{busy ? "Signing in…" : "Sign in to dashboard"}<span>→</span></button>
        </form>
        {message && <p className="error login-error">{message}</p>}
        <p className="login-footnote">Only approved administrator accounts can continue.</p>
      </section>
    </main>
  );
}

function Overview({ data, onNavigate }: { data: DashboardData; onNavigate: (section: Section) => void }) {
  const activity = useMemo(() => [
    ...data.reports.map((report) => ({ id: report.id, label: "Safety report", title: report.reason, status: report.status, created_at: report.created_at, tone: "red" })),
    ...data.feedback.map((item) => ({ id: item.id, label: "User feedback", title: item.message.replace(/^\[[^\]]+\]\s*/, ""), status: item.status, created_at: item.created_at, tone: "blue" })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6), [data.feedback, data.reports]);

  return (
    <>
      <section className="kpi-grid">
        <KpiCard label="Total users" value={data.counts.users} hint="Registered accounts" icon="◎" />
        <KpiCard label="Open reports" value={data.counts.openReports} hint="Need safety review" icon="!" danger={data.counts.openReports > 0} />
        <KpiCard label="Open feedback" value={data.counts.openFeedback} hint="Waiting for a response" icon="✦" danger={data.counts.openFeedback > 0} />
        <KpiCard label="Banned users" value={data.counts.banned} hint="Restricted accounts" icon="⊘" />
      </section>

      <div className="dashboard-grid">
        <section className="panel activity-panel">
          <PanelHeading title="Recent activity" description="The latest reports and messages from your community." action={<button type="button" className="text-button" onClick={() => onNavigate("feedback")}>View feedback →</button>} />
          {activity.length ? <div className="activity-list">{activity.map((item) => <div className="activity-row" key={`${item.label}-${item.id}`}><span className={`activity-icon ${item.tone}`}>{item.tone === "red" ? "!" : "✦"}</span><div className="activity-copy"><strong>{item.title}</strong><small>{item.label} · {formatDate(item.created_at)}</small></div><span className={`badge ${statusTone(item.status)}`}>{item.status}</span></div>)}</div> : <EmptyState title="No activity yet" text="New reports and feedback will appear here." />}
        </section>

        <section className="panel attention-panel">
          <PanelHeading title="Needs attention" description="Keep the community healthy." />
          <div className="attention-list">
            <button type="button" className="attention-card" onClick={() => onNavigate("reports")}><span className="attention-icon red">!</span><span><strong>{data.counts.openReports} open reports</strong><small>Review safety concerns</small></span><span className="chevron">›</span></button>
            <button type="button" className="attention-card" onClick={() => onNavigate("feedback")}><span className="attention-icon blue">✦</span><span><strong>{data.counts.openFeedback} open feedback</strong><small>Understand user needs</small></span><span className="chevron">›</span></button>
            <button type="button" className="attention-card" onClick={() => onNavigate("users")}><span className="attention-icon purple">◎</span><span><strong>{data.counts.users} total users</strong><small>Review account activity</small></span><span className="chevron">›</span></button>
          </div>
        </section>
      </div>

      <section className="panel quick-panel"><PanelHeading title="Quick overview" description="Jump to the part of the workspace you need." /><div className="quick-grid"><QuickLink title="Manage users" text="Review access and ban accounts." onClick={() => onNavigate("users")} /><QuickLink title="Safety reports" text="Resolve reports from conversations." onClick={() => onNavigate("reports")} /><QuickLink title="Product feedback" text="See what users want next." onClick={() => onNavigate("feedback")} /></div></section>
    </>
  );
}

function UsersSection({ data, busy, update }: { data: DashboardData; busy: boolean; update: UpdateAction }) {
  return <section className="panel table-panel"><PanelHeading title="Users" description="Review profiles and control account access." count={`${data.users.length} shown`} /><div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th><th>Action</th></tr></thead><tbody>{data.users.map((user) => <tr key={user.id}><td><div className="table-user"><span className="table-avatar">{(user.display_name || user.email || "U").slice(0, 1).toUpperCase()}</span><span><strong>{user.display_name || "Unnamed user"}</strong><small>{user.email || "No email"}</small></span></div></td><td><span className="role-label">{user.role}</span></td><td><span className={`badge ${user.is_banned ? "red" : "green"}`}>{user.is_banned ? "Banned" : "Active"}</span></td><td>{formatDate(user.created_at)}</td><td><button className={user.is_banned ? "tiny" : "tiny danger"} disabled={busy} onClick={() => void update(`/api/admin/users/${user.id}`, { is_banned: !user.is_banned })}>{user.is_banned ? "Unban" : "Ban user"}</button></td></tr>)}{!data.users.length && <EmptyTable colSpan={5} text="No users yet. New accounts will appear here." />}</tbody></table></div></section>;
}

function ReportsSection({ data, busy, update }: { data: DashboardData; busy: boolean; update: UpdateAction }) {
  return <section className="panel table-panel"><PanelHeading title="Safety reports" description="Review reports and record the decision." count={`${data.reports.length} total`} /><div className="table-wrap"><table><thead><tr><th>Reason</th><th>Target</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody>{data.reports.map((report) => <tr key={report.id}><td><strong>{report.reason}</strong><small>{report.details || "No additional details"}</small></td><td><span className="mono-label">{report.target_user_id ? report.target_user_id.slice(0, 8) : "Guest session"}</span></td><td><span className={`badge ${statusTone(report.status)}`}>{report.status}</span></td><td>{formatDate(report.created_at)}</td><td><select value={report.status} disabled={busy} onChange={(event) => void update(`/api/admin/reports/${report.id}`, { status: event.target.value })}><option value="open">Open</option><option value="reviewing">Reviewing</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></td></tr>)}{!data.reports.length && <EmptyTable colSpan={5} text="No safety reports yet." />}</tbody></table></div></section>;
}

function FeedbackSection({ data, busy, update }: { data: DashboardData; busy: boolean; update: UpdateAction }) {
  return <section className="panel table-panel"><PanelHeading title="Feedback & support" description="Read what users need and track follow-up." count={`${data.feedback.length} total`} /><div className="table-wrap"><table><thead><tr><th>Type</th><th>Message</th><th>Contact</th><th>Created</th><th>Action</th></tr></thead><tbody>{data.feedback.map((item) => <tr key={item.id}><td><span className={`badge ${item.kind === "safety" ? "red" : item.kind === "bug" ? "amber" : "blue"}`}>{item.kind}</span><small>{item.status}</small></td><td><strong>{item.message}</strong>{item.page_url && <small>{item.page_url}</small>}</td><td>{item.email || "Anonymous"}</td><td>{formatDate(item.created_at)}</td><td><select value={item.status} disabled={busy} onChange={(event) => void update(`/api/admin/feedback/${item.id}`, { status: event.target.value })}><option value="open">Open</option><option value="reviewing">Reviewing</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></td></tr>)}{!data.feedback.length && <EmptyTable colSpan={5} text="No feedback yet." />}</tbody></table></div></section>;
}

function KpiCard({ label, value, hint, icon, danger = false }: { label: string; value: number; hint: string; icon: string; danger?: boolean }) {
  return <div className={`kpi-card ${danger ? "kpi-danger" : ""}`}><div className="kpi-top"><span>{label}</span><span className="kpi-icon">{icon}</span></div><strong>{value}</strong><small>{hint}</small></div>;
}

function PanelHeading({ title, description, action, count }: { title: string; description: string; action?: React.ReactNode; count?: string }) {
  return <div className="panel-heading"><div><h2>{title}</h2><p>{description}</p></div>{action || (count && <span className="panel-count">{count}</span>)}</div>;
}

function QuickLink({ title, text, onClick }: { title: string; text: string; onClick: () => void }) {
  return <button type="button" className="quick-link" onClick={onClick}><span className="quick-link-icon">↗</span><span><strong>{title}</strong><small>{text}</small></span><span className="chevron">›</span></button>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><span className="empty-state-icon">⌁</span><strong>{title}</strong><p>{text}</p></div>;
}

function EmptyTable({ colSpan, text }: { colSpan: number; text: string }) {
  return <tr><td colSpan={colSpan} className="empty-table">{text}</td></tr>;
}

function sectionLabel(section: Section) {
  return NAV_ITEMS.find((item) => item.id === section)?.label || "Overview";
}

function sectionDescription(section: Section) {
  if (section === "users") return "Review profiles, account status, and access controls.";
  if (section === "reports") return "Keep conversations safe by reviewing user reports.";
  if (section === "feedback") return "Listen to users and track product issues.";
  return "A live view of your users, safety queue, and product signals.";
}

function statusTone(status: string) {
  if (status === "resolved") return "green";
  if (status === "dismissed") return "muted";
  if (status === "reviewing") return "amber";
  return "red";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}
