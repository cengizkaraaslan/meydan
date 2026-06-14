import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetchMatches, apiDeleteMatch, apiMarkAllRead, apiMarkConversationRead } from "./api";
import { getProfileKey } from "./profileSync";
import { getPerson } from "./people";
import { resolveAvatar } from "./avatar";

// Sohbet listesi cache'i (WhatsApp gibi anında göster, arka planda tazele).
const CONVOS_CACHE_KEY = "meydanfest:convosCache";
// Sabitlenen (pin) ve susturulan (mute) sohbetlerin matchKey listeleri (cihaz-yerel).
const PINNED_KEY = "meydanfest:convosPinned";
const MUTED_KEY = "meydanfest:convosMuted";

async function readSet(key: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

async function toggleInSet(key: string, matchKey: string): Promise<boolean> {
  const set = await readSet(key);
  const on = !set.has(matchKey);
  if (on) set.add(matchKey);
  else set.delete(matchKey);
  await AsyncStorage.setItem(key, JSON.stringify([...set])).catch(() => {});
  return on; // yeni durum: true=eklendi (sabit/sessiz), false=kaldırıldı
}

/** Sabitlenen + susturulan matchKey kümelerini birlikte oku (liste çizimi için). */
export async function getConvoFlags(): Promise<{ pinned: Set<string>; muted: Set<string> }> {
  const [pinned, muted] = await Promise.all([readSet(PINNED_KEY), readSet(MUTED_KEY)]);
  return { pinned, muted };
}

/** Sohbeti sabitle/sabiti kaldır → yeni durumu döndürür (true=sabit). */
export function togglePinned(matchKey: string): Promise<boolean> {
  return toggleInSet(PINNED_KEY, matchKey);
}

/** Sohbeti sustur/sesi aç → yeni durumu döndürür (true=sessiz). */
export function toggleMuted(matchKey: string): Promise<boolean> {
  return toggleInSet(MUTED_KEY, matchKey);
}

/** Anasayfadaki sohbet balonu için: backend'teki eşleşmeler + okunmamış sayısı. */
export interface Conversation {
  id: string; // partner (kişi) id
  matchKey: string; // backend'in döndürdüğü yetkili oda anahtarı (mesajlar buna bağlı)
  name: string;
  avatar: string;
  online: boolean;
  lastText: string | null;
  lastAt: number | null; // son mesaj zamanı (epoch ms) — listede tarih+saat göstermek için
  unread: number;
  hasStory: boolean; // partnerın son 24 saatte story'si var mı → listede halka
  storyOwnerId: string | null; // story sahibi ham deviceId (fetchStoriesFor ile çek/aç)
  pinned?: boolean; // kullanıcı sabitledi → listede en üstte 📌
  muted?: boolean; // kullanıcı susturdu → rozet/sayaç yok, 🔕
}

/** Listeye sabit/sessiz bayraklarını işler ve sabitlenenleri (sırayı koruyarak) en üste alır. */
export function decorateConvos(
  list: Conversation[],
  flags: { pinned: Set<string>; muted: Set<string> },
): Conversation[] {
  const decorated = list.map((c) => ({
    ...c,
    pinned: flags.pinned.has(c.matchKey),
    muted: flags.muted.has(c.matchKey),
  }));
  // Sabitlenenler üstte; kendi içlerinde orijinal (zaman) sırası korunur (stable sort).
  return decorated
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (b.c.pinned ? 1 : 0) - (a.c.pinned ? 1 : 0) || a.i - b.i)
    .map((x) => x.c);
}

/** Son mesaj önizlemesi: foto mesajı ("[img]<url>") ve sesli mesaj ham URL/işaret yerine
 *  güvenli/okunur metin gösterilir (içeride dolaşan URL'leri kullanıcıya sızdırma). */
function previewText(text: string | null): string | null {
  if (!text) return text;
  // Yanıt mesajı: "[reply]<id><qMine><özet><gerçek metin>" → yalnız gerçek metni göster.
  if (text.startsWith("[reply]")) {
    const parts = text.slice("[reply]".length).split("");
    text = parts.length >= 4 ? parts.slice(3).join("") : text;
    if (!text) return text;
  }
  if (text.startsWith("[img]")) return "📷 Fotoğraf";
  if (text.startsWith("[voice]") || text.startsWith("[audio]")) return "🎤 Sesli mesaj";
  return text;
}

/** Cache'lenmiş sohbet listesi (ANINDA, ağ beklemeden). Yoksa boş. */
export async function getCachedConversations(): Promise<Conversation[]> {
  try {
    const raw = await AsyncStorage.getItem(CONVOS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Conversation[]) : [];
  } catch {
    return [];
  }
}

/** Backend'ten eşleşme özetlerini çekip sohbet listesine dönüştürür (yeni→eski). Sonucu cache'ler. */
export async function listConversations(): Promise<Conversation[]> {
  const deviceId = await getProfileKey();
  const matches = await apiFetchMatches(deviceId);
  const result = matches.map((m) => {
    const p = getPerson(m.partnerId);
    const name = p?.name ?? m.partnerName;
    return {
      id: m.partnerId,
      matchKey: m.matchKey,
      name,
      // Avatar boşsa isimden üretilen fallback (boş kalmasın).
      avatar: resolveAvatar(p?.avatar ?? m.partnerAvatar, name, null),
      online: p?.online ?? false,
      lastText: previewText(m.lastMessage),
      lastAt: m.lastAt ? Date.parse(m.lastAt) : null,
      unread: m.unread,
      hasStory: !!m.hasStory,
      storyOwnerId: m.storyOwnerId ?? null,
    };
  });
  // Bir sonraki açılışta anında göstermek için cache'le.
  AsyncStorage.setItem(CONVOS_CACHE_KEY, JSON.stringify(result)).catch(() => {});
  return result;
}

/** Tüm sohbetlerdeki toplam okunmamış mesaj sayısı (balon rozeti için). Susturulanlar sayılmaz. */
export function totalUnread(convos: Conversation[]): number {
  return convos.reduce((sum, c) => sum + (c.muted ? 0 : c.unread), 0);
}

/** Bir konuşmayı (matchKey) bu cihazın listesinden siler. */
export async function deleteConversation(matchKey: string): Promise<boolean> {
  const deviceId = await getProfileKey();
  return apiDeleteMatch(deviceId, matchKey);
}

/** Tüm sohbetleri okundu işaretler → balon rozeti sıfırlanır. */
export async function markAllConversationsRead(): Promise<boolean> {
  const deviceId = await getProfileKey();
  return apiMarkAllRead(deviceId);
}

/** YALNIZ bir sohbeti (matchKey) okundu işaretler → o satırın rozeti sıfırlanır. */
export async function markConversationRead(matchKey: string): Promise<boolean> {
  const deviceId = await getProfileKey();
  return apiMarkConversationRead(deviceId, matchKey);
}
