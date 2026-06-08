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
      lastText: m.lastMessage,
      unread: m.unread,
    };
  });
}

/** Tüm sohbetlerdeki toplam okunmamış mesaj sayısı (balon rozeti için). */
export function totalUnread(convos: Conversation[]): number {
  return convos.reduce((sum, c) => sum + c.unread, 0);
}
