import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin-server";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const context = await requireAdmin(request);
  if (context instanceof NextResponse) return context;

  const body = await request.json().catch(() => ({}));
  const updates: { is_banned?: boolean; ban_reason?: string | null; role?: "user" | "admin" } = {};
  if (typeof body.is_banned === "boolean") {
    updates.is_banned = body.is_banned;
    updates.ban_reason = body.is_banned ? String(body.ban_reason || "Policy violation") : null;
  }
  if (body.role === "user" || body.role === "admin") updates.role = body.role;
  if (!Object.keys(updates).length) return NextResponse.json({ error: "No valid changes supplied." }, { status: 400 });

  const { data, error } = await context.db.from("profiles").update(updates).eq("id", params.id).select("id, email, role, is_banned, ban_reason").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ user: data });
}
