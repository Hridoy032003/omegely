import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin-server";

export async function GET(request: NextRequest) {
  const context = await requireAdmin(request);
  if (context instanceof NextResponse) return context;

  const { db } = context;
  const [userCount, bannedCount, reportCount, openCount, users, reports, feedbackCount, openFeedbackCount, feedback] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("is_banned", true),
    db.from("reports").select("id", { count: "exact", head: true }),
    db.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    // Keep the dashboard usable even if the optional profile migration has
    // not been applied yet. The repair migration adds display_name later.
    db.from("profiles").select("id, email, role, is_banned, created_at").order("created_at", { ascending: false }).limit(50),
    db.from("reports").select("id, reporter_id, target_user_id, reason, details, status, created_at, reviewed_at").order("created_at", { ascending: false }).limit(50),
    db.from("feedback").select("id", { count: "exact", head: true }),
    db.from("feedback").select("id", { count: "exact", head: true }).eq("status", "open"),
    db.from("feedback").select("id, user_id, email, kind, message, page_url, status, admin_note, created_at, updated_at").order("created_at", { ascending: false }).limit(100),
  ]);

  const failure = [users, reports].find((result) => result.error);
  if (failure?.error) return NextResponse.json({ error: failure.error.message }, { status: 500 });

  return NextResponse.json({
    counts: {
      users: userCount.count ?? 0,
      banned: bannedCount.count ?? 0,
      reports: reportCount.count ?? 0,
      openReports: openCount.count ?? 0,
      feedback: feedbackCount.error ? 0 : feedbackCount.count ?? 0,
      openFeedback: openFeedbackCount.error ? 0 : openFeedbackCount.count ?? 0,
    },
    users: (users.data ?? []).map((user) => ({ ...user, display_name: null, last_seen: null })),
    reports: reports.data ?? [],
    feedback: feedback.error ? [] : feedback.data ?? [],
  });
}
