import { NextRequest, NextResponse } from "next/server";
import { getCoinPack } from "@/lib/coin-packs";
import { requireUser } from "@/lib/supabase-server";
import { razorpayRequest } from "@/lib/razorpay";

type RazorpayOrder = { id: string; amount: number; currency: string; status: string };

export async function POST(request: NextRequest) {
  const context = await requireUser(request);
  if (context instanceof NextResponse) return context;

  const body = await request.json().catch(() => ({}));
  const pack = getCoinPack(typeof body.pack_id === "string" ? body.pack_id : "");
  if (!pack) return NextResponse.json({ error: "Choose a valid coin pack." }, { status: 400 });

  const recent = await context.db
    .from("coin_purchases")
    .select("id", { count: "exact", head: true })
    .eq("user_id", context.user.id)
    .in("status", ["created", "paid"])
    .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());
  if ((recent.count ?? 0) >= 5) {
    return NextResponse.json({ error: "Please wait before creating another payment order." }, { status: 429 });
  }

  try {
    const receipt = `coins_${context.user.id.replaceAll("-", "").slice(0, 12)}_${Date.now()}`.slice(0, 40);
    const order = await razorpayRequest<RazorpayOrder>("/orders", {
      method: "POST",
      body: JSON.stringify({ amount: pack.amountPaise, currency: "INR", receipt, notes: { user_id: context.user.id, pack_id: pack.id } }),
    });

    const purchase = await context.db.from("coin_purchases").insert({
      user_id: context.user.id,
      pack_id: pack.id,
      coins: pack.coins,
      amount_paise: pack.amountPaise,
      currency: "INR",
      razorpay_order_id: order.id,
      status: "created",
    }).select("id").single();
    if (purchase.error) return NextResponse.json({ error: "Could not save the payment order." }, { status: 500 });

    return NextResponse.json({
      purchase_id: purchase.data.id,
      order_id: order.id,
      amount: pack.amountPaise,
      currency: "INR",
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
      coins: pack.coins,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start Razorpay checkout." }, { status: 502 });
  }
}
