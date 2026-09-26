import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export type UserRequestContext = {
  user: User;
  db: SupabaseClient;
};

export async function requireUser(request: NextRequest): Promise<UserRequestContext | NextResponse> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!token || !url || !publishable || !secret) {
    return NextResponse.json({ error: "Authentication service is not configured." }, { status: 401 });
  }

  const authClient = createClient(url, publishable, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const db = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  return { user: data.user, db };
}
