import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetchMatches, apiDeleteMatch, apiMarkAllRead, apiMarkConversationRead } from "./api";
import { getProfileKey } from "./profileSync";
import { getPerson } from "./people";
import { resolveAvatar } from "./avatar";

// Sohbet listesi cache'i (WhatsApp gibi anında göster, arka planda tazele).
const CONVOS_CACHE_KEY = "meydanfest:convosCache";

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

/** Tüm sohbetlerdeki toplam okunmamış mesaj sayısı (balon rozeti için). */
export function totalUnread(convos: Conversation[]): number {
  return convos.reduce((sum, c) => sum + c.unread, 0);
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
