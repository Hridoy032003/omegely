import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, razorpayConfig } from "@/lib/razorpay";
import { createClient } from "@supabase/supabase-js";

type RazorpayEvent = {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string; status?: string } };
  };
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifyWebhookSignature(rawBody, request.headers.get("x-razorpay-signature") || "")) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }
  try {
    razorpayConfig();
    const event = JSON.parse(rawBody) as RazorpayEvent;
    const payment = event.payload?.payment?.entity;
    const orderId = payment?.order_id;
    const paymentId = payment?.id;
    if (!orderId || !paymentId) return NextResponse.json({ received: true });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!url || !secret) return NextResponse.json({ error: "Database service is not configured." }, { status: 503 });
    const db = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
    const purchase = await db.from("coin_purchases").select("user_id, status").eq("razorpay_order_id", orderId).maybeSingle();
    if (purchase.error || !purchase.data) return NextResponse.json({ received: true });
    if (purchase.data.status === "paid") return NextResponse.json({ received: true });

    if (event.event === "payment.failed") {
      await db.from("coin_purchases").update({ status: "failed", updated_at: new Date().toISOString() }).eq("razorpay_order_id", orderId).eq("status", "created");
      return NextResponse.json({ received: true });
    }
    if (!["payment.captured", "order.paid"].includes(event.event || "") || payment.status !== "captured") {
      return NextResponse.json({ received: true });
    }
    const { error } = await db.rpc("complete_coin_purchase", {
      p_user_id: purchase.data.user_id,
      p_order_id: orderId,
      p_payment_id: paymentId,
      p_amount_paise: payment.amount,
      p_currency: payment.currency,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook processing failed." }, { status: 500 });
  }
}
