import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin-server";

export async function GET(request: NextRequest) {
  const context = await requireAdmin(request);
  if (context instanceof NextResponse) return context;

  const { db } = context;
  const [userCount, bannedCount, reportCount, openCount, users, reports, feedbackCount, openFeedbackCount, feedback, referrals, earningsProfiles, withdrawals, complaints] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("is_banned", true),
    db.from("reports").select("id", { count: "exact", head: true }),
    db.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    db.from("profiles").select("id, email, display_name, role, is_banned, created_at, last_seen, referral_code, coin_balance, total_earned").order("created_at", { ascending: false }).limit(50),
    db.from("reports").select("id, reporter_id, target_user_id, reason, details, status, created_at, reviewed_at").order("created_at", { ascending: false }).limit(50),
    db.from("feedback").select("id", { count: "exact", head: true }),
    db.from("feedback").select("id", { count: "exact", head: true }).eq("status", "open"),
    db.from("feedback").select("id, user_id, email, kind, message, page_url, status, admin_note, created_at, updated_at").order("created_at", { ascending: false }).limit(100),
    db.from("referrals").select("id, referrer_id, referred_id, referral_code, status, reward_coins, created_at, qualified_at", { count: "exact" }).order("created_at", { ascending: false }).limit(100),
    db.from("profiles").select("total_earned").limit(10000),
    db.from("withdrawal_requests").select("id, user_id, amount_coins, method, destination, status, admin_note, created_at").order("created_at", { ascending: false }).limit(100),
    db.from("withdrawal_complaints").select("id, withdrawal_id, user_id, subject, message, status, admin_reply, created_at, updated_at").order("created_at", { ascending: false }).limit(100),
  ]);

  const failure = [users, reports, referrals].find((result) => result.error);
  if (failure?.error) return NextResponse.json({ error: failure.error.message }, { status: 500 });

  type ProfileRow = Record<string, unknown>;

  return NextResponse.json({
    counts: {
      users: userCount.count ?? 0,
      banned: bannedCount.count ?? 0,
      reports: reportCount.count ?? 0,
      openReports: openCount.count ?? 0,
      feedback: feedbackCount.error ? 0 : feedbackCount.count ?? 0,
      openFeedback: openFeedbackCount.error ? 0 : openFeedbackCount.count ?? 0,
      // The row list is capped at 100; the count is the real total.
      referrals: referrals.count ?? referrals.data?.length ?? 0,
      coinsIssued: (earningsProfiles.data ?? []).reduce((total, user) => total + Number(user.total_earned ?? 0), 0),
    },
    users: ((users.data ?? []) as ProfileRow[]).map((user) => ({
      ...user,
      display_name: (user.display_name as string | null) ?? null,
      last_seen: (user.last_seen as string | null) ?? null,
    })),
    reports: reports.data ?? [],
    feedback: feedback.error ? [] : feedback.data ?? [],
    referrals: referrals.data ?? [],
    withdrawals: withdrawals.data ?? [],
    complaints: complaints.error ? [] : complaints.data ?? [],
  });
}
