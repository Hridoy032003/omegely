import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin-server";

export async function POST(request: NextRequest) {
  const context = await requireAdmin(request);
  if (context instanceof NextResponse) return context;
  const body = await request.json().catch(() => ({}));
  const userId = typeof body.user_id === "string" ? body.user_id : "";
  const amount = Number(body.amount_coins);
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 240) : "Admin bonus";
  if (!userId || !Number.isInteger(amount) || amount <= 0 || !message) return NextResponse.json({ error: "User, positive coin amount, and message are required." }, { status: 400 });

  const profile = await context.db.from("profiles").select("coin_balance, total_earned").eq("id", userId).single();
  if (profile.error) return NextResponse.json({ error: profile.error.message }, { status: 404 });
  const nextBalance = Number(profile.data.coin_balance ?? 0) + amount;
  const updated = await context.db.from("profiles").update({ coin_balance: nextBalance, total_earned: Number(profile.data.total_earned ?? 0) + amount }).eq("id", userId);
  if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 400 });
  const transaction = await context.db.from("coin_transactions").insert({ user_id: userId, type: "admin_adjustment", amount, balance_after: nextBalance, description: message });
  if (transaction.error) return NextResponse.json({ error: transaction.error.message }, { status: 400 });
  return NextResponse.json({ balance: nextBalance });
}
