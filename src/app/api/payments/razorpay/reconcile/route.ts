import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase-server";
import { razorpayRequest } from "@/lib/razorpay";

type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
};

type RazorpayPaymentsResponse = { items?: RazorpayPayment[] };

/** Re-check recent orders when a browser callback or webhook was interrupted. */
export async function POST(request: NextRequest) {
  const context = await requireUser(request);
  if (context instanceof NextResponse) return context;

  try {
    const purchases = await context.db
      .from("coin_purchases")
      .select("razorpay_order_id, amount_paise, currency, status")
      .eq("user_id", context.user.id)
      .eq("status", "created")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(10);

    if (purchases.error) throw new Error("Could not load payment status.");

    let credited = 0;
    for (const purchase of purchases.data ?? []) {
      const payments = await razorpayRequest<RazorpayPaymentsResponse>(
        `/orders/${encodeURIComponent(purchase.razorpay_order_id)}/payments`,
      );
      const payment = (payments.items ?? []).find(
        (candidate) =>
          candidate.status === "captured" &&
          candidate.amount === Number(purchase.amount_paise) &&
          candidate.currency === purchase.currency,
      );
      if (!payment) continue;

      const { data, error } = await context.db.rpc("complete_coin_purchase", {
        p_user_id: context.user.id,
        p_order_id: purchase.razorpay_order_id,
        p_payment_id: payment.id,
        p_amount_paise: payment.amount,
        p_currency: payment.currency,
      });
      if (!error && data !== null) credited += 1;
    }

    return NextResponse.json({ ok: true, credited });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payment status could not be checked." },
      { status: 502 },
    );
  }
}
