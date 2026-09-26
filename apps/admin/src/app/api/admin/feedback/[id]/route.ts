import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin-server";

const STATUSES = new Set(["open", "reviewing", "resolved", "dismissed"]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireAdmin(request);
  if (context instanceof NextResponse) return context;

  const body = await request.json().catch(() => ({}));
  if (!STATUSES.has(body.status)) {
    return NextResponse.json({ error: "Invalid feedback status." }, { status: 400 });
  }

  const { data, error } = await context.db
    .from("feedback")
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, status, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ feedback: data });
}
