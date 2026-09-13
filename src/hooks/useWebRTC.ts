"use client";

import { useCallback, useEffect, useRef, useState } from "react";
// Runtime from the tree-shakable modular build (bundler-friendly ESM). The
// default `ably` entry is a UMD bundle webpack can't parse, so we only pull
// TYPES from it — type-only imports are erased before bundling.
import { BaseRealtime, FetchRequest, WebSocketTransport } from "ably/modular";
import type { InboundMessage, RealtimeChannel } from "ably";
import {
  MSG,
  type MatchPayload,
  type RejectPayload,
  type SignalData,
  type SignalPayload,
} from "@/types/signaling";

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
const ONLINE = "online"; // pub/sub channel used as a lightweight heartbeat for the count
const HELLO = "hello"; // "I'm searching" announcement
const PING = "ping"; // online heartbeat

const REQUEST_TIMEOUT_MS = 4000; // drop an unanswered match-request
const HEARTBEAT_MS = 3000; // re-announce hello / send online ping this often
const ONLINE_TTL_MS = 10000; // a peer is "online" if seen within this window
const REMATCH_COOLDOWN_MS = 3000; // don't instantly re-pair with the peer you just left

export type Status = "idle" | "searching" | "connected";

export interface ChatMessage {
  id: string;
  from: "me" | "them";
  text: string;
  ts: number;
}

/**
 * Matchmaking here uses ONLY publish/subscribe (no Ably "presence" capability
 * required, so any basic API key works):
 *   - While searching, a client periodically publishes `hello` to `lobby`.
 *   - Any other searching client that hears a `hello` sends a private
 *     `match-request`; the recipient accepts (if free) or rejects.
 *   - The initiator of the WebRTC offer is picked by comparing clientIds, which
 *     deterministically resolves the "we both requested each other" race.
 *   - A separate `ping` heartbeat on `online` powers the live user count.
 */
export function useWebRTC() {
  const [status, setStatus] = useState<Status>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partnerCountry, setPartnerCountry] = useState<string | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

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
  const pendingReqRef = useRef<{ to: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const cooldownRef = useRef<Map<string, number>>(new Map()); // partnerId -> left-at ms
  const helloTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onlineSeenRef = useRef<Map<string, number>>(new Map()); // clientId -> last-seen ms

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
      channel.onmessage = (event) => addMessage("them", String(event.data));
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
    dcRef.current?.close();
    dcRef.current = null;
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.ondatachannel = null;
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

  /**
   * Lock in a pairing. Guarded so a peer can only commit once. Initiator is
   * chosen deterministically by clientId comparison, which breaks the symmetric
   * "we both requested each other at once" race without any server arbitration.
   */
  const commit = useCallback(
    async (partnerId: string, country: string) => {
      if (partnerRef.current) return; // already paired
      partnerRef.current = partnerId;
      partnerCountryRef.current = country;
      clearPending();
      stopHello();

      setMessages([]);
      setPartnerCountry(country);
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
      sendTo(fromId, MSG.REQUEST, { country: myCountryRef.current });
      void country; // partner country is confirmed via the ACCEPT payload
    },
    [clearPending, sendTo],
  );

  const beginSearch = useCallback(() => {
    partnerRef.current = null;
    setPartnerCountry(null);
    setStatusBoth("searching");
    clearPending();

    announceHello(); // announce immediately…
    stopHello();
    helloTimerRef.current = setInterval(announceHello, HEARTBEAT_MS); // …then keep announcing
  }, [announceHello, clearPending, setStatusBoth, stopHello]);

  const onPartnerLeft = useCallback(() => {
    if (partnerRef.current) cooldownRef.current.set(partnerRef.current, Date.now());
    teardownPeer();
    partnerRef.current = null;
    beginSearch();
  }, [beginSearch, teardownPeer]);

  /** Route an inbound message on our private inbox channel. */
  const handleInbox = useCallback(
    (msg: InboundMessage) => {
      switch (msg.name) {
        case MSG.REQUEST: {
          const { from, country } = msg.data as MatchPayload;
          if (partnerRef.current || statusRef.current !== "searching") {
            sendTo(from, MSG.REJECT, {});
          } else {
            void commit(from, country);
            sendTo(from, MSG.ACCEPT, { country: myCountryRef.current });
          }
          break;
        }
        case MSG.ACCEPT: {
          const { from, country } = msg.data as MatchPayload;
          if (partnerRef.current === from) break; // mutual request — already paired
          if (partnerRef.current) {
            sendTo(from, MSG.REJECT, {}); // we committed elsewhere first
          } else if (pendingReqRef.current?.to === from) {
            void commit(from, country);
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

  // --- Online count (heartbeat, no presence) ---------------------------------
  const refreshOnline = useCallback(() => {
    const now = Date.now();
    const seen = onlineSeenRef.current;
    for (const [id, ts] of seen) {
      if (now - ts > ONLINE_TTL_MS) seen.delete(id);
    }
    setOnlineCount(seen.size);
  }, []);

  // --- Public actions --------------------------------------------------------
  const start = useCallback(async () => {
    setMediaError(null);

    // 1) Local media first — no point matching without a camera/mic.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setMicOn(true);
      setCamOn(true);
    } catch {
      setMediaError(
        "We need camera & microphone access to connect you. Please allow it and try again.",
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

    // 3) Connect to Ably with a self-minted clientId + token auth.
    const clientId = crypto.randomUUID();
    myIdRef.current = clientId;
    const client = new BaseRealtime({
      authUrl: "/api/ably-token",
      authParams: { clientId },
      authMethod: "GET",
      clientId,
      plugins: { WebSocketTransport, FetchRequest },
    });
    clientRef.current = client;

    let connected = false;
    try {
      await new Promise<void>((resolve, reject) => {
        client.connection.once("connected", () => resolve());
        client.connection.once("failed", (change) =>
          reject(new Error(change?.reason?.message ?? "connection failed")),
        );
      });
      connected = true;
    } catch {
      connected = false;
    }

    // If Ably never connects (usually a missing/invalid ABLY_API_KEY), bail out
    // cleanly and tell the user — otherwise the UI just sits at "0 online".
    if (!connected) {
      client.close();
      clientRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      setMediaError(
        "Couldn't reach the matchmaking service. Set a real ABLY_API_KEY in .env.local (free key at ably.com) and restart the dev server.",
      );
      setStatusBoth("idle");
      return;
    }

    // 4) Private inbox for handshake + signaling.
    const inbox = client.channels.get(`signal:${clientId}`);
    inboxRef.current = inbox;
    await inbox.subscribe(handleInbox);

    // 5) Online heartbeat (pub/sub) → live count. Ably echoes our own pings, so
    //    we count ourselves too.
    const online = client.channels.get(ONLINE);
    onlineRef.current = online;
    await online.subscribe(PING, (msg) => {
      const id = (msg.data as { id?: string })?.id;
      if (id) onlineSeenRef.current.set(id, Date.now());
      refreshOnline();
    });
    const ping = () => void online.publish(PING, { id: clientId });
    ping();
    pingTimerRef.current = setInterval(() => {
      ping();
      refreshOnline();
    }, HEARTBEAT_MS);

    // 6) Lobby (pub/sub): react to other searchers' announcements.
    const lobby = client.channels.get(LOBBY);
    lobbyRef.current = lobby;
    await lobby.subscribe(HELLO, (msg) => {
      const { from, country } = msg.data as MatchPayload;
      maybeRequest(from, country);
    });

    // 7) Start searching.
    beginSearch();
  }, [beginSearch, handleInbox, maybeRequest, refreshOnline]);

  const next = useCallback(() => {
    if (partnerRef.current) {
      sendTo(partnerRef.current, MSG.BYE, {});
      cooldownRef.current.set(partnerRef.current, Date.now());
    }
    teardownPeer();
    partnerRef.current = null;
    setMessages([]);
    beginSearch();
  }, [beginSearch, sendTo, teardownPeer]);

  const stop = useCallback(() => {
    if (partnerRef.current) sendTo(partnerRef.current, MSG.BYE, {});
    stopHello();
    clearPending();
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
    teardownPeer();
    partnerRef.current = null;
    onlineSeenRef.current.clear();

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
    setOnlineCount(0);
    setStatusBoth("idle");
  }, [clearPending, sendTo, setStatusBoth, stopHello, teardownPeer]);

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
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      teardownPeer();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      clientRef.current?.close();
    };
  }, [clearPending, stopHello, teardownPeer]);

  return {
    status,
    messages,
    partnerCountry,
    onlineCount,
    mediaError,
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
