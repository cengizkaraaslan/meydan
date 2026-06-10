import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getOrCreateDeviceId } from "./device";
import { getPerson } from "./people";
import { uploadImage } from "./social";
import {
  apiDeleteMessage,
  apiEditMessage,
  apiEnsureMatch,
  apiFetchMessages,
  apiSendMessage,
  type ChatMessage,
} from "./api";

/** Düzenleme/silme penceresi: gönderimden sonra 10 dakika. */
export const EDIT_WINDOW_MS = 10 * 60 * 1000;

/** Bir mesaj kendi mesajım mı ve hâlâ 10 dk penceresinde mi? */
export function canEditMsg(m: Msg): boolean {
  return m.fromMe && !m.pending && Date.now() - m.at <= EDIT_WINDOW_MS;
}

/** Sohbet ekranında gösterilen mesaj (backend metni + yerel fotoğraf birleşik). */
export interface Msg {
  id: string;
  fromMe: boolean;
  text: string;
  at: number;
  imageUri?: string; // yerel fotoğraf mesajı (backend'e gitmez)
  audioUri?: string; // yerel sesli mesaj (backend'e gitmez)
  audioSec?: number; // sesli mesaj süresi (saniye)
  pending?: boolean; // gönderiliyor (henüz backend onayı yok)
}

/**
 * Story izleyiciden gerçek kişiye DM yanıtı gönderir (Instagram tarzı).
 * useChat hook'una bağlı olmadan ensureMatch + sendMessage yapar; mesaj sohbette görünür.
 */
export async function sendStoryReply(personId: string, text: string): Promise<boolean> {
  const trimmed = text.trim();
  if (!trimmed) return false;
  try {
    const did = await getOrCreateDeviceId();
    const person = getPerson(personId);
    const mk = await apiEnsureMatch({
      deviceId: did,
      partnerId: personId,
      partnerName: person?.name ?? personId,
      partnerAvatar: person?.avatar ?? "",
    });
    if (!mk) return false;
    const sent = await apiSendMessage({ matchKey: mk, senderDeviceId: did, text: trimmed });
    return !!sent;
  } catch {
    return false;
  }
}

const OPENER = "Selam! 👋 Yaklaşan etkinliklerden hangisine gidiyorsun?";
const REPLIES = [
  "Süper, ben de oradayım! Orada buluşalım mı? 😄",
  "Aaa harika seçim, bilet aldın mı?",
  "Bu hafta sonu müsaitsen beraber gidebiliriz.",
  "Kesinlikle! Sahne önünde takılırız 🎸",
  "Ben de tam ona bakıyordum, ne tesadüf 🙌",
  "Olur! Birini daha çağırayım mı, kalabalık daha eğlenceli.",
  "Çok iyi olur, planı yapalım o zaman 🎉",
];

const imgKey = (mk: string) => `meydanfest:imgmsgs:${mk}`;
const botId = (personId: string) => `bot_${personId}`;

/** Backend metin mesajının bir fotoğraf olduğunu işaretleyen önek. text = "[img]<R2 url>". */
const IMG_PREFIX = "[img]";

/**
 * Gerçek backend destekli sohbet hook'u.
 * - Metin mesajları Neon'a kaydedilir (apiSendMessage / apiFetchMessages, 3sn polling).
 * - Karşı taraf (mock kişi) cevapları bot olarak backend'e yazılır (senderDeviceId=bot_<id>),
 *   böylece kalıcı olur ve okunmamış sayacına yansır.
 * - Fotoğraflar yerelde tutulur (AsyncStorage) ve listeye karıştırılır.
 */
export function useChat(personId: string, override?: { name?: string | null; avatar?: string | null }) {
  const [deviceId, setDeviceId] = useState<string>("");
  const [matchKey, setMatchKey] = useState<string | null>(null);
  const [serverMsgs, setServerMsgs] = useState<ChatMessage[]>([]);
  const [localImgs, setLocalImgs] = useState<Msg[]>([]);
  const [pending, setPending] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const counter = useRef(0);

  // Mock (PEOPLE) kişi mi? Yalnız mock kişiler bot cevabı + otomatik açılış mesajı alır.
  // Gerçek kullanıcıda (deviceId, PEOPLE'da yok) sahte cevap YOK — gerçek konuşma.
  const isMock = !!getPerson(personId);

  const refetch = useCallback(
    async (mk: string, did: string) => {
      const msgs = await apiFetchMessages(mk, did);
      setServerMsgs(msgs);
      return msgs;
    },
    [],
  );

  // Kurulum: deviceId + ensureMatch + ilk yükleme + (boşsa) açılış mesajı.
  useEffect(() => {
    let alive = true;
    (async () => {
      const did = await getOrCreateDeviceId();
      if (!alive) return;
      setDeviceId(did);
      const person = getPerson(personId);
      const mk = await apiEnsureMatch({
        deviceId: did,
        partnerId: personId,
        // Gerçek kullanıcıda (PEOPLE'da yok) ad/avatar parametreden gelir → deviceId yerine isim.
        partnerName: override?.name || person?.name || personId,
        partnerAvatar: override?.avatar || person?.avatar || "",
      });
      if (!alive || !mk) return;
      setMatchKey(mk);

      const raw = await AsyncStorage.getItem(imgKey(mk));
      if (alive && raw) {
        try {
          setLocalImgs(JSON.parse(raw) as Msg[]);
        } catch {
          /* yoksay */
        }
      }

      const msgs = await refetch(mk, did);
      // Otomatik açılış mesajı yalnız mock kişide (gerçek kullanıcıda sahte mesaj yok).
      if (alive && msgs.length === 0 && isMock) {
        await apiSendMessage({ matchKey: mk, senderDeviceId: botId(personId), text: OPENER });
        if (alive) await refetch(mk, did);
      }
    })();
    return () => {
      alive = false;
    };
  }, [personId, refetch, isMock]);

  // 3sn polling.
  useEffect(() => {
    if (!matchKey || !deviceId) return;
    const iv = setInterval(() => {
      void refetch(matchKey, deviceId);
    }, 3000);
    return () => clearInterval(iv);
  }, [matchKey, deviceId, refetch]);

  // Bot cevabı: "yazıyor…" göster, sonra cevabı backend'e bot olarak yaz.
  const botReply = useCallback(
    (userText: string) => {
      // Gerçek kullanıcıda sahte cevap YOK; sadece mock (demo) kişiler cevap verir.
      if (!isMock || !matchKey || !deviceId) return;
      counter.current += 1;
      const reply = REPLIES[(counter.current + userText.length) % REPLIES.length];
      setTyping(true);
      setTimeout(async () => {
        await apiSendMessage({ matchKey, senderDeviceId: botId(personId), text: reply });
        setTyping(false);
        await refetch(matchKey, deviceId);
      }, 1400 + Math.min(userText.length * 30, 1200));
    },
    [matchKey, deviceId, personId, refetch, isMock],
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !matchKey || !deviceId) return;
      counter.current += 1;
      const tempId = `tmp_${counter.current}`;
      const optimistic: Msg = { id: tempId, fromMe: true, text: trimmed, at: Date.now(), pending: true };
      setPending((p) => [...p, optimistic]);

      const sent = await apiSendMessage({ matchKey, senderDeviceId: deviceId, text: trimmed });
      if (sent) {
        await refetch(matchKey, deviceId);
        setPending((p) => p.filter((m) => m.id !== tempId));
      }
      // sent null ise (çevrimdışı) optimistic mesaj "gönderiliyor" olarak kalır.
      botReply(trimmed);
    },
    [matchKey, deviceId, refetch, botReply],
  );

  const sendImage = useCallback(
    async (uri: string) => {
      if (!matchKey || !deviceId) return;
      counter.current += 1;
      const tempId = `tmp_img_${counter.current}`;
      // Optimistik: yerel uri ile anında göster (gönderiliyor).
      const optimistic: Msg = { id: tempId, fromMe: true, text: "", at: Date.now(), imageUri: uri, pending: true };
      setPending((p) => [...p, optimistic]);

      // R2'ye yükle, sonra backend'e "[img]<url>" metin mesajı olarak gönder (kalıcı + cross-device).
      const url = await uploadImage(uri, "post");
      if (url) {
        const sent = await apiSendMessage({ matchKey, senderDeviceId: deviceId, text: IMG_PREFIX + url });
        if (sent) await refetch(matchKey, deviceId);
        setPending((p) => p.filter((m) => m.id !== tempId));
        botReply("📷 fotoğraf");
        return;
      }

      // Çevrimdışı / yükleme başarısız → eski davranışa düş: yerel foto mesajı (offline fallback).
      const local: Msg = { id: `img_${counter.current}`, fromMe: true, text: "", at: Date.now(), imageUri: uri };
      const next = [...localImgs, local];
      setLocalImgs(next);
      await AsyncStorage.setItem(imgKey(matchKey), JSON.stringify(next));
      setPending((p) => p.filter((m) => m.id !== tempId));
      botReply("📷 fotoğraf");
    },
    [matchKey, deviceId, localImgs, refetch, botReply],
  );

  // Sesli mesaj: yerelde tutulur (offline foto ile aynı depo). Alıcı mock bot olduğu
  // için R2'ye yüklenmez; gönderince bot kısa bir cevap verir.
  const sendVoice = useCallback(
    async (uri: string, sec: number) => {
      if (!matchKey) return;
      counter.current += 1;
      const local: Msg = {
        id: `voice_${counter.current}_${Date.now()}`,
        fromMe: true,
        text: "",
        at: Date.now(),
        audioUri: uri,
        audioSec: Math.max(1, Math.round(sec)),
      };
      const next = [...localImgs, local];
      setLocalImgs(next);
      await AsyncStorage.setItem(imgKey(matchKey), JSON.stringify(next));
      botReply("🎤 sesli mesaj");
    },
    [matchKey, localImgs, botReply],
  );

  /** Metin mesajını düzenler (yalnız kendi & 10 dk içinde). Başarıda refetch. */
  const editMessage = useCallback(
    async (id: string, text: string): Promise<{ ok: boolean; reason?: string }> => {
      const trimmed = text.trim();
      if (!trimmed || !matchKey || !deviceId) return { ok: false, reason: "invalid" };
      const target = serverMsgs.find((m) => m.id === id);
      if (!target || !target.fromMe) return { ok: false, reason: "not_owner" };
      if (Date.now() - target.at > EDIT_WINDOW_MS) return { ok: false, reason: "expired" };
      const r = await apiEditMessage({ id, senderDeviceId: deviceId, text: trimmed });
      if (r.ok) await refetch(matchKey, deviceId);
      return r;
    },
    [matchKey, deviceId, serverMsgs, refetch],
  );

  /**
   * Mesajı siler.
   * - Yerel (offline) foto (id "img_" & localImgs içinde) → AsyncStorage'dan çıkar.
   * - Backend mesajı (metin VEYA "[img]<url>" foto; id normal server id) → apiDeleteMessage + refetch.
   *   Sadece kendi (fromMe) & 10 dk içindeki mesaj silinebilir.
   */
  const deleteMessage = useCallback(
    async (id: string): Promise<{ ok: boolean; reason?: string }> => {
      if (!matchKey) return { ok: false, reason: "invalid" };
      // Yerel (offline) foto VEYA sesli mesaj — yerel depodan çıkar.
      const local = localImgs.find((m) => m.id === id);
      if (local) {
        const next = localImgs.filter((m) => m.id !== id);
        setLocalImgs(next);
        await AsyncStorage.setItem(imgKey(matchKey), JSON.stringify(next));
        return { ok: true };
      }
      // Backend mesajı (metin veya foto)
      if (!deviceId) return { ok: false, reason: "invalid" };
      const target = serverMsgs.find((m) => m.id === id);
      if (!target || !target.fromMe) return { ok: false, reason: "not_owner" };
      if (Date.now() - target.at > EDIT_WINDOW_MS) return { ok: false, reason: "expired" };
      const r = await apiDeleteMessage({ id, senderDeviceId: deviceId });
      if (r.ok) await refetch(matchKey, deviceId);
      return r;
    },
    [matchKey, deviceId, serverMsgs, localImgs, refetch],
  );

  const messages = useMemo<Msg[]>(() => {
    const fromServer: Msg[] = serverMsgs.map((m) => {
      // Backend foto mesajı: text "[img]<url>" → imageUri olarak render et (karşı taraf/öteki cihaz da görür).
      if (m.text.startsWith(IMG_PREFIX)) {
        return { id: m.id, fromMe: m.fromMe, text: "", at: m.at, imageUri: m.text.slice(IMG_PREFIX.length) };
      }
      return { id: m.id, fromMe: m.fromMe, text: m.text, at: m.at };
    });
    const all = [...fromServer, ...localImgs, ...pending];
    all.sort((a, b) => a.at - b.at);
    return all;
  }, [serverMsgs, localImgs, pending]);

  return { messages, typing, send, sendImage, sendVoice, editMessage, deleteMessage, ready: !!matchKey };
}
