import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { type ApiEvent } from "./api";

/**
 * Kullanıcının katılım (RSVP) durumu — tam etkinlik objesiyle saklanır ki profil
 * "Katılacağım / Katıldığım etkinlikler" listelerini API'ye gitmeden gösterebilsin.
 * favorites.ts ile aynı desen (lokal cache + listener + best-effort).
 */
export type Rsvp = "going" | "maybe" | "interested";

export interface AttendingItem {
  event: ApiEvent;
  rsvp: Rsvp;
  ts: number;
}

const KEY = "meydanfest:attending:v1";

type Listener = (items: AttendingItem[]) => void;
let cache: Map<string, AttendingItem> | null = null;
const listeners = new Set<Listener>();

async function load(): Promise<Map<string, AttendingItem>> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const arr: AttendingItem[] = raw ? JSON.parse(raw) : [];
    cache = new Map(arr.map((it) => [it.event.id, it]));
  } catch {
    cache = new Map();
  }
  return cache;
}

async function persist() {
  if (!cache) return;
  await AsyncStorage.setItem(KEY, JSON.stringify([...cache.values()]));
  const items = [...cache.values()];
  listeners.forEach((l) => l(items));
}

/** RSVP ayarla/güncelle; rsvp=null ise kaldırır. */
export async function setAttending(event: ApiEvent, rsvp: Rsvp | null): Promise<void> {
  const c = await load();
  if (!rsvp) c.delete(event.id);
  else c.set(event.id, { event, rsvp, ts: Date.now() });
  await persist();
}

export async function getAttendingRsvp(eventId: string): Promise<Rsvp | null> {
  const c = await load();
  return c.get(eventId)?.rsvp ?? null;
}

function splitByTime(items: AttendingItem[], nowMs: number) {
  const upcoming: AttendingItem[] = [];
  const past: AttendingItem[] = [];
  for (const it of items) {
    const ms = Date.parse(it.event.starts_at);
    if (!Number.isNaN(ms) && ms < nowMs) past.push(it);
    else upcoming.push(it);
  }
  // Yaklaşan: en yakın önce. Geçmiş: en yeni önce.
  upcoming.sort((a, b) => Date.parse(a.event.starts_at) - Date.parse(b.event.starts_at));
  past.sort((a, b) => Date.parse(b.event.starts_at) - Date.parse(a.event.starts_at));
  return { upcoming, past };
}

export function useAttending() {
  const [items, setItems] = useState<AttendingItem[]>([]);

  useEffect(() => {
    let alive = true;
    load().then((c) => {
      if (alive) setItems([...c.values()]);
    });
    const l: Listener = (next) => setItems(next);
    listeners.add(l);
    return () => {
      alive = false;
      listeners.delete(l);
    };
  }, []);

  const now = Date.now();
  const { upcoming, past } = splitByTime(items, now);
  const set = useCallback((e: ApiEvent, r: Rsvp | null) => setAttending(e, r), []);
  return { items, upcoming, past, setAttending: set };
}
