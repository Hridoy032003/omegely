import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin-server";

const STATUSES = new Set(["open", "reviewing", "resolved", "dismissed"]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireAdmin(request);
  if (context instanceof NextResponse) return context;

  const body = await request.json().catch(() => ({}));
  if (!STATUSES.has(body.status)) return NextResponse.json({ error: "Invalid report status." }, { status: 400 });
  const status = body.status as "open" | "reviewing" | "resolved" | "dismissed";
  const { data, error } = await context.db.from("reports").update({
    status,
    reviewed_by: context.user.id,
    reviewed_at: new Date().toISOString(),
  }).eq("id", id).select("id, status, reviewed_by, reviewed_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ report: data });
}
