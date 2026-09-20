import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export type AdminContext = {
  user: User;
  db: SupabaseClient;
};

export async function requireAdmin(request: NextRequest): Promise<AdminContext | NextResponse> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publishable || !secret) {
    return NextResponse.json({ error: "Admin environment is incomplete." }, { status: 503 });
  }

  const authClient = createClient(url, publishable, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile, error: profileError } = await authClient
    .from("profiles")
    .select("role, is_banned")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError || profile?.role !== "admin" || profile.is_banned) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const db = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  return { user: userData.user, db };
}
