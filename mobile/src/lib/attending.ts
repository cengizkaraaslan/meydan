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

/**
 * Etkinlik id'sinden deterministik (sabit) bir sayı türetir — her açılışta aynı sonucu
 * verir (Math.random YOK). Mock katılımcı listelerini bölüştürmek için kullanılır.
 */
export function hashEventId(eventId: string): number {
  let h = 2166136261;
  for (let i = 0; i < eventId.length; i++) {
    h ^= eventId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Bir etkinliğin RSVP kategorisi (going/maybe/interested) için, verilen kişi listesinden
 * DETERMİNİSTİK bir alt küme döndürür. Aynı etkinlik+kategori için her zaman aynı kişiler;
 * farklı kategoriler farklı (çakışmayan) dilimler alır. Gerçek kullanıcı yok — mock.
 *
 * @param eventId etkinlik kimliği (deterministik tohum)
 * @param category "going" | "maybe" | "interested"
 * @param people  havuz (people.ts PEOPLE)
 */
export function mockAttendeesFor<T>(eventId: string, category: Rsvp, people: readonly T[]): T[] {
  if (people.length === 0) return [];
  const base = hashEventId(eventId);
  // Kategoriye sabit bir ofset ver → üç kategori farklı yerlerden başlasın.
  const catOffset = category === "going" ? 0 : category === "maybe" ? 1 : 2;
  const seed = base + catOffset * 101;
  const start = seed % people.length;
  // Kategori başına farklı (ama deterministik) bir uzunluk: going > maybe > interested eğilimi.
  const baseCounts = category === "going" ? 5 : category === "maybe" ? 4 : 3;
  const count = baseCounts + (seed % 3); // 3..7 arası
  const out: T[] = [];
  // Çakışmaları azaltmak için kategoriye göre farklı adım (stride) ile dolaş.
  const stride = category === "going" ? 1 : category === "maybe" ? 2 : 3;
  for (let i = 0; i < count && i < people.length; i++) {
    out.push(people[(start + i * stride) % people.length]);
  }
  // Tekrarları temizle (stride people.length ile ortak bölene düşerse oluşabilir).
  return out.filter((p, i) => out.indexOf(p) === i);
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
