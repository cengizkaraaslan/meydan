import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as Notifications from "expo-notifications";
import { getProfileKey } from "@/lib/profileSync";
import { useVoiceCallEngine, type CallTarget, type CallStatus } from "@/lib/voiceCall";
import { CallOverlay } from "@/components/CallOverlay";

interface CallCtx {
  startCall: (t: CallTarget) => void;
  status: CallStatus;
}
const Ctx = createContext<CallCtx | null>(null);

/** Sohbet ekranı (ve istenirse profil) arama başlatmak için kullanır. */
export function useCall(): CallCtx | null {
  return useContext(Ctx);
}

/**
 * Uygulama kökünde duran sesli arama sağlayıcısı. Gelen aramayı Expo push ("call-ring")
 * ile HANGİ EKRANDA olursa olsun yakalar ve tam ekran arama UI'ını gösterir (WhatsApp gibi).
 * Boştayken hiç yoklama yapmaz (pil dostu) — yalnız aktif/gelen aramada match'i yoklar.
 */
export function CallProvider({ children }: { children: React.ReactNode }) {
  const [deviceId, setDeviceId] = useState("");
  useEffect(() => {
    void getProfileKey().then(setDeviceId);
  }, []);

  const call = useVoiceCallEngine(deviceId);
  const { armIncoming } = call;

  // Gelen arama push'u: uygulama açıkken (received) veya bildirime dokununca (response).
  useEffect(() => {
    const handle = (data: unknown) => {
      const d = data as { kind?: string; matchKey?: string; fromId?: string; fromName?: string; fromAvatar?: string } | null;
      if (!d || d.kind !== "call-ring" || !d.matchKey || !d.fromId) return;
      armIncoming({
        matchKey: d.matchKey,
        partnerId: d.fromId,
        name: d.fromName || "Arayan",
        avatar: d.fromAvatar || null,
      });
    };
    const sub1 = Notifications.addNotificationReceivedListener((n) => handle(n.request.content.data));
    const sub2 = Notifications.addNotificationResponseReceivedListener((r) => handle(r.notification.request.content.data));
    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, [armIncoming]);

  const value = useMemo<CallCtx>(() => ({ startCall: call.startCall, status: call.status }), [call.startCall, call.status]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <CallOverlay call={call} name={call.target?.name ?? "Arayan"} avatar={call.target?.avatar} />
    </Ctx.Provider>
  );
}
