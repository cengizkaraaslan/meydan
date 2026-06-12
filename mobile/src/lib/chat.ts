import AsyncStorage from "@react-native-async-storage/async-storage";
import { getChatPrefs } from "./chatPrefs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getProfileKey } from "./profileSync";
import { getPerson } from "./people";
import { uploadImage, uploadVoice } from "./social";
import {
  apiDeleteMessage,
  apiEditMessage,
  apiEnsureMatch,
  apiFetchMessages,
  apiSendMessage,
  apiSetTyping,
  apiGetTyping,
  apiPingPresence,
  apiGetPresence,
  type ChatMessage,
} from "./api";

/** Karşı tarafın çevrimiçi durumu (best-effort). */
export interface Presence {
  online: boolean;
  lastSeen: number | null;
}

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
  imageUri?: string; // fotoğraf mesajı ([img]<url> veya yerel uri)
  audioUri?: string; // sesli mesaj ([voice]<url> veya yerel uri)
  audioSec?: number; // sesli mesaj süresi (saniye)
  readAt?: number | null; // karşı taraf okuduysa epoch ms (fromMe için mavi tik)
  pending?: boolean; // gönderiliyor (henüz backend onayı yok)
  // Alıntı/yanıt: bu mesaj başka bir mesaja yanıtsa o mesajın özeti.
  // qMine = alıntılanan mesaj, YANITI GÖNDEREN'in kendi mesajı mıydı (görüntüleyene göre çevrilir).
  replyTo?: { id: string; qMine: boolean; snippet: string } | null;
}

/**
 * Story izleyiciden gerçek kişiye DM yanıtı gönderir (Instagram tarzı).
 * useChat hook'una bağlı olmadan ensureMatch + sendMessage yapar; mesaj sohbette görünür.
 */
export async function sendStoryReply(personId: string, text: string): Promise<boolean> {
  const trimmed = text.trim();
  if (!trimmed) return false;
  try {
    const did = await getProfileKey();
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
/** Sesli mesaj öneki. text = "[voice]<saniye>:<R2 url>" (saniye süreyi, url ses dosyasını taşır). */
const VOICE_PREFIX = "[voice]";
/** Tepki (reaction) öneki. text = "[react]<hedefMesajId>:<emoji>" (emoji boş = tepkiyi kaldır).
 *  Ayrı bir mesaj olarak saklanır → migration gerekmez, çift taraflı görünür; balon olarak çizilmez. */
const REACT_PREFIX = "[react]";
/** Alıntı/yanıt öneki. text = "[reply]<hedefId><qMine 0|1><özet><gerçek metin>".
 *   (kullanıcının yazamayacağı kontrol karakteri) ayraç. Normal bir metin balonu olarak çizilir,
 *  üstünde alıntı bloğu gösterilir. */
const REPLY_PREFIX = "[reply]";
const REPLY_SEP = "";

/** Bir mesajın alıntı önizleme metni (foto/ses için ikonlu, metinse kısaltılmış). */
export function replySnippet(m: Msg): string {
  if (m.imageUri) return "📷 Fotoğraf";
  if (m.audioUri) return "🎤 Sesli mesaj";
  return m.text.length > 80 ? m.text.slice(0, 80) + "…" : m.text;
}

/** "[reply]..." metnini ayrıştırır → {replyTo, text}. Önek yoksa null. */
function parseReply(raw: string): { replyTo: { id: string; qMine: boolean; snippet: string }; text: string } | null {
  if (!raw.startsWith(REPLY_PREFIX)) return null;
  const rest = raw.slice(REPLY_PREFIX.length);
  const parts = rest.split(REPLY_SEP);
  if (parts.length < 4) return null;
  const [id, qMineStr, snippet, ...textParts] = parts;
  return {
    replyTo: { id, qMine: qMineStr === "1", snippet },
    text: textParts.join(REPLY_SEP),
  };
}

/** Sayfa boyutu: ilk açılışta son 20 mesaj; yukarı kaydırınca 20'şer eski mesaj yüklenir. */
const PAGE_SIZE = 20;

/** id'ye göre tekilleştir + zamana göre sırala (canlı pencere + eski sayfa birleşiminde). */
function mergeById(a: ChatMessage[], b: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  // Sonraki (b) öncekini (a) ezer → otorite kaynağı b olur.
  for (const m of a) map.set(m.id, m);
  for (const m of b) map.set(m.id, m);
  return [...map.values()].sort((x, y) => x.at - y.at);
}

/** Bir mesaja konan tepkiler: benimki ve karşı tarafınki (DM 2 kişilik). */
export interface MsgReactions {
  mine: string | null;
  theirs: string | null;
}

/**
 * Gerçek backend destekli sohbet hook'u.
 * - Metin mesajları Neon'a kaydedilir (apiSendMessage / apiFetchMessages, 3sn polling).
 * - Karşı taraf (mock kişi) cevapları bot olarak backend'e yazılır (senderDeviceId=bot_<id>),
 *   böylece kalıcı olur ve okunmamış sayacına yansır.
 * - Fotoğraflar yerelde tutulur (AsyncStorage) ve listeye karıştırılır.
 */
export function useChat(personId: string, override?: { name?: string | null; avatar?: string | null; matchKey?: string | null }) {
  // Sohbet listesinden gelen yetkili oda anahtarı. Varsa ensureMatch ile YENİDEN hesaplamayız
  // (yeniden hesap, kimlik biçimi farklıysa farklı anahtar üretip mesajları "yetim" bırakabilir).
  const presetKey = override?.matchKey || null;
  const [deviceId, setDeviceId] = useState<string>("");
  const [matchKey, setMatchKey] = useState<string | null>(null);
  const [serverMsgs, setServerMsgs] = useState<ChatMessage[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(true); // yukarıda daha eski mesaj var mı
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [localImgs, setLocalImgs] = useState<Msg[]>([]);
  const [pending, setPending] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false); // mock bot "yazıyor"
  const [partnerTyping, setPartnerTyping] = useState(false); // gerçek karşı taraf "yazıyor"
  const [partnerPresence, setPartnerPresence] = useState<Presence>({ online: false, lastSeen: null });
  const counter = useRef(0);
  const lastTypingPing = useRef(0);

  // Mock (PEOPLE) kişi mi? Yalnız mock kişiler bot cevabı + otomatik açılış mesajı alır.
  // Gerçek kullanıcıda (deviceId, PEOPLE'da yok) sahte cevap YOK — gerçek konuşma.
  const isMock = !!getPerson(personId);

  // Canlı yenileme: SON PAGE_SIZE mesajı çek. Yüklü eski sayfaları KORU (canlı pencereden eski
  // olanları prev'den tut), canlı aralığı (>= liveStart) yetkili sayıp değiştir → düzenleme/silme
  // yansır, eski geçmiş kaybolmaz, aradaki mesajlar prev'de durduğundan BOŞLUK oluşmaz.
  const refetch = useCallback(
    async (mk: string, did: string) => {
      const live = await apiFetchMessages(mk, did, { limit: PAGE_SIZE, noReceipt: getChatPrefs().hideReadReceipts });
      setServerMsgs((prev) => {
        if (live.length === 0) return prev;
        const liveStart = live[0].at;
        const older = prev.filter((m) => m.at < liveStart);
        return mergeById(older, live);
      });
      return live;
    },
    [],
  );

  // Yukarı kaydırınca daha eski PAGE_SIZE mesajı yükle (en eski yüklenenden ÖNCE), öne ekle.
  const loadOlder = useCallback(async () => {
    if (!matchKey || !deviceId || loadingOlder || !hasMoreOlder) return;
    const earliest = serverMsgs[0]?.at;
    if (!earliest) return;
    setLoadingOlder(true);
    try {
      const batch = await apiFetchMessages(matchKey, deviceId, { limit: PAGE_SIZE, before: earliest });
      if (batch.length > 0) setServerMsgs((prev) => mergeById(batch, prev));
      if (batch.length < PAGE_SIZE) setHasMoreOlder(false);
    } finally {
      setLoadingOlder(false);
    }
  }, [matchKey, deviceId, serverMsgs, loadingOlder, hasMoreOlder]);

  // Kurulum: deviceId + ensureMatch + ilk yükleme + (boşsa) açılış mesajı.
  useEffect(() => {
    let alive = true;
    (async () => {
      const did = await getProfileKey();
      if (!alive) return;
      setDeviceId(did);
      const person = getPerson(personId);
      // Listeden açıldıysa anahtar hazır → doğrudan kullan. Yeni sohbette (arama/profil/story)
      // anahtar yok → ensureMatch ile oluştur.
      const mk =
        presetKey ??
        (await apiEnsureMatch({
          deviceId: did,
          partnerId: personId,
          // Gerçek kullanıcıda (PEOPLE'da yok) ad/avatar parametreden gelir → deviceId yerine isim.
          partnerName: override?.name || person?.name || personId,
          partnerAvatar: override?.avatar || person?.avatar || "",
        }));
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
      // Tam sayfa geldiyse muhtemelen daha eski mesajlar var (yukarı kaydırınca yüklenir).
      if (alive) setHasMoreOlder(msgs.length >= PAGE_SIZE);
      // Otomatik açılış mesajı yalnız mock kişide (gerçek kullanıcıda sahte mesaj yok).
      if (alive && msgs.length === 0 && isMock) {
        await apiSendMessage({ matchKey: mk, senderDeviceId: botId(personId), text: OPENER });
        if (alive) await refetch(mk, did);
      }
    })();
    return () => {
      alive = false;
    };
  }, [personId, refetch, isMock, presetKey]);

  // 3sn polling: mesajlar + (gerçek kullanıcıda) karşı tarafın "yazıyor" durumu.
  useEffect(() => {
    if (!matchKey || !deviceId) return;
    const tick = () => {
      void refetch(matchKey, deviceId);
      if (!isMock) {
        void apiGetTyping(matchKey, deviceId).then(setPartnerTyping);
        // hideLastSeen → ping "gizli" gider; karşı taraf çevrimiçi/son görülmemizi göremez.
        void apiPingPresence(deviceId, getChatPrefs().hideLastSeen);
        void apiGetPresence(personId).then(setPartnerPresence); // karşı tarafın durumu
      }
    };
    tick(); // hemen bir kez (ekran açılır açılmaz durum gelsin)
    const iv = setInterval(tick, 3000);
    return () => clearInterval(iv);
  }, [matchKey, deviceId, refetch, isMock, personId]);

  // Kullanıcı yazarken karşı tarafa "yazıyor" bildir (2.5sn'de bir, gereksiz istek atma).
  const notifyTyping = useCallback(() => {
    if (isMock || !matchKey || !deviceId) return;
    if (getChatPrefs().hideTyping) return; // "yazıyor…" göstergesini gizle
    const now = Date.now();
    if (now - lastTypingPing.current < 2500) return;
    lastTypingPing.current = now;
    void apiSetTyping(matchKey, deviceId);
  }, [isMock, matchKey, deviceId]);

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
    async (text: string, reply?: { id: string; qMine: boolean; snippet: string } | null) => {
      const trimmed = text.trim();
      if (!trimmed || !matchKey || !deviceId) return;
      counter.current += 1;
      const tempId = `tmp_${counter.current}`;
      // Yanıt varsa kablo metnine alıntı bilgisini göm; optimistik balon zaten alıntıyı gösterir.
      const wire = reply
        ? `${REPLY_PREFIX}${reply.id}${REPLY_SEP}${reply.qMine ? "1" : "0"}${REPLY_SEP}${reply.snippet}${REPLY_SEP}${trimmed}`
        : trimmed;
      const optimistic: Msg = {
        id: tempId, fromMe: true, text: trimmed, at: Date.now(), pending: true,
        replyTo: reply ? { id: reply.id, qMine: reply.qMine, snippet: reply.snippet } : null,
      };
      setPending((p) => [...p, optimistic]);

      const sent = await apiSendMessage({ matchKey, senderDeviceId: deviceId, text: wire });
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

  // Sesli mesaj: R2'ye yükle → backend'e "[voice]<sn>:<url>" olarak gönder (kalıcı + karşı taraf
  // gerçekten alır). Yükleme başarısızsa (çevrimdışı) eski davranışa düş: yerelde sakla.
  const sendVoice = useCallback(
    async (uri: string, sec: number) => {
      if (!matchKey || !deviceId) return;
      counter.current += 1;
      const dur = Math.max(1, Math.round(sec));
      const tempId = `tmp_voice_${counter.current}`;
      // Optimistik: yerel uri ile anında göster (gönderiliyor).
      const optimistic: Msg = { id: tempId, fromMe: true, text: "", at: Date.now(), audioUri: uri, audioSec: dur, pending: true };
      setPending((p) => [...p, optimistic]);

      const url = await uploadVoice(uri);
      if (url) {
        const sent = await apiSendMessage({ matchKey, senderDeviceId: deviceId, text: `${VOICE_PREFIX}${dur}:${url}` });
        if (sent) await refetch(matchKey, deviceId);
        setPending((p) => p.filter((m) => m.id !== tempId));
        botReply("🎤 sesli mesaj");
        return;
      }

      // Çevrimdışı / yükleme başarısız → yerel sesli mesaj (offline fallback, sadece bu cihazda).
      const local: Msg = { id: `voice_${counter.current}_${Date.now()}`, fromMe: true, text: "", at: Date.now(), audioUri: uri, audioSec: dur };
      const next = [...localImgs, local];
      setLocalImgs(next);
      await AsyncStorage.setItem(imgKey(matchKey), JSON.stringify(next));
      setPending((p) => p.filter((m) => m.id !== tempId));
      botReply("🎤 sesli mesaj");
    },
    [matchKey, deviceId, localImgs, refetch, botReply],
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
    const fromServer: Msg[] = serverMsgs
      // Tepki mesajları balon olarak çizilmez (aşağıda reactions map'ine ayrıştırılır).
      .filter((m) => !m.text.startsWith(REACT_PREFIX))
      .map((m) => {
        // Alıntı/yanıt: "[reply]<id><qMine><özet><metin>" → düz metin balonu + üstte alıntı bloğu.
        const rep = parseReply(m.text);
        if (rep) {
          return { id: m.id, fromMe: m.fromMe, text: rep.text, at: m.at, readAt: m.readAt ?? null, replyTo: rep.replyTo };
        }
        // Backend foto mesajı: text "[img]<url>" → imageUri olarak render et (karşı taraf/öteki cihaz da görür).
        if (m.text.startsWith(IMG_PREFIX)) {
          return { id: m.id, fromMe: m.fromMe, text: "", at: m.at, imageUri: m.text.slice(IMG_PREFIX.length), readAt: m.readAt ?? null };
        }
        // Sesli mesaj: "[voice]<sn>:<url>" → audioUri + süre.
        if (m.text.startsWith(VOICE_PREFIX)) {
          const rest = m.text.slice(VOICE_PREFIX.length);
          const ci = rest.indexOf(":");
          const audioSec = ci > 0 ? parseInt(rest.slice(0, ci), 10) || undefined : undefined;
          const audioUri = ci > 0 ? rest.slice(ci + 1) : rest;
          return { id: m.id, fromMe: m.fromMe, text: "", at: m.at, audioUri, audioSec, readAt: m.readAt ?? null };
        }
        return { id: m.id, fromMe: m.fromMe, text: m.text, at: m.at, readAt: m.readAt ?? null };
      });
    const all = [...fromServer, ...localImgs, ...pending];
    all.sort((a, b) => a.at - b.at);
    return all;
  }, [serverMsgs, localImgs, pending]);

  // Tepkiler: "[react]<hedefId>:<emoji>" mesajlarını (zaman sırasıyla) hedef mesaj id'sine göre topla.
  // En son tepki kazanır; emoji boş = tepkiyi kaldır. Her taraf (mine/theirs) için tek tepki.
  const reactions = useMemo<Record<string, MsgReactions>>(() => {
    const map: Record<string, MsgReactions> = {};
    [...serverMsgs]
      .filter((m) => m.text.startsWith(REACT_PREFIX))
      .sort((a, b) => a.at - b.at)
      .forEach((m) => {
        const rest = m.text.slice(REACT_PREFIX.length);
        const ci = rest.indexOf(":");
        if (ci <= 0) return;
        const targetId = rest.slice(0, ci);
        const emoji = rest.slice(ci + 1) || null;
        const cur = map[targetId] ?? { mine: null, theirs: null };
        if (m.fromMe) cur.mine = emoji;
        else cur.theirs = emoji;
        map[targetId] = cur;
      });
    return map;
  }, [serverMsgs]);

  // Bir mesaja tepki ver / değiştir / kaldır (emoji "" = kaldır). Çift taraflı görünür.
  const react = useCallback(
    async (targetId: string, emoji: string) => {
      if (!matchKey || !deviceId) return;
      await apiSendMessage({ matchKey, senderDeviceId: deviceId, text: `${REACT_PREFIX}${targetId}:${emoji}` });
      await refetch(matchKey, deviceId);
    },
    [matchKey, deviceId, refetch],
  );

  return { messages, reactions, react, loadOlder, hasMoreOlder, loadingOlder, typing: typing || partnerTyping, partnerPresence, notifyTyping, send, sendImage, sendVoice, editMessage, deleteMessage, matchKey, ready: !!matchKey };
}
