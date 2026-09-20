import { NextRequest, NextResponse } from "next/server";
import * as Ably from "ably";

// Runs as a Vercel serverless function. Must be dynamic (never cached) and on
// the Node runtime so it can read the secret API key from the environment.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ably token endpoint. The browser SDK calls this (as its `authUrl`) to obtain
 * a short-lived token, so the real `ABLY_API_KEY` never reaches the client.
 * The client passes its self-generated `clientId` so its identity is pinned.
 */
export async function GET(req: NextRequest) {
  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) {
    return new NextResponse("ABLY_API_KEY is not configured", { status: 500 });
  }

  const clientId = req.nextUrl.searchParams.get("clientId") ?? undefined;

  const rest = new Ably.Rest(apiKey);
  const capability = JSON.stringify({
    lobby: ["publish", "subscribe", "presence"],
    online: ["subscribe", "presence"],
    "signal:*": ["publish", "subscribe"],
  });
  const tokenRequest = await rest.auth.createTokenRequest({ clientId, capability });

  return NextResponse.json(tokenRequest);
}
