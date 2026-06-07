import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

/**
 * Kullanıcının paylaştığı story'ler (lokal). etkinlik/[id] shareStory ile aynı
 * "meydanfest:stories" anahtarını ve { uri, caption, eventSlug, ts } biçimini kullanır.
 */
export interface Story {
  uri: string;
  caption: string;
  eventSlug: string;
  ts: number;
}

const KEY = "meydanfest:stories";

export async function getStories(): Promise<Story[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Story[]) : [];
  } catch {
    return [];
  }
}

export async function addStory(s: Story): Promise<void> {
  const list = await getStories();
  list.unshift(s);
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function removeStory(ts: number): Promise<void> {
  const list = await getStories();
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
