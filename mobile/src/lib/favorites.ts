import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { API_BASE, type ApiEvent } from "./api";
import { getDeviceId } from "./profileSync";
import { notifyFavAdded } from "./favHint";

const KEY = "meydanfest:favorites:v1";

/**
 * KURAL (#10): Favoriler GERÇEK (oturum açmış) kullanıcıya özeldir.
 * Misafir (guest) veya oturumsuz kullanıcı favori EKLEYEMEZ.
 * `toggleFavorite` bu konuda nötrdür (lokal storage'a yazar); asıl gate
 * çağıran UI tarafındadır (EventCard'daki Heart, `user` yoksa eklemeyi engeller).
 * Sunucuya senkron yalnızca gerçek kullanıcı için best-effort yapılır.
 */

type Listener = (ids: Set<string>) => void;
let cache: Map<string, ApiEvent> | null = null;
const listeners = new Set<Listener>();

async function load(): Promise<Map<string, ApiEvent>> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const arr: ApiEvent[] = raw ? JSON.parse(raw) : [];
    cache = new Map(arr.map((e) => [e.id, e]));
  } catch {
    cache = new Map();
  }
  return cache;
}

async function persist() {
  if (!cache) return;
  await AsyncStorage.setItem(KEY, JSON.stringify([...cache.values()]));
  const ids = new Set(cache.keys());
  listeners.forEach((l) => l(ids));
}

export async function toggleFavorite(e: ApiEvent): Promise<boolean> {
  const c = await load();
  let on: boolean;
  if (c.has(e.id)) {
    c.delete(e.id);
    on = false;
  } else {
    c.set(e.id, e);
    on = true;
  }
  await persist();
  // Yalnızca EKLEMEde bilgilendirme modalını tetikle (favoriden çıkarmada değil).
  if (on) notifyFavAdded();
  return on;
}

/**
 * Mevcut favori id'lerini sunucuya best-effort gönderir (deviceId ile).
 * Yalnızca gerçek kullanıcı için çağrılmalıdır (gate çağırandadır). Hata sessizce yutulur.
 * profileSync ile aynı desen: backend yoksa/erişilemezse sessizce geçer.
 */
export async function syncFavoritesToServer(): Promise<void> {
  try {
    const c = await load();
    const deviceId = await getDeviceId();
    await fetch(`${API_BASE}/api/v1/favorites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "meydanfest-app" },
      body: JSON.stringify({ deviceId, ids: [...c.keys()] }),
    });
  } catch {
    /* best-effort */
  }
}

export function useFavorites() {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [list, setList] = useState<ApiEvent[]>([]);

  useEffect(() => {
    let alive = true;
    load().then((c) => {
      if (!alive) return;
      setIds(new Set(c.keys()));
      setList([...c.values()]);
    });
    const l: Listener = (next) => {
      setIds(new Set(next));
      setList(cache ? [...cache.values()] : []);
    };
    listeners.add(l);
    return () => {
      alive = false;
      listeners.delete(l);
    };
  }, []);

  const toggle = useCallback((e: ApiEvent) => toggleFavorite(e), []);
  return { ids, list, toggle };
}
