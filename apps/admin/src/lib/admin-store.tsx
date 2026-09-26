"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase-browser";

export type DashboardData = {
  counts: {
    users: number;
    banned: number;
    reports: number;
    openReports: number;
    feedback: number;
    openFeedback: number;
    referrals: number;
    coinsIssued: number;
  };
  users: Array<{
    id: string;
    email: string | null;
    display_name: string | null;
    role: string;
    is_banned: boolean;
    created_at: string;
    last_seen: string | null;
    referral_code: string | null;
    coin_balance: number;
    total_earned: number;
  }>;
  reports: Array<{
    id: string;
    reporter_id: string | null;
    target_user_id: string | null;
    reason: string;
    details: string | null;
    status: string;
    created_at: string;
    reviewed_at: string | null;
  }>;
  feedback: Array<{
    id: string;
    user_id: string | null;
    email: string | null;
    kind: string;
    message: string;
    page_url: string | null;
    status: string;
    admin_note: string | null;
    created_at: string;
    updated_at: string;
  }>;
  referrals: Array<{
    id: string;
    referrer_id: string;
    referred_id: string;
    referral_code: string;
    status: string;
    reward_coins: number;
    created_at: string;
    qualified_at: string;
  }>;
  withdrawals: Array<{
    id: string;
    user_id: string;
    amount_coins: number;
    amount_usd: number;
    method: string;
    destination: string;
    status: string;
    admin_note: string | null;
    created_at: string;
  }>;
};

export const EMPTY_DATA: DashboardData = {
  counts: {
    users: 0,
    banned: 0,
    reports: 0,
    openReports: 0,
    feedback: 0,
    openFeedback: 0,
    referrals: 0,
    coinsIssued: 0,
  },
  users: [],
  reports: [],
  feedback: [],
  referrals: [],
  withdrawals: [],
};

export type AdminState = {
  session: Session;
  data: DashboardData;
  busy: boolean;
  message: { tone: "error" | "success"; text: string } | null;
  setMessage: (message: AdminState["message"]) => void;
  refresh: () => Promise<void>;
  /** PATCH a resource, then pull fresh dashboard data. Surfaces failures. */
  patch: (path: string, body: Record<string, unknown>) => Promise<boolean>;
  /** POST a resource, then pull fresh dashboard data. Surfaces failures. */
  post: (path: string, body: Record<string, unknown>) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AdminContext = createContext<AdminState | null>(null);

export function useAdmin() {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin must be used inside <AdminProvider>");
  return value;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function errorFrom(response: Response, fallback: string) {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? fallback;
}

export type AuthState =
  | { phase: "loading" }
  | { phase: "signed-out"; error: string | null }
  | { phase: "ready"; state: AdminState };

/**
 * Holds the admin session and dashboard data for the whole console.
 *
 * This lives in the root layout, so moving between sections is a plain
 * client-side navigation — previously every section was its own copy of the
 * page component, which meant a full re-auth, refetch and loading flash on
 * every sidebar click.
 */
export function AdminProvider({ children }: { children: (auth: AuthState) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [authLoading, setAuthLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<AdminState["message"]>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (accessToken: string) => {
    const response = await fetchWithTimeout("/api/admin/overview", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await errorFrom(response, "Could not load dashboard."));
    setData((await response.json()) as DashboardData);
  }, []);

  const verifyAdmin = useCallback(
    async (nextSession: Session) => {
      const response = await fetchWithTimeout(
        "/api/admin/session",
        { headers: { Authorization: `Bearer ${nextSession.access_token}` } },
        10000,
      );
      if (!response.ok) {
        await supabase.auth.signOut();
        throw new Error(
          response.status === 403 ? "This account is not an approved admin." : "Admin session expired.",
        );
      }
      setSession(nextSession);
      try {
        await loadDashboard(nextSession.access_token);
      } catch (error) {
        setMessage({ tone: "error", text: (error as Error).message });
      }
    },
    [loadDashboard],
  );

  useEffect(() => {
    let mounted = true;
    void supabase.auth
      .getSession()
      .then(async ({ data: current }) => {
        if (!current.session) return;
        try {
          await verifyAdmin(current.session);
        } catch (error) {
          if (mounted) setAuthError((error as Error).message);
        }
      })
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [verifyAdmin]);

  const refresh = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    setMessage(null);
    try {
      await loadDashboard(session.access_token);
    } catch (error) {
      setMessage({ tone: "error", text: (error as Error).message });
    }
    setBusy(false);
  }, [loadDashboard, session]);

  const send = useCallback(
    async (method: "PATCH" | "POST", path: string, body: Record<string, unknown>) => {
      if (!session) return false;
      setBusy(true);
      setMessage(null);
      let ok = false;
      try {
        const response = await fetch(path, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          setMessage({ tone: "error", text: await errorFrom(response, "Update failed.") });
        } else {
          ok = true;
          await loadDashboard(session.access_token);
        }
      } catch {
        setMessage({ tone: "error", text: "The request could not be sent. Check your connection." });
      }
      setBusy(false);
      return ok;
    },
    [loadDashboard, session],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // Drop everything in memory — the next admin to sign in on this machine
    // must never see the previous one's queue.
    setSession(null);
    setData(EMPTY_DATA);
    setMessage(null);
    setAuthError(null);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setAuthError(null);
      const { data: result, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message);
        return;
      }
      if (result.session) {
        try {
          await verifyAdmin(result.session);
        } catch (failure) {
          setAuthError((failure as Error).message);
        }
      }
    },
    [verifyAdmin],
  );

  const state = useMemo<AdminState | null>(
    () =>
      session
        ? {
            session,
            data,
            busy,
            message,
            setMessage,
            refresh,
            patch: (path, body) => send("PATCH", path, body),
            post: (path, body) => send("POST", path, body),
            signOut,
          }
        : null,
    [busy, data, message, refresh, send, session, signOut],
  );

  const auth: AuthState = authLoading
    ? { phase: "loading" }
    : state
      ? { phase: "ready", state }
      : { phase: "signed-out", error: authError };

  return (
    <AdminContext.Provider value={state}>
      <SignInContext.Provider value={signIn}>{children(auth)}</SignInContext.Provider>
    </AdminContext.Provider>
  );
}

const SignInContext = createContext<(email: string, password: string) => Promise<void>>(async () => {});
export const useSignIn = () => useContext(SignInContext);
