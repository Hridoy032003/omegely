import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin-server";

const STATUSES = new Set(["approved", "rejected", "paid"]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireAdmin(request);
  if (context instanceof NextResponse) return context;
  const body = await request.json().catch(() => ({}));
  if (!STATUSES.has(body.status)) return NextResponse.json({ error: "Invalid withdrawal status." }, { status: 400 });
  const nextStatus = body.status as "approved" | "rejected" | "paid";
  const adminNote = typeof body.admin_note === "string" ? body.admin_note.slice(0, 240) : null;
  const { data, error } = await context.db.rpc("admin_process_withdrawal", {
    p_withdrawal_id: id,
    p_next_status: nextStatus,
    p_admin_note: adminNote,
    p_reviewer_id: context.user.id,
  });
  const result = data as { ok?: boolean; error?: string } | null;
  if (error || !result?.ok) {
    return NextResponse.json({ error: result?.error || error?.message || "The withdrawal could not be updated." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, already_processed: Boolean((data as { already_processed?: boolean }).already_processed) });
}
