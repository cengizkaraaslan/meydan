import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { createStory, deleteStoryRemote, updateStoryCaption as updateStoryCaptionRemote, uploadImage } from "./social";

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

/** Story'ler için reaktif okuma — herhangi bir ekranda değişiklik anında yansır. */
export function useStories() {
  const [stories, setStories] = useState<Story[]>([]);
  const reload = useCallback(() => {
    getStories().then(setStories);
  }, []);
  useEffect(() => {
    reload();
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
