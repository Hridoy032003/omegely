import { NextRequest, NextResponse } from "next/server";
import { resolveCountry } from "@/lib/geo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the caller's country (from edge/CDN headers). The browser can't read
 * its own IP geo, so it asks the server once and then advertises the result via
 * Ably presence so partners can display it.
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({ country: resolveCountry(req.headers) });
}
