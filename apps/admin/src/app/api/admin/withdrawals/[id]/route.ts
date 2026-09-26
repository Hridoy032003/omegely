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
  const current = await context.db.from("withdrawal_requests").select("id, user_id, amount_coins, status").eq("id", id).single();
  if (current.error) return NextResponse.json({ error: current.error.message }, { status: 404 });
  if (current.data.status === "paid" || current.data.status === "rejected") return NextResponse.json({ error: "This withdrawal is already finalized." }, { status: 409 });
  const amount = Number(current.data.amount_coins);
  if (nextStatus === "rejected") {
    const profile = await context.db.from("profiles").select("reserved_coins").eq("id", current.data.user_id).single();
    if (profile.error) return NextResponse.json({ error: profile.error.message }, { status: 400 });
    await context.db.from("profiles").update({ reserved_coins: Math.max(0, Number(profile.data.reserved_coins ?? 0) - amount) }).eq("id", current.data.user_id);
  }
  if (nextStatus === "paid") {
    const profile = await context.db.from("profiles").select("coin_balance, reserved_coins").eq("id", current.data.user_id).single();
    if (profile.error || Number(profile.data.coin_balance) < amount) return NextResponse.json({ error: "User balance is insufficient." }, { status: 400 });
    const nextBalance = Number(profile.data.coin_balance) - amount;
    await context.db.from("profiles").update({ coin_balance: nextBalance, reserved_coins: Math.max(0, Number(profile.data.reserved_coins ?? 0) - amount) }).eq("id", current.data.user_id);
    await context.db.from("coin_transactions").insert({ user_id: current.data.user_id, type: "redemption", amount: -amount, balance_after: nextBalance, description: "Withdrawal paid" });
  }
  const updated = await context.db.from("withdrawal_requests").update({ status: nextStatus, admin_note: typeof body.admin_note === "string" ? body.admin_note.slice(0, 240) : null, reviewed_at: new Date().toISOString(), reviewed_by: context.user.id }).eq("id", id);
  if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
