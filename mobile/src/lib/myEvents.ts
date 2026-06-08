import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

/** Kullanıcının kendi oluşturduğu etkinlik (yerelde saklanır, düzenlenebilir). */
export interface MyEvent {
  id: string;
  title: string;
  category: string | null;
  venue: string;
  city: string | null;
  district: string | null;
  description: string;
  website: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  imageUri: string | null;
  startsAt: string; // ISO
  createdAt: number;
}

const KEY = "meydanfest:myevents";
const listeners = new Set<() => void>();

function genId(): string {
  return `e_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

async function readAll(): Promise<MyEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as MyEvent[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function writeAll(list: MyEvent[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
  listeners.forEach((l) => l());
}

/** Tüm oluşturulan etkinlikler (yeni→eski). */
export async function listMyEvents(): Promise<MyEvent[]> {
  const list = await readAll();
  return [...list].sort((a, b) => b.createdAt - a.createdAt);
}

export async function getMyEvent(id: string): Promise<MyEvent | null> {
  const list = await readAll();
  return list.find((e) => e.id === id) ?? null;
}

export async function countMyEvents(): Promise<number> {
  return (await readAll()).length;
}

/** Yeni oluştur (id yoksa) veya mevcut etkinliği güncelle (id varsa). Kaydedilen etkinliği döner. */
export async function upsertMyEvent(
  input: Omit<MyEvent, "id" | "createdAt"> & { id?: string },
): Promise<MyEvent> {
  const list = await readAll();
  if (input.id) {
    const idx = list.findIndex((e) => e.id === input.id);
    if (idx >= 0) {
      const updated: MyEvent = { ...list[idx], ...input, id: input.id };
      list[idx] = updated;
      await writeAll(list);
      return updated;
    }
  }
  const created: MyEvent = { ...input, id: genId(), createdAt: Date.now() };
  list.push(created);
  await writeAll(list);
  return created;
}

export async function removeMyEvent(id: string): Promise<void> {
  const list = await readAll();
  await writeAll(list.filter((e) => e.id !== id));
}

/** Reaktif liste — değişimlerde otomatik güncellenir. */
export function useMyEvents() {
  const [list, setList] = useState<MyEvent[]>([]);
  const reload = useCallback(() => {
    void listMyEvents().then(setList);
  }, []);
  useEffect(() => {
    reload();
    const l = () => reload();
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, [reload]);
  return { list, reload };
}
