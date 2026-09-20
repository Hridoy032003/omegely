# Omegley 🎲

Anonymous, **Omegle-style random 1:1 video, voice & text chat** built to run
**100% serverless on Vercel**. No database, no signup, no history.

## Architecture (serverless-first)

Vercel functions are stateless and can't hold WebSocket connections, so the
live coordination runs through **Ably** (a managed realtime service) while media
stays **peer-to-peer over WebRTC**. Matchmaking is done entirely on the client
using Ably **presence** — there is no backend queue and no database.

```
 Browser A                         Vercel (serverless)                    Browser B
 ─────────                         ───────────────────                    ─────────
 getUserMedia                      /api/ably-token  ──► mints Ably tokens (key stays secret)
 RTCPeerConnection                 /api/geo         ──► country from x-vercel-ip-country
     │                                                                        │
     │   presence + handshake + SDP/ICE                                       │
     └────────────────►  Ably (managed WebSockets)  ◄─────────────────────────┘
     │                    • lobby presence = who's waiting                     │
     │                    • signal:<id> = private inbox per client             │
     │                                                                         │
     └───────────────  WebRTC P2P: audio + video + chat  ──────────────────────┘
                       (media never touches Vercel or Ably)
```

### How matchmaking works (no server state)

1. Each client connects to Ably with a random `clientId` and enters the `lobby`
   presence set, advertising its country.
2. A client picks a random waiting stranger and sends a **match-request** to
   that stranger's private `signal:<id>` channel.
3. The stranger replies **match-accept** (if free) or **match-reject** (if
   already busy — the requester then tries someone else).
4. On commit, both leave the lobby. The **initiator is chosen by comparing
   clientIds**, which deterministically breaks the "we both requested each other
   at the same instant" race — no server arbitration needed.
5. WebRTC offer/answer/ICE flow over the private channels; then audio, video and
   chat go **directly peer-to-peer**.
6. Recently-matched partners are remembered client-side and skipped when
   possible (repeats allowed only as a last resort, so no one gets stuck).

## Setup

1. **Get an Ably key** (free): https://ably.com → create an app → copy the API key.
2. `cp .env.local.example .env.local` and paste your key into `ABLY_API_KEY`.
3. Install & run:

```bash
npm install
npm run dev
# open http://localhost:3000 in TWO browsers/tabs and click "Start" in both
```

> `getUserMedia` needs a **secure context**: `localhost` is fine; anywhere else
> requires **HTTPS** (Vercel gives you that automatically).

## Deploy to Vercel

```bash
vercel            # or push to a Git repo connected to Vercel
```

Then in **Vercel → Project → Settings → Environment Variables** add
`ABLY_API_KEY`. That's it — the two API routes deploy as serverless functions,
the frontend as static/SSR, and Ably handles all the live connections.

## Scaling & production notes

- **It scales without touching the server.** Media and chat are P2P; Ably
  handles fan-out of the tiny signaling messages. Your Vercel functions only run
  briefly to mint tokens.
- **Add a TURN server** to `ICE_SERVERS` in `src/hooks/useWebRTC.ts` for users
  behind symmetric NATs — STUN alone fails for a minority of networks.
- **Moderation / abuse**: this is intentionally anonymous. Add reporting, rate
  limiting on `/api/ably-token`, or an age gate before going public.
- The `online` count reflects users currently connected to Ably presence.

## Project layout

| Path | Responsibility |
|------|----------------|
| `src/app/api/ably-token/route.ts` | Serverless: mints short-lived Ably tokens |
| `src/app/api/geo/route.ts` | Serverless: country from edge headers |
| `src/hooks/useWebRTC.ts` | Client matchmaking + WebRTC state machine |
| `src/types/signaling.ts` | Typed realtime wire protocol |
| `src/lib/geo.ts` | Country resolution from headers |
| `src/lib/flag.ts` | Country code → emoji flag |
| `src/components/VideoChat.tsx` | Main UI |
| `src/components/ChatPanel.tsx` | Text chat over the WebRTC data channel |
# Omegley monorepo

The repository root remains the public Omegley web app so the existing Vercel
deployment keeps working. Additional applications live in this same repository:

- `apps/admin` — private moderation and operations dashboard.
- The public app at the repository root is also the installable PWA. Its `/`
  and `/chat` routes stay unchanged for users.
- `packages` — browser-safe shared types and utilities.

All applications may use the same Supabase project. Public browser apps use only
the Supabase URL and anon key. Supabase service-role keys, database passwords,
and Ably root keys remain server-only environment variables and must never be
committed.
