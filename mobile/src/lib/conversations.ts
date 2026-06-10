import { apiFetchMatches } from "./api";
import { getOrCreateDeviceId } from "./device";
import { getPerson } from "./people";

/** Anasayfadaki sohbet balonu için: backend'teki eşleşmeler + okunmamış sayısı. */
export interface Conversation {
  id: string; // partner (kişi) id
  name: string;
  avatar: string;
  online: boolean;
  lastText: string | null;
  unread: number;
}

/** Son mesaj önizlemesi: foto mesajı ("[img]<url>") ve sesli mesaj ham URL/işaret yerine
 *  güvenli/okunur metin gösterilir (içeride dolaşan URL'leri kullanıcıya sızdırma). */
function previewText(text: string | null): string | null {
  if (!text) return text;
  if (text.startsWith("[img]")) return "📷 Fotoğraf";
  if (text.startsWith("[voice]") || text.startsWith("[audio]")) return "🎤 Sesli mesaj";
  return text;
}

/** Backend'ten eşleşme özetlerini çekip sohbet listesine dönüştürür (yeni→eski). */
export async function listConversations(): Promise<Conversation[]> {
  const deviceId = await getOrCreateDeviceId();
  const matches = await apiFetchMatches(deviceId);
  return matches.map((m) => {
    const p = getPerson(m.partnerId);
    return {
      id: m.partnerId,
      name: p?.name ?? m.partnerName,
      avatar: p?.avatar ?? m.partnerAvatar,
      online: p?.online ?? false,
      lastText: previewText(m.lastMessage),
      unread: m.unread,
    };
  });
}

/** Tüm sohbetlerdeki toplam okunmamış mesaj sayısı (balon rozeti için). */
export function totalUnread(convos: Conversation[]): number {
  return convos.reduce((sum, c) => sum + c.unread, 0);
}
