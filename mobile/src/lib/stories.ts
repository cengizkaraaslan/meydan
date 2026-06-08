import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { createStory, deleteStoryRemote, fetchMyStories, updateStoryCaption as updateStoryCaptionRemote, uploadImage } from "./social";

/**
 * Kullanıcının paylaştığı story'ler. "meydanfest:stories" anahtarı.
 * Modül-içi dinleyicilerle TÜM ekranlar (profil/Meydan/etkinlik) anında senkron olur.
 */
export interface Story {
  uri: string;
  caption: string;
  eventSlug: string;
  ts: number;
  /** Backend (DB) story id'si — R2'ye yüklenip DB'ye kaydedildiyse dolu olur. */
  id?: string;
  /** Hangi etkinlikten paylaşıldı (story üzerinde gösterilir). */
  eventTitle?: string;
  city?: string;
}

const KEY = "meydanfest:stories";
const AVATAR_KEY = "meydanfest:avatar";

// ── Reaktiflik: tüm useStories örnekleri eklenince/silinince/güncellenince yenilenir ──
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}

export async function getStories(): Promise<Story[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Story[]) : [];
  } catch {
    return [];
  }
}

export async function addStory(s: Story): Promise<void> {
  let entry: Story = s;
  try {
    const r2Url = await uploadImage(s.uri, "story");
    if (r2Url) {
      const avatar = await AsyncStorage.getItem(AVATAR_KEY);
      const created = await createStory({
        imageUrl: r2Url,
        caption: s.caption,
        eventSlug: s.eventSlug || undefined,
        eventTitle: s.eventTitle || undefined,
        avatar: avatar || undefined,
      });
      entry = { ...s, uri: r2Url, id: created?.id };
    }
    // r2Url null ise → FALLBACK: yerel uri ile kaydet (id yok).
  } catch {
    entry = s;
  }
  const list = await getStories();
  list.unshift(entry);
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
  notify(); // tüm ekranlar anında görsün
}

export async function removeStory(ts: number): Promise<void> {
  const list = await getStories();
  const found = list.find((s) => s.ts === ts);
  if (found?.id) {
    try {
      await deleteStoryRemote(found.id);
    } catch {
      /* DB silme başarısız olsa bile yerelden çıkar */
    }
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(list.filter((s) => s.ts !== ts)));
  notify();
}

/** Story başlığını (caption) düzenle — yerel + backend. */
export async function updateStoryCaption(ts: number, caption: string): Promise<void> {
  const list = await getStories();
  const found = list.find((s) => s.ts === ts);
  if (!found) return;
  if (found.id) {
    try {
      await updateStoryCaptionRemote(found.id, caption); // backend
    } catch {
      /* yerel yine de güncellenir */
    }
  }
  const next = list.map((s) => (s.ts === ts ? { ...s, caption } : s));
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  notify();
}

/**
 * Backend'teki KENDİ story'lerimi (deviceId) çekip yerelle birleştirir.
 * Böylece profil her zaman ID'ye bağlı, yalnızca BENİM story'lerimi gösterir
 * (yeniden kurulumda bile gelir). Çevrimdışıysa yerel korunur.
 */
export async function syncStoriesFromBackend(): Promise<void> {
  try {
    const remote = await fetchMyStories();
    const local = await getStories();
    const mapped: Story[] = remote.map((r) => ({
      uri: r.imageUrl,
      caption: r.caption ?? "",
      eventSlug: r.eventSlug ?? "",
      ts: Date.parse(r.createdAt) || Date.now(),
      id: r.id,
      eventTitle: r.eventTitle ?? undefined,
    }));
    const remoteIds = new Set(mapped.map((m) => m.id));
    // Backend'de olmayan yerel (henüz yüklenmemiş / offline) kayıtları koru.
    const localOnly = local.filter((l) => !l.id || !remoteIds.has(l.id));
    const merged = [...mapped, ...localOnly].sort((a, b) => b.ts - a.ts);
    await AsyncStorage.setItem(KEY, JSON.stringify(merged));
    notify();
  } catch {
    /* çevrimdışı → yerel kalır */
  }
}

/** Story'ler için reaktif okuma — herhangi bir ekranda değişiklik anında yansır. */
export function useStories() {
  const [stories, setStories] = useState<Story[]>([]);
  const reload = useCallback(() => {
    getStories().then(setStories);
  }, []);
  useEffect(() => {
    reload();
    void syncStoriesFromBackend(); // ID'ye bağlı kendi story'lerimi backend'den getir
    listeners.add(reload);
    return () => {
      listeners.delete(reload);
    };
  }, [reload]);
  const remove = useCallback(async (ts: number) => {
    await removeStory(ts);
  }, []);
  const editCaption = useCallback(async (ts: number, caption: string) => {
    await updateStoryCaption(ts, caption);
  }, []);
  return { stories, reload, remove, editCaption };
}
