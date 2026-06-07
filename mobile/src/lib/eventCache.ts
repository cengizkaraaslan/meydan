/**
 * Etkinlik cache'i — feed'i cihazda JSON olarak saklar (AsyncStorage).
 * Amaç: ilk açılışta ağ beklemeden anında içerik göster, ardından arka planda tazele.
 * Sözleşme: anahtar = şehir+kategori kombinasyonu (örn `feed:${city}:${cat}`).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ApiEvent } from "@/lib/api";

const PREFIX = "meydanfest:evcache:";

interface CacheEntry {
  ts: number;
  events: ApiEvent[];
}

/** Etkinlikleri verilen anahtarla cihaza yazar. */
export async function saveEventsCache(key: string, events: ApiEvent[]): Promise<void> {
  try {
    const entry: CacheEntry = { ts: Date.now(), events };
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // cache yazımı best-effort; hata olsa da akışı bozmaz
  }
}

/**
 * Cache'lenmiş etkinlikleri döner. Yaşı ne olursa olsun (örn ~6 saatten eski olsa
 * bile) döndürür — taze veri arka planda çekilir. Yoksa null.
 */
export async function loadEventsCache(key: string): Promise<ApiEvent[] | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (!entry || !Array.isArray(entry.events)) return null;
    return entry.events;
  } catch {
    return null;
  }
}
