import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin-server";

const STATUSES = new Set(["open", "in_review", "resolved", "rejected"]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireAdmin(request);
  if (context instanceof NextResponse) return context;

  const body = await request.json().catch(() => ({}));
  if (!STATUSES.has(body.status)) {
    return NextResponse.json({ error: "Invalid complaint status." }, { status: 400 });
  }

  const status = body.status as "open" | "in_review" | "resolved" | "rejected";
  const reply = typeof body.admin_reply === "string" ? body.admin_reply.trim().slice(0, 2000) : null;
  const finalized = status === "resolved" || status === "rejected";
  const { error } = await context.db
    .from("withdrawal_complaints")
    .update({
      status,
      admin_reply: reply || null,
      updated_at: new Date().toISOString(),
      resolved_at: finalized ? new Date().toISOString() : null,
      resolved_by: finalized ? context.user.id : null,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
