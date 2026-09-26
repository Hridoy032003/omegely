"use client";

import { useCallback, useEffect, useRef, useState } from "react";
// Runtime from the tree-shakable modular build (bundler-friendly ESM). The
// default `ably` entry is a UMD bundle webpack can't parse, so we only pull
// TYPES from it — type-only imports are erased before bundling.
import {
  BaseRealtime,
  FetchRequest,
  WebSocketTransport,
  XHRPolling,
} from "ably/modular";
import type { InboundMessage, RealtimeChannel } from "ably";
import {
  MSG,
  type MatchPayload,
  type PublicProfile,
  type RejectPayload,
  type SignalData,
  type SignalPayload,
} from "@/types/signaling";
import { supabase } from "@/lib/supabase-browser";

/**
 * Public STUN servers cover most home/office NATs. For symmetric NATs and some
 * mobile carriers you WILL need a TURN relay — add its {urls,username,credential}
 * here (e.g. coturn or a managed provider). Without TURN a small fraction of
 * pairs won't connect; everything else still works P2P.
 */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const LOBBY = "lobby"; // pub/sub channel where searching users announce themselves
const ONLINE = "online"; // Ably presence channel used for the live count
const HELLO = "hello"; // "I'm searching" announcement

const REQUEST_TIMEOUT_MS = 4000; // drop an unanswered match-request
const HEARTBEAT_MS = 3000; // re-announce hello this often
const REMATCH_COOLDOWN_MS = 3000; // don't instantly re-pair with the peer you just left
const MATCHMAKING_TIMEOUT_MS = 12000; // never leave Start looking frozen
const CHANNEL_SETUP_TIMEOUT_MS = 8000;
const COOLDOWN_KEEP_MS = 60_000; // forget who we skipped after a minute
const MAX_INBOUND_CHARS = 1000; // a peer can't flood the chat log with one message
const PEER_RECOVERY_GRACE_MS = 6000; // ICE often self-heals; only re-queue if it doesn't

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`${label} timed out`)),
      CHANNEL_SETUP_TIMEOUT_MS,
    );
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function sanitizePublicProfile(value: unknown): PublicProfile | null {
  if (!value || typeof value !== "object") return null;
  const profile = value as Record<string, unknown>;
  const interests = Array.isArray(profile.interests)
    ? profile.interests
        .filter((item): item is string => typeof item === "string")
        .slice(0, 8)
        .map((item) => item.slice(0, 40))
    : [];
  return {
    display_name: typeof profile.display_name === "string" ? profile.display_name.slice(0, 80) : "",
    avatar_url: typeof profile.avatar_url === "string" ? profile.avatar_url.slice(0, 500) : "",
    bio: typeof profile.bio === "string" ? profile.bio.slice(0, 240) : "",
    interests,
  };
}

export type Status = "idle" | "searching" | "connected";

export interface ChatMessage {
  id: string;
  from: "me" | "them";
  text: string;
  ts: number;
}

/**
 * Matchmaking here uses publish/subscribe; Ably presence is used separately
 * only for the accurate live-user count:
 *   - While searching, a client periodically publishes `hello` to `lobby`.
 *   - Any other searching client that hears a `hello` sends a private
 *     `match-request`; the recipient accepts (if free) or rejects.
 *   - The initiator of the WebRTC offer is picked by comparing clientIds, which
 *     deterministically resolves the "we both requested each other" race.
 *   - The `online` channel presence set powers the live user count.
 */
export function useWebRTC() {
  const [status, setStatus] = useState<Status>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partnerCountry, setPartnerCountry] = useState<string | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<PublicProfile | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [starting, setStarting] = useState(false);
  /** The chat data channel is open, so a typed message will actually be delivered. */
  const [chatReady, setChatReady] = useState(false);
  /** The peer connection is struggling but has not been given up on yet. */
  const [peerUnstable, setPeerUnstable] = useState(false);

  // --- Refs (async callbacks must never read stale React state) -------------
  const statusRef = useRef<Status>("idle");
  const clientRef = useRef<BaseRealtime | null>(null);
  const myIdRef = useRef<string>("");
  const myCountryRef = useRef<string>("XX");
  const lobbyRef = useRef<RealtimeChannel | null>(null);
  const onlineRef = useRef<RealtimeChannel | null>(null);
  const inboxRef = useRef<RealtimeChannel | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const partnerRef = useRef<string | null>(null); // committed partner clientId
  const partnerCountryRef = useRef<string>("XX");
  const publicProfileRef = useRef<PublicProfile | null>(null);
  const pendingReqRef = useRef<{ to: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const cooldownRef = useRef<Map<string, number>>(new Map()); // partnerId -> left-at ms
  const helloTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startInFlightRef = useRef(false);
  const connectionEventRef = useRef<string | null>(null);
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set once `onPartnerLeft` exists; lets the peer connection re-queue us on failure. */
  const peerFailureRef = useRef<(() => void) | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const setStatusBoth = useCallback((s: Status) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const addMessage = useCallback((from: "me" | "them", text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), from, text, ts: Date.now() },
    ]);
  }, []);

  const rewardCompletedConnection = useCallback(() => {
    const eventKey = connectionEventRef.current;
    if (!eventKey) return;
    connectionEventRef.current = null;
    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user) {
          await supabase.rpc("reward_authenticated_connection", { p_event_key: eventKey });
        } else {
          let walletId = window.localStorage.getItem("omegley_anonymous_wallet");
          if (!walletId) {
            walletId = crypto.randomUUID();
            window.localStorage.setItem("omegley_anonymous_wallet", walletId);
          }
          await supabase.rpc("reward_anonymous_connection", { p_wallet_id: walletId, p_event_key: eventKey });
        }
      } catch {
        // Rewards are best-effort; the connection lifecycle must never be blocked by wallet storage.
      }
    })();
  }, []);

  /** Publish a message to another client's private inbox channel. */
  const sendTo = useCallback((toId: string, name: string, payload: object) => {
    const client = clientRef.current;
    if (!client) return;
    void client.channels
      .get(`signal:${toId}`)
      .publish(name, { ...payload, from: myIdRef.current });
  }, []);

  const sendSignal = useCallback(
    (data: SignalData) => {
      if (partnerRef.current) sendTo(partnerRef.current, MSG.SIGNAL, { data });
    },
    [sendTo],
  );

  // --- WebRTC ----------------------------------------------------------------
  const wireDataChannel = useCallback(
    (channel: RTCDataChannel) => {
      dcRef.current = channel;
      setChatReady(channel.readyState === "open");
      channel.onopen = () => setChatReady(true);
      channel.onclose = () => setChatReady(false);
      channel.onerror = () => setChatReady(false);
      channel.onmessage = (event) => {
        // Trust nothing about size: the peer controls this string.
        const text = String(event.data).slice(0, MAX_INBOUND_CHARS).trim();
        if (text) addMessage("them", text);
      };
    },
    [addMessage],
  );

  const flushPendingCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    const queued = pendingCandidates.current;
    pendingCandidates.current = [];
    for (const candidate of queued) {
      await pc.addIceCandidate(candidate).catch(() => {});
    }
  }, []);

  const teardownPeer = useCallback(() => {
    if (recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    if (dcRef.current) {
      dcRef.current.onopen = null;
      dcRef.current.onclose = null;
      dcRef.current.onerror = null;
      dcRef.current.onmessage = null;
      dcRef.current.close();
      dcRef.current = null;
    }
    setChatReady(false);
    setPeerUnstable(false);
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.ondatachannel = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    pendingCandidates.current = [];
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  const createPeerConnection = useCallback(
    (initiator: boolean) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      localStreamRef.current
        ?.getTracks()
        .forEach((track) => pc.addTrack(track, localStreamRef.current!));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({ type: "ice", candidate: event.candidate.toJSON() });
        }
      };

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteVideoRef.current && remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      };

      // Without this, a dropped or blocked connection (no TURN relay, carrier
      // NAT, sleeping laptop) leaves the UI showing "connected" over a black
      // frame with no way out but a manual Next.
      pc.onconnectionstatechange = () => {
        if (pcRef.current !== pc) return;
        const state = pc.connectionState;

        if (recoveryTimerRef.current) {
          clearTimeout(recoveryTimerRef.current);
          recoveryTimerRef.current = null;
        }

        if (state === "connected") {
          setPeerUnstable(false);
        } else if (state === "disconnected") {
          // Usually transient — give ICE a chance to recover before re-queuing.
          setPeerUnstable(true);
          recoveryTimerRef.current = setTimeout(() => {
            recoveryTimerRef.current = null;
            if (pcRef.current === pc && pc.connectionState !== "connected") {
              peerFailureRef.current?.();
            }
          }, PEER_RECOVERY_GRACE_MS);
        } else if (state === "failed") {
          setPeerUnstable(true);
          peerFailureRef.current?.();
        }
      };

      if (initiator) {
        wireDataChannel(pc.createDataChannel("chat"));
      } else {
        pc.ondatachannel = (event) => wireDataChannel(event.channel);
      }

      return pc;
    },
    [sendSignal, wireDataChannel],
  );

  const handleSignal = useCallback(
    async (data: SignalData) => {
      const pc = pcRef.current;
      if (!pc) return;

      if (data.type === "offer") {
        await pc.setRemoteDescription(data.sdp);
        await flushPendingCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: "answer", sdp: answer });
      } else if (data.type === "answer") {
        await pc.setRemoteDescription(data.sdp);
        await flushPendingCandidates();
      } else if (data.type === "ice") {
        if (pc.remoteDescription?.type) {
          await pc.addIceCandidate(data.candidate).catch(() => {});
        } else {
          pendingCandidates.current.push(data.candidate);
        }
      }
    },
    [flushPendingCandidates, sendSignal],
  );

  // --- Matchmaking (pub/sub, no presence) ------------------------------------
  const clearPending = useCallback(() => {
    if (pendingReqRef.current) {
      clearTimeout(pendingReqRef.current.timer);
      pendingReqRef.current = null;
    }
  }, []);

  const stopHello = useCallback(() => {
    if (helloTimerRef.current) {
      clearInterval(helloTimerRef.current);
      helloTimerRef.current = null;
    }
  }, []);

  const announceHello = useCallback(() => {
    if (statusRef.current !== "searching") return;
    void lobbyRef.current?.publish(HELLO, {
      from: myIdRef.current,
      country: myCountryRef.current,
    });
  }, []);

  const loadPublicProfile = useCallback(async () => {
    publicProfileRef.current = null;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const metadata = auth.user.user_metadata ?? {};
    const fallbackName = typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : "";
    const fallbackAvatar = typeof metadata.avatar_url === "string"
      ? metadata.avatar_url
      : typeof metadata.picture === "string"
        ? metadata.picture
        : "";
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, bio, interests, profile_visibility")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (data?.profile_visibility !== "public") return;

    publicProfileRef.current = {
      display_name: typeof data.display_name === "string" ? data.display_name.slice(0, 80) : fallbackName.slice(0, 80),
      avatar_url: typeof data.avatar_url === "string" ? data.avatar_url.slice(0, 500) : fallbackAvatar.slice(0, 500),
      bio: typeof data.bio === "string" ? data.bio.slice(0, 240) : "",
      interests: Array.isArray(data.interests)
        ? data.interests.filter((item): item is string => typeof item === "string").slice(0, 8).map((item) => item.slice(0, 40))
        : [],
    };
  }, []);

  /**
   * Lock in a pairing. Guarded so a peer can only commit once. Initiator is
   * chosen deterministically by clientId comparison, which breaks the symmetric
   * "we both requested each other at once" race without any server arbitration.
   */
  const commit = useCallback(
    async (partnerId: string, country: string, profile?: PublicProfile | null) => {
      if (partnerRef.current) return; // already paired
      partnerRef.current = partnerId;
      partnerCountryRef.current = country;
      clearPending();
      stopHello();

      setMessages([]);
      setPartnerCountry(country);
      setPartnerProfile(sanitizePublicProfile(profile));
      connectionEventRef.current = crypto.randomUUID();
      setStatusBoth("connected");

      const initiator = myIdRef.current < partnerId;
      const pc = createPeerConnection(initiator);
      if (initiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal({ type: "offer", sdp: offer });
      }
    },
    [clearPending, createPeerConnection, sendSignal, setStatusBoth, stopHello],
  );

  /** React to another user's `hello`: request a match if we're free. */
  const maybeRequest = useCallback(
    (fromId: string, country: string) => {
      if (statusRef.current !== "searching") return;
      if (!fromId || fromId === myIdRef.current) return;
      if (partnerRef.current || pendingReqRef.current) return;

      const leftAt = cooldownRef.current.get(fromId);
      if (leftAt && Date.now() - leftAt < REMATCH_COOLDOWN_MS) return;

      pendingReqRef.current = {
        to: fromId,
        timer: setTimeout(() => clearPending(), REQUEST_TIMEOUT_MS),
      };
      sendTo(fromId, MSG.REQUEST, {
        country: myCountryRef.current,
        profile: publicProfileRef.current,
      });
      void country; // partner country is confirmed via the ACCEPT payload
    },
    [clearPending, sendTo],
  );

  // Presence makes discovery reliable even when two clients miss each other's
  // first pub/sub hello while they are attaching to the lobby channel.
  const scanLobby = useCallback(async () => {
    const lobby = lobbyRef.current;
    if (!lobby || statusRef.current !== "searching") return;

    try {
      const members = await withTimeout(lobby.presence.get(), "Lobby discovery");
      for (const member of members) {
        const data = member.data as { country?: unknown } | null;
        const country = typeof data?.country === "string" ? data.country : "XX";
        maybeRequest(member.clientId, country);
      }
    } catch {
      // The hello heartbeat remains as a fallback if presence is unavailable.
    }
  }, [maybeRequest]);

  const beginSearch = useCallback(() => {
    const now = Date.now();
    for (const [peerId, leftAt] of cooldownRef.current) {
      if (now - leftAt > COOLDOWN_KEEP_MS) cooldownRef.current.delete(peerId);
    }

    partnerRef.current = null;
    setPartnerCountry(null);
    setPartnerProfile(null);
    setStatusBoth("searching");
    clearPending();

    announceHello(); // announce immediately…
    stopHello();
    helloTimerRef.current = setInterval(announceHello, HEARTBEAT_MS); // …then keep announcing
    void scanLobby();
  }, [announceHello, clearPending, scanLobby, setStatusBoth, stopHello]);

  const onPartnerLeft = useCallback(() => {
    rewardCompletedConnection();
    if (partnerRef.current) cooldownRef.current.set(partnerRef.current, Date.now());
    teardownPeer();
    partnerRef.current = null;
    beginSearch();
  }, [beginSearch, rewardCompletedConnection, teardownPeer]);

  useEffect(() => {
    peerFailureRef.current = onPartnerLeft;
  }, [onPartnerLeft]);

  /** Route an inbound message on our private inbox channel. */
  const handleInbox = useCallback(
    (msg: InboundMessage) => {
      switch (msg.name) {
        case MSG.REQUEST: {
          const { from, country, profile } = msg.data as MatchPayload;
          if (partnerRef.current || statusRef.current !== "searching") {
            sendTo(from, MSG.REJECT, {});
          } else {
            void commit(from, country, profile);
            sendTo(from, MSG.ACCEPT, { country: myCountryRef.current, profile: publicProfileRef.current });
          }
          break;
        }
        case MSG.ACCEPT: {
          const { from, country, profile } = msg.data as MatchPayload;
          if (partnerRef.current === from) break; // mutual request — already paired
          if (partnerRef.current) {
            sendTo(from, MSG.REJECT, {}); // we committed elsewhere first
          } else if (pendingReqRef.current?.to === from) {
            void commit(from, country, profile);
          }
          break;
        }
        case MSG.REJECT: {
          const { from } = msg.data as RejectPayload;
          if (pendingReqRef.current?.to === from) clearPending();
          break;
        }
        case MSG.SIGNAL: {
          const { from, data } = msg.data as SignalPayload;
          if (from === partnerRef.current) void handleSignal(data);
          break;
        }
        case MSG.BYE: {
          const { from } = msg.data as { from: string };
          if (from === partnerRef.current) onPartnerLeft();
          break;
        }
      }
    },
    [clearPending, commit, handleSignal, onPartnerLeft, sendTo],
  );

  // --- Online count (Ably presence) ------------------------------------------
  const refreshOnline = useCallback(async (channel: RealtimeChannel) => {
    try {
      const members = await channel.presence.get();
      // Count unique client IDs so a reconnect does not inflate the number.
      setOnlineCount(new Set(members.map((member) => member.clientId)).size);
    } catch {
      // The chat can continue even if the optional count is temporarily unavailable.
      setOnlineCount(0);
    }
  }, []);

  // --- Public actions --------------------------------------------------------
  const start = useCallback(async () => {
    if (startInFlightRef.current || statusRef.current !== "idle") return;
    startInFlightRef.current = true;
    setStarting(true);

    try {
      setMediaError(null);

      // 1) Local media first — no point matching without a camera/mic.
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("media-unavailable");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setMicOn(true);
        setCamOn(true);
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        setMediaError(
          name === "NotAllowedError"
            ? "Camera and microphone access is blocked. Allow both permissions in your browser, then press Start again."
            : name === "NotFoundError"
              ? "No camera or microphone was found on this device."
              : "Camera and microphone are unavailable. Open Omegley over HTTPS and try again.",
        );
        return;
      }

      // 2) Learn our own country (edge header) to advertise to partners.
      try {
        const res = await fetch("/api/geo");
        myCountryRef.current = (await res.json()).country ?? "XX";
      } catch {
        myCountryRef.current = "XX";
      }

      // Load the current privacy setting immediately before matching. A
      // private profile is represented by null and is never sent to the peer.
      try {
        await loadPublicProfile();
      } catch {
        publicProfileRef.current = null;
      }

      // 3) Connect to Ably with a self-minted clientId + token auth.
      const clientId = crypto.randomUUID();
      myIdRef.current = clientId;
      const client = new BaseRealtime({
        authUrl: "/api/ably-token",
        authParams: { clientId },
        authMethod: "GET",
        clientId,
        // Keep long-polling available for mobile networks and browsers where
        // a firewall or captive portal blocks WebSocket connections.
        plugins: { WebSocketTransport, XHRPolling, FetchRequest },
      });
      clientRef.current = client;

      let connected = false;
      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("matchmaking timeout")),
            MATCHMAKING_TIMEOUT_MS,
          );
          client.connection.once("connected", () => {
            clearTimeout(timeout);
            resolve();
          });
          client.connection.once("failed", (change) => {
            clearTimeout(timeout);
            reject(new Error(change?.reason?.message ?? "connection failed"));
          });
        });
        connected = true;
      } catch {
        connected = false;
      }

      // If Ably never connects, bail out cleanly and tell the user instead of
      // leaving the Start button looking unresponsive.
      if (!connected) {
        client.close();
        clientRef.current = null;
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        setMediaError(
          "Couldn’t connect to the matchmaking service. Check your internet connection and try again.",
        );
        setStatusBoth("idle");
        return;
      }

      // 4) Private inbox for handshake + signaling.
      const inbox = client.channels.get(`signal:${clientId}`);
      inboxRef.current = inbox;
      await withTimeout(inbox.subscribe(handleInbox), "Private inbox setup");

      // 5) Enter Ably presence so the live count reflects actual connected users.
      const online = client.channels.get(ONLINE);
      onlineRef.current = online;
      try {
        await withTimeout(
          online.presence.subscribe(["enter", "leave", "update"], () => {
            void refreshOnline(online);
          }),
          "Online presence setup",
        );
        await withTimeout(online.presence.enter({ status: "online" }), "Online presence entry");
        await withTimeout(refreshOnline(online), "Online count refresh");
      } catch {
        // Presence is optional. Some deployments only grant subscribe on the
        // online channel; matchmaking still works through lobby pub/sub.
        setOnlineCount(0);
      }

      // 6) Lobby (pub/sub): react to other searchers' announcements.
      const lobby = client.channels.get(LOBBY);
      lobbyRef.current = lobby;
      await withTimeout(
        lobby.subscribe(HELLO, (msg) => {
          const { from, country } = msg.data as MatchPayload;
          maybeRequest(from, country);
        }),
        "Lobby setup",
      );
      // Mark this client as searching only after all inbox/lobby listeners are
      // ready, so an incoming request can never be rejected while booting.
      beginSearch();
      try {
        await withTimeout(
          lobby.presence.subscribe(["enter", "update"], (member) => {
            const data = member.data as { country?: unknown } | null;
            const country = typeof data?.country === "string" ? data.country : "XX";
            maybeRequest(member.clientId, country);
          }),
          "Lobby presence setup",
        );
        await withTimeout(
          lobby.presence.enter({ status: "searching", country: myCountryRef.current }),
          "Lobby presence entry",
        );
      } catch {
        // The pub/sub hello heartbeat remains fully functional if the Ably key
        // has not yet granted presence on the lobby channel.
      }
      void scanLobby();
    } catch {
      // Subscribe/presence setup can also fail after the socket connects. Make
      // sure a failed attempt never leaves the camera or Ably client running.
      stopHello();
      clearPending();
      teardownPeer();
      if (onlineRef.current) {
        void onlineRef.current.presence.leave().catch(() => {});
      }
      if (lobbyRef.current) {
        void lobbyRef.current.presence.leave().catch(() => {});
      }
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      clientRef.current?.close();
      clientRef.current = null;
      lobbyRef.current = null;
      onlineRef.current = null;
      inboxRef.current = null;
      setStatusBoth("idle");
      setMediaError("Omegley could not start the chat. Please refresh and try again.");
    } finally {
      startInFlightRef.current = false;
      setStarting(false);
    }
  }, [beginSearch, clearPending, handleInbox, loadPublicProfile, maybeRequest, refreshOnline, scanLobby, setStatusBoth, stopHello, teardownPeer]);

  const next = useCallback(() => {
    rewardCompletedConnection();
    if (partnerRef.current) {
      sendTo(partnerRef.current, MSG.BYE, {});
      cooldownRef.current.set(partnerRef.current, Date.now());
    }
    teardownPeer();
    partnerRef.current = null;
    setMessages([]);
    beginSearch();
  }, [beginSearch, rewardCompletedConnection, sendTo, teardownPeer]);

  const stop = useCallback(() => {
    rewardCompletedConnection();
    if (partnerRef.current) sendTo(partnerRef.current, MSG.BYE, {});
    stopHello();
    clearPending();
    teardownPeer();
    partnerRef.current = null;

    const online = onlineRef.current;
    if (online) void online.presence.leave().catch(() => {});
    const lobby = lobbyRef.current;
    if (lobby) void lobby.presence.leave().catch(() => {});

    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;

    clientRef.current?.close();
    clientRef.current = null;
    lobbyRef.current = null;
    onlineRef.current = null;
    inboxRef.current = null;

    setMessages([]);
    setPartnerCountry(null);
    setPartnerProfile(null);
    setOnlineCount(0);
    setChatReady(false);
    setPeerUnstable(false);
    setStatusBoth("idle");
  }, [clearPending, rewardCompletedConnection, sendTo, setStatusBoth, stopHello, teardownPeer]);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      const channel = dcRef.current;
      if (!trimmed || channel?.readyState !== "open") return false;
      channel.send(trimmed);
      addMessage("me", trimmed);
      return true;
    },
    [addMessage],
  );

  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }, []);

  const toggleCam = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  }, []);

  // Clean up on unmount so we never leak a camera/mic or realtime connection.
  useEffect(() => {
    return () => {
      stopHello();
      clearPending();
      if (onlineRef.current) {
        void onlineRef.current.presence.leave().catch(() => {});
      }
      if (lobbyRef.current) {
        void lobbyRef.current.presence.leave().catch(() => {});
      }
      teardownPeer();
      rewardCompletedConnection();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      clientRef.current?.close();
    };
  }, [clearPending, rewardCompletedConnection, stopHello, teardownPeer]);

  return {
    status,
    messages,
    partnerCountry,
    partnerProfile,
    onlineCount,
    mediaError,
    starting,
    chatReady,
    peerUnstable,
    micOn,
    camOn,
    localVideoRef,
    remoteVideoRef,
    start,
    next,
    stop,
    sendMessage,
    toggleMic,
    toggleCam,
  };
}
