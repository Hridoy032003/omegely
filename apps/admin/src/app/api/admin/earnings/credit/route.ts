import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin-server";

export async function POST(request: NextRequest) {
  const context = await requireAdmin(request);
  if (context instanceof NextResponse) return context;
  const body = await request.json().catch(() => ({}));
  const userId = typeof body.user_id === "string" ? body.user_id : "";
  const amount = Number(body.amount_coins);
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 240) : "Admin bonus";
  const idempotencyKey = typeof body.idempotency_key === "string" ? body.idempotency_key : crypto.randomUUID();
  if (!userId || !Number.isInteger(amount) || amount <= 0 || !message) return NextResponse.json({ error: "User, positive coin amount, and message are required." }, { status: 400 });

  const { data: balance, error } = await context.db.rpc("admin_credit_coins", {
    p_user_id: userId,
    p_amount: amount,
    p_message: message,
    p_idempotency_key: idempotencyKey,
  });
  if (error || balance === null) {
    return NextResponse.json({ error: error?.message || "The credit could not be applied." }, { status: 400 });
  }
  return NextResponse.json({ balance });
}
