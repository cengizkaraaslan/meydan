import { useCallback, useEffect, useRef, useState } from "react";
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  type MediaStream,
} from "react-native-webrtc";
import InCallManager from "react-native-incall-manager";
import { apiFetchMessages, apiRingCall, apiSendMessage } from "./api";

/**
 * P2P sesli arama engine'i (Faz 2) — global CallProvider tarafından kullanılır.
 * Sinyalleşme MEVCUT sohbet mesaj kanalından geçer ("[call]" önekli mesajlar; chat.ts gizler).
 * "Çalma": arayan, callee'ye Expo push (apiRingCall) atar → callee uygulamayı hangi ekranda
 * olursa olsun gelen arama UI'ı çıkar (CallProvider push'u armIncoming'e bağlar). Medya P2P
 * (Google STUN, TURN yok).
 */

export const CALL_PREFIX = "[call]";
// STUN (P2P kurar, ücretsiz) + ücretsiz public TURN (Open Relay) → simetrik NAT/katı ağda
// relay üzerinden bağlanır. TURN düşse bile STUN ile çoğu ağda çalışır. (Faz 3'te coturn self-host.)
const ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
  ],
};

export type CallStatus = "idle" | "outgoing" | "incoming" | "connecting" | "connected" | "ended";

type SignalType = "offer" | "answer" | "ice" | "end";
interface Signal {
  t: SignalType;
  cid: string;
  sdp?: { type: string; sdp: string };
  cand?: object;
}

export interface CallTarget {
  matchKey: string;
  partnerId: string;
  name: string;
  avatar?: string | null;
}

function encodeSignal(s: Signal): string {
  return CALL_PREFIX + JSON.stringify(s);
}
function decodeSignal(text: string): Signal | null {
  if (!text.startsWith(CALL_PREFIX)) return null;
  try {
    return JSON.parse(text.slice(CALL_PREFIX.length)) as Signal;
  } catch {
    return null;
  }
}

export interface VoiceCall {
  status: CallStatus;
  muted: boolean;
  speakerOn: boolean;
  durationSec: number;
  remoteStream: MediaStream | null;
  target: CallTarget | null;
  startCall: (t: CallTarget) => void;
  /** Push ile gelen "çalma" → bu match'in offer'ını yoklamaya başla. */
  armIncoming: (t: CallTarget) => void;
  accept: () => void;
  decline: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
}

export function useVoiceCallEngine(deviceId: string): VoiceCall {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [target, setTarget] = useState<CallTarget | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const cidRef = useRef<string>("");
  const pendingIce = useRef<object[]>([]);
  const remoteSet = useRef(false);
  const sinceRef = useRef(0);
  const seenRef = useRef<Set<string>>(new Set());
  const incomingOffer = useRef<{ cid: string; sdp: { type: string; sdp: string } } | null>(null);
  const statusRef = useRef<CallStatus>("idle");
  statusRef.current = status;
  const targetRef = useRef<CallTarget | null>(null);
  targetRef.current = target;

  const send = useCallback(
    (s: Signal) => {
      const mk = targetRef.current?.matchKey;
      if (!mk || !deviceId) return;
      void apiSendMessage({ matchKey: mk, senderDeviceId: deviceId, text: encodeSignal(s) });
    },
    [deviceId],
  );

  const cleanup = useCallback(() => {
    try {
      pcRef.current?.close();
    } catch {
      /* yoksay */
    }
    pcRef.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    pendingIce.current = [];
    remoteSet.current = false;
    incomingOffer.current = null;
    setRemoteStream(null);
    setMuted(false);
    setDurationSec(0);
  }, []);

  const endLocal = useCallback(
    (notify: boolean) => {
      if (notify && cidRef.current) send({ t: "end", cid: cidRef.current });
      cleanup();
      setStatus("ended");
      setTimeout(() => {
        setStatus((s) => (s === "ended" ? "idle" : s));
        setTarget((t) => (statusRef.current === "ended" || statusRef.current === "idle" ? null : t));
      }, 1200);
    },
    [send, cleanup],
  );

  const buildPc = useCallback(() => {
    const pc = new RTCPeerConnection(ICE);
    // @ts-expect-error react-native-webrtc event tipi DOM ile birebir değil
    pc.addEventListener("icecandidate", (e: { candidate: object | null }) => {
      if (e.candidate && cidRef.current) send({ t: "ice", cid: cidRef.current, cand: e.candidate });
    });
    // @ts-expect-error
    pc.addEventListener("track", (e: { streams: MediaStream[] }) => {
      if (e.streams && e.streams[0]) setRemoteStream(e.streams[0]);
    });
    // @ts-expect-error
    pc.addEventListener("connectionstatechange", () => {
      const st = pc.connectionState;
      if (st === "connected") setStatus("connected");
      else if (st === "failed" || st === "disconnected" || st === "closed") {
        if (statusRef.current !== "idle" && statusRef.current !== "ended") endLocal(false);
      }
    });
    pcRef.current = pc;
    return pc;
  }, [send, endLocal]);

  const getMic = useCallback(async () => {
    const stream = (await mediaDevices.getUserMedia({ audio: true, video: false })) as unknown as MediaStream;
    localRef.current = stream;
    return stream;
  }, []);

  const flushIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const c of pendingIce.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c as never));
      } catch {
        /* yoksay */
      }
    }
    pendingIce.current = [];
  }, []);

  const startCall = useCallback(
    async (t: CallTarget) => {
      if (statusRef.current !== "idle") return;
      sinceRef.current = Date.now();
      seenRef.current = new Set();
      setTarget(t);
      targetRef.current = t;
      cidRef.current = `${deviceId}-${Date.now()}`;
      setStatus("outgoing");
      // Callee'yi çaldır (push). Sohbet kapalı olsa da gelen arama çıkar.
      void apiRingCall({ matchKey: t.matchKey, toId: t.partnerId, fromDeviceId: deviceId });
      try {
        const pc = buildPc();
        const local = await getMic();
        local.getTracks().forEach((tr) => pc.addTrack(tr, local));
        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);
        send({ t: "offer", cid: cidRef.current, sdp: { type: offer.type, sdp: offer.sdp } });
      } catch {
        endLocal(false);
      }
    },
    [deviceId, buildPc, getMic, send, endLocal],
  );

  const armIncoming = useCallback((t: CallTarget) => {
    if (statusRef.current !== "idle") return;
    sinceRef.current = Date.now() - 60_000; // son 1 dk'daki offer'ı da yakala
    seenRef.current = new Set();
    setTarget(t);
    targetRef.current = t;
    // status hâlâ idle; poll offer'ı bulunca "incoming"e geçer.
  }, []);

  const accept = useCallback(async () => {
    const off = incomingOffer.current;
    if (!off) return;
    setStatus("connecting");
    cidRef.current = off.cid;
    try {
      const pc = buildPc();
      const local = await getMic();
      local.getTracks().forEach((tr) => pc.addTrack(tr, local));
      await pc.setRemoteDescription(new RTCSessionDescription(off.sdp as never));
      remoteSet.current = true;
      await flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ t: "answer", cid: off.cid, sdp: { type: answer.type, sdp: answer.sdp } });
      incomingOffer.current = null;
    } catch {
      endLocal(false);
    }
  }, [buildPc, getMic, flushIce, send, endLocal]);

  const decline = useCallback(() => {
    incomingOffer.current = null;
    endLocal(true);
  }, [endLocal]);

  const hangup = useCallback(() => endLocal(true), [endLocal]);

  const toggleMute = useCallback(() => {
    const tracks = localRef.current?.getAudioTracks() ?? [];
    const next = !muted;
    tracks.forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  const toggleSpeaker = useCallback(() => {
    const next = !speakerOn;
    try {
      InCallManager.setForceSpeakerphoneOn(next);
    } catch {
      /* native yoksa yoksay */
    }
    setSpeakerOn(next);
  }, [speakerOn]);

  // Ses oturumu + zil/ringback (InCallManager) — duruma göre.
  useEffect(() => {
    try {
      if (status === "outgoing") {
        InCallManager.start({ media: "audio" });
        InCallManager.setForceSpeakerphoneOn(false);
        InCallManager.startRingback("_DTMF_");
      } else if (status === "incoming") {
        InCallManager.startRingtone("_DEFAULT_", [0, 1000, 1000], "playback", 30);
      } else if (status === "connecting" || status === "connected") {
        InCallManager.stopRingback();
        InCallManager.stopRingtone();
        InCallManager.start({ media: "audio" });
      } else {
        InCallManager.stopRingback();
        InCallManager.stopRingtone();
        InCallManager.stop();
        setSpeakerOn(false);
      }
    } catch {
      /* native modül yoksa (dev) yoksay */
    }
  }, [status]);

  const handleSignal = useCallback(
    async (sig: Signal) => {
      const pc = pcRef.current;
      if (sig.t === "offer") {
        if (statusRef.current !== "idle") return;
        incomingOffer.current = { cid: sig.cid, sdp: sig.sdp! };
        cidRef.current = sig.cid;
        setStatus("incoming");
      } else if (sig.t === "answer") {
        if (!pc || sig.cid !== cidRef.current) return;
        setStatus("connecting");
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp as never));
          remoteSet.current = true;
          await flushIce();
        } catch {
          /* yoksay */
        }
      } else if (sig.t === "ice") {
        if (sig.cid !== cidRef.current || !sig.cand) return;
        if (!pc || !remoteSet.current) pendingIce.current.push(sig.cand);
        else {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(sig.cand as never));
          } catch {
            /* yoksay */
          }
        }
      } else if (sig.t === "end") {
        if (sig.cid === cidRef.current && statusRef.current !== "idle") endLocal(false);
        else if (statusRef.current === "incoming") {
          incomingOffer.current = null;
          endLocal(false);
        }
      }
    },
    [flushIce, endLocal],
  );

  // Aktif hedef (target) varken sinyal yokla.
  useEffect(() => {
    if (!target || !deviceId) return;
    let alive = true;
    const poll = async () => {
      const msgs = await apiFetchMessages(target.matchKey, deviceId, { limit: 20, noReceipt: true });
      if (!alive) return;
      for (const m of msgs) {
        if (m.fromMe || m.at < sinceRef.current || seenRef.current.has(m.id)) continue;
        const sig = decodeSignal(m.text);
        if (!sig) continue;
        seenRef.current.add(m.id);
        void handleSignal(sig);
      }
    };
    const iv = setInterval(poll, 1200);
    void poll();
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [target, deviceId, handleSignal]);

  // Bağlanınca süre say.
  useEffect(() => {
    if (status !== "connected") return;
    const t0 = Date.now();
    const iv = setInterval(() => setDurationSec(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [status]);

  useEffect(() => () => cleanup(), [cleanup]);

  return { status, muted, speakerOn, durationSec, remoteStream, target, startCall, armIncoming, accept, decline, hangup, toggleMute, toggleSpeaker };
}
