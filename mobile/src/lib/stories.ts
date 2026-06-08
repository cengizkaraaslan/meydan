import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { createStory, deleteStoryRemote, uploadImage } from "./social";

/**
 * Kullanıcının paylaştığı story'ler (lokal). etkinlik/[id] shareStory ile aynı
 * "meydanfest:stories" anahtarını ve { uri, caption, eventSlug, ts } biçimini kullanır.
 */
export interface Story {
  uri: string;
  caption: string;
  eventSlug: string;
  ts: number;
  /** Backend (DB) story id'si — R2'ye yüklenip DB'ye kaydedildiyse dolu olur. */
  id?: string;
}

const KEY = "meydanfest:stories";
const AVATAR_KEY = "meydanfest:avatar";

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
    // 1) Yerel görseli R2'ye yükle.
    const r2Url = await uploadImage(s.uri, "story");
    if (r2Url) {
      // 2) DB story oluştur; başarılıysa R2 mutlak URL + backend id ile kaydet.
      const avatar = await AsyncStorage.getItem(AVATAR_KEY);
      const created = await createStory({
        imageUrl: r2Url,
        caption: s.caption,
        eventSlug: s.eventSlug || undefined,
        avatar: avatar || undefined,
      });
      entry = { ...s, uri: r2Url, id: created?.id };
    }
    // r2Url null ise → FALLBACK: yerel uri ile kaydet (id yok).
  } catch {
    // 3) Upload/backend hatası → FALLBACK: eski davranış (yerel uri).
    entry = s;
  }
  const list = await getStories();
  list.unshift(entry);
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function removeStory(ts: number): Promise<void> {
  const list = await getStories();
  const found = list.find((s) => s.ts === ts);
  if (found?.id) {
    try {
      await deleteStoryRemote(found.id);
    } catch {
      // DB silme başarısız olsa bile yerelden çıkar.
    }
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(list.filter((s) => s.ts !== ts)));
}

/** Profilde story halkası/izleyici için reaktif okuma. reload() ile yenilenir. */
export function useStories() {
  const [stories, setStories] = useState<Story[]>([]);
  const reload = useCallback(() => {
    getStories().then(setStories);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  const remove = useCallback(
    async (ts: number) => {
      await removeStory(ts);
      reload();
    },
    [reload],
  );
  return { stories, reload, remove };
}
