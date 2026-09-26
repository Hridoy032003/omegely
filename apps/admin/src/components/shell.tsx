"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useState, type ReactNode } from "react";
import { AdminProvider, useAdmin, useSignIn } from "@/lib/admin-store";
import { Chat, Coins, Cog, Grid, Refresh, Shield, SignOut, Users } from "@/components/icons";

type NavItem = { href: string; label: string; icon: ReactNode };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: <Grid className="nav-icon" /> },
  { href: "/users", label: "Users", icon: <Users className="nav-icon" /> },
  { href: "/reports", label: "Safety reports", icon: <Shield className="nav-icon" /> },
  { href: "/feedback", label: "Feedback", icon: <Chat className="nav-icon" /> },
  { href: "/earnings", label: "Earnings", icon: <Coins className="nav-icon" /> },
  { href: "/settings", label: "Settings", icon: <Cog className="nav-icon" /> },
];

const DESCRIPTIONS: Record<string, string> = {
  "/dashboard": "A live view of your users, safety queue, and product signals.",
  "/users": "Review profiles, account status, and access controls.",
  "/reports": "Keep conversations safe by reviewing user reports.",
  "/feedback": "Listen to users and track product issues.",
  "/earnings": "Monitor referral growth, coin balances, and rewards issued.",
  "/settings": "Manage global rewards, withdrawals, and payout rules.",
};

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        O
      </span>
      <span className="brand-name">
        <strong>Omegley</strong>
        <span>Admin console</span>
      </span>
    </div>
  );
}

export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      {(auth) => {
        if (auth.phase === "loading") return <LoadingScreen />;
        if (auth.phase === "signed-out") return <SignInScreen error={auth.error} />;
        return <Chrome>{children}</Chrome>;
      }}
    </AdminProvider>
  );
}

function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data, busy, message, refresh, signOut, session } = useAdmin();
  const active = NAV.find((item) => pathname.startsWith(item.href)) ?? NAV[0];
  const adminName = session.user.email?.split("@")[0] || "Admin";

  return (
    <div className="app">
      <aside className="sidebar">
        <Brand />

        <div>
          <p className="nav-label">Workspace</p>
          <nav className="nav" aria-label="Admin sections">
            {NAV.map((item) => {
              const isActive = item.href === active.href;
              const count =
                item.href === "/reports"
                  ? data.counts.openReports
                  : item.href === "/feedback"
                    ? data.counts.openFeedback
                    : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-link"
                  aria-current={isActive ? "page" : undefined}
                  // Narrow screens collapse the sidebar to icons and `display:
                  // none` takes the label out of the accessibility tree too, so
                  // the link carries its own name and tooltip.
                  aria-label={item.label}
                  title={item.label}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {count > 0 && (
                    <em className="nav-count" aria-label={`${count} open`}>
                      {count}
                    </em>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-foot">
          <p className="status-line">
            <span className="status-dot" aria-hidden="true" />
            <span>
              <strong>System status</strong>
              <small>Admin services online</small>
            </span>
          </p>
          <button
            type="button"
            className="btn btn--ghost sign-out"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => void signOut()}
          >
            <SignOut />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <p className="crumbs">
            Omegley <span aria-hidden="true">/</span> <strong>{active.label}</strong>
          </p>
          <div className="topbar-actions">
            <button
              type="button"
              className="icon-btn"
              title="Refresh data"
              aria-label="Refresh data"
              disabled={busy}
              onClick={() => void refresh()}
            >
              <Refresh />
            </button>
            <div className="identity">
              <span className="identity-avatar" aria-hidden="true">
                {adminName.slice(0, 1).toUpperCase()}
              </span>
              <span className="identity-name">
                <strong>{adminName}</strong>
                <small>Administrator</small>
              </span>
            </div>
          </div>
        </header>

        <div className="content-scroll">
          <div className="content">
            {message && (
              <p className={`notice notice--${message.tone === "error" ? "error" : "success"}`} role="status">
                {message.text}
              </p>
            )}

            <div className="page-head">
              <div>
                <p className="eyebrow">Omegley operations</p>
                <h1>{active.label}</h1>
                <p className="lede">{DESCRIPTIONS[active.href]}</p>
              </div>
              <div className="head-actions">
                <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void refresh()}>
                  {busy ? "Refreshing…" : "Refresh data"}
                </button>
              </div>
            </div>

            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="gate">
      <section className="gate-card">
        <Brand />
        <div className="dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="muted" aria-live="polite">
          Checking your admin session…
        </p>
      </section>
    </main>
  );
}

function SignInScreen({ error }: { error: string | null }) {
  const signIn = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    await signIn(email, password);
    setBusy(false);
  };

  return (
    <main className="gate">
      <div className="gate-rings" aria-hidden="true" />
      <section className="gate-card">
        <Brand />
        <p className="eyebrow">Private workspace</p>
        <h1>Welcome back.</h1>
        <p className="muted">Sign in to manage users, safety reports, and product feedback.</p>

        <form onSubmit={submit} className="gate-form">
          <div className="field">
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              className="input"
              required
              type="email"
              autoComplete="username"
              placeholder="admin@omegley.in"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              className="input"
              required
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <button disabled={busy} type="submit" className="btn btn--primary btn--block">
            {busy ? "Signing in…" : "Sign in to dashboard"}
          </button>
        </form>

        {error && (
          <p className="notice notice--error" role="alert" style={{ marginTop: 16, marginBottom: 0 }}>
            {error}
          </p>
        )}
        <p className="gate-foot">Only approved administrator accounts can continue.</p>
      </section>
    </main>
  );
}
