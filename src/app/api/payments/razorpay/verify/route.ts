import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase-server";
import { razorpayRequest, verifyRazorpaySignature } from "@/lib/razorpay";

type RazorpayPayment = { id: string; order_id: string; amount: number; currency: string; status: string };

export async function POST(request: NextRequest) {
  const context = await requireUser(request);
  if (context instanceof NextResponse) return context;
  const body = await request.json().catch(() => ({}));
  const paymentId = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
  const orderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
  const signature = typeof body.razorpay_signature === "string" ? body.razorpay_signature : "";
  if (!paymentId || !orderId || !signature) return NextResponse.json({ error: "Incomplete payment response." }, { status: 400 });

  const purchase = await context.db.from("coin_purchases")
    .select("id, user_id, amount_paise, currency, status")
    .eq("razorpay_order_id", orderId)
    .maybeSingle();
  if (purchase.error || !purchase.data || purchase.data.user_id !== context.user.id) {
    return NextResponse.json({ error: "Payment order was not found." }, { status: 404 });
  }
  if (purchase.data.status === "paid") return NextResponse.json({ ok: true, already_credited: true });

  try {
    if (!verifyRazorpaySignature(orderId, paymentId, signature)) {
      return NextResponse.json({ error: "Payment signature could not be verified." }, { status: 400 });
    }
    const payment = await razorpayRequest<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`);
    if (payment.order_id !== orderId || payment.amount !== Number(purchase.data.amount_paise) || payment.currency !== purchase.data.currency || payment.status !== "captured") {
      return NextResponse.json({ error: "Payment is not captured or does not match the order." }, { status: 400 });
    }
    const { data: balance, error } = await context.db.rpc("complete_coin_purchase", {
      p_user_id: context.user.id,
      p_order_id: orderId,
      p_payment_id: paymentId,
      p_amount_paise: payment.amount,
      p_currency: payment.currency,
    });
    if (error || balance === null || balance === 0) return NextResponse.json({ error: error?.message || "Could not credit this payment." }, { status: 500 });
    return NextResponse.json({ ok: true, balance });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment verification failed." }, { status: 502 });
  }
}
