/**
 * Realtime wire protocol. All coordination flows over Ably channels — there is
 * no stateful backend, so these types ARE the contract between peers.
 *
 * Channels:
 *   - `online`            Ably presence; used for a live user count.
 *   - `lobby`             pub/sub; searching users announce themselves here.
 *   - `signal:<clientId>` each client's private inbox. Peers publish match
 *                         handshake + WebRTC signaling addressed to that id.
 *
 * Every message carries `from` (the sender's Ably clientId) so the receiver can
 * verify it's talking to its committed partner.
 */

/** WebRTC handshake payloads, relayed verbatim between two peers. */
export type SignalData =
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; candidate: RTCIceCandidateInit };

/** The only profile fields that may be shared with a matched stranger. */
export interface PublicProfile {
  display_name: string;
  avatar_url: string;
  bio: string;
  interests: string[];
}

/** Message names published to a `signal:<clientId>` channel. */
export const MSG = {
  /** "Want to pair?" — sent by the peer that initiates matchmaking. */
  REQUEST: "match-request",
  /** "Yes, let's pair." — locks the pairing in. */
  ACCEPT: "match-accept",
  /** "No, I'm already busy / gone." — requester retries someone else. */
  REJECT: "match-reject",
  /** A WebRTC offer/answer/ICE candidate for the committed partner. */
  SIGNAL: "signal",
  /** "I'm leaving / skipping you." — partner should re-queue. */
  BYE: "bye",
} as const;

export interface MatchPayload {
  from: string;
  country: string;
  profile?: PublicProfile | null;
}

export interface RejectPayload {
  from: string;
}

export interface SignalPayload {
  from: string;
  data: SignalData;
}

export interface ByePayload {
  from: string;
}

/** Data attached to a member's presence in the `online` channel. */
export interface PresenceData {
  status: "online";
}
