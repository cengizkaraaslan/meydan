import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getOrCreateDeviceId } from "./device";
import { getPerson } from "./people";
import {
  apiEnsureMatch,
  apiFetchMessages,
  apiSendMessage,
  type ChatMessage,
} from "./api";

/** Sohbet ekranında gösterilen mesaj (backend metni + yerel fotoğraf birleşik). */
export interface Msg {
  id: string;
  fromMe: boolean;
  text: string;
  at: number;
  imageUri?: string; // yerel fotoğraf mesajı (backend'e gitmez)
  pending?: boolean; // gönderiliyor (henüz backend onayı yok)
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

/**
 * Gerçek backend destekli sohbet hook'u.
 * - Metin mesajları Neon'a kaydedilir (apiSendMessage / apiFetchMessages, 3sn polling).
 * - Karşı taraf (mock kişi) cevapları bot olarak backend'e yazılır (senderDeviceId=bot_<id>),
 *   böylece kalıcı olur ve okunmamış sayacına yansır.
 * - Fotoğraflar yerelde tutulur (AsyncStorage) ve listeye karıştırılır.
 */
export function useChat(personId: string) {
  const [deviceId, setDeviceId] = useState<string>("");
  const [matchKey, setMatchKey] = useState<string | null>(null);
  const [serverMsgs, setServerMsgs] = useState<ChatMessage[]>([]);
  const [localImgs, setLocalImgs] = useState<Msg[]>([]);
  const [pending, setPending] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const counter = useRef(0);

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
        partnerName: person?.name ?? personId,
        partnerAvatar: person?.avatar ?? "",
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
      if (alive && msgs.length === 0) {
        await apiSendMessage({ matchKey: mk, senderDeviceId: botId(personId), text: OPENER });
        if (alive) await refetch(mk, did);
      }
    })();
    return () => {
      alive = false;
    };
  }, [personId, refetch]);

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
      if (!matchKey || !deviceId) return;
      counter.current += 1;
      const reply = REPLIES[(counter.current + userText.length) % REPLIES.length];
      setTyping(true);
      setTimeout(async () => {
        await apiSendMessage({ matchKey, senderDeviceId: botId(personId), text: reply });
        setTyping(false);
        await refetch(matchKey, deviceId);
      }, 1400 + Math.min(userText.length * 30, 1200));
    },
    [matchKey, deviceId, personId, refetch],
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
      if (!matchKey) return;
      counter.current += 1;
      const msg: Msg = { id: `img_${counter.current}`, fromMe: true, text: "", at: Date.now(), imageUri: uri };
      const next = [...localImgs, msg];
      setLocalImgs(next);
      await AsyncStorage.setItem(imgKey(matchKey), JSON.stringify(next));
      botReply("📷 fotoğraf");
    },
    [matchKey, localImgs, botReply],
  );

  const messages = useMemo<Msg[]>(() => {
    const fromServer: Msg[] = serverMsgs.map((m) => ({ id: m.id, fromMe: m.fromMe, text: m.text, at: m.at }));
    const all = [...fromServer, ...localImgs, ...pending];
    all.sort((a, b) => a.at - b.at);
    return all;
  }, [serverMsgs, localImgs, pending]);

  return { messages, typing, send, sendImage, ready: !!matchKey };
}
