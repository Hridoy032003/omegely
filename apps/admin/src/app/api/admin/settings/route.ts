import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin-server";

export async function GET(request: NextRequest) {
  const context = await requireAdmin(request);
  if (context instanceof NextResponse) return context;
  const result = await context.db.from("app_settings").select("withdrawals_enabled, withdrawal_minimum_coins, connection_rewards_enabled, referral_rewards_enabled, updated_at").eq("id", true).single();
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json(result.data);
}

export async function PATCH(request: NextRequest) {
  const context = await requireAdmin(request);
  if (context instanceof NextResponse) return context;
  const body = await request.json().catch(() => ({}));
  const updates: Record<string, boolean | number | string> = { updated_at: new Date().toISOString() };
  for (const key of ["withdrawals_enabled", "connection_rewards_enabled", "referral_rewards_enabled"]) {
    if (typeof body[key] === "boolean") updates[key] = body[key];
  }
  if (body.withdrawal_minimum_coins !== undefined) {
    const minimum = Number(body.withdrawal_minimum_coins);
    if (!Number.isInteger(minimum) || minimum < 100 || minimum % 100 !== 0) return NextResponse.json({ error: "Minimum must be a whole number of coins divisible by 100." }, { status: 400 });
    updates.withdrawal_minimum_coins = minimum;
  }
  const result = await context.db.from("app_settings").update(updates).eq("id", true).select("withdrawals_enabled, withdrawal_minimum_coins, connection_rewards_enabled, referral_rewards_enabled, updated_at").single();
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  return NextResponse.json(result.data);
}
