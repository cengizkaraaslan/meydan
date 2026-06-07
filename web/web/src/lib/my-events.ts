/**
 * Organizatör panelinin localStorage mock'u.
 * Kullanıcının kendi oluşturduğu etkinlikler — gerçek DB yok.
 *
 * NOT: MOCK_EVENTS array'i ayrı; burada sadece kullanıcının kendi oluşturduğu
 * etkinlikleri tutuyoruz.
 */

import type { EventCategory } from "./types";

export type MyEventStatus = "DRAFT" | "PUBLISHED" | "PENDING_REVIEW";

export interface MyEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: EventCategory;
  city: string;
  venue: string;
  /** ISO string */
  startsAt: string;
  /** ISO string, opsiyonel */
  endsAt?: string;
  isFree: boolean;
  priceMin?: number;
  priceMax?: number;
  ticketUrl?: string;
  imageUrl?: string;
  status: MyEventStatus;
  /** ISO string */
  createdAt: string;
  /** Sahte istatistik */
  attendeeCount: number;
}

export const MY_EVENTS_LS_KEY = "es.my-events";

export const MY_EVENT_STATUS_LABELS: Record<MyEventStatus, string> = {
  DRAFT: "Taslak",
  PENDING_REVIEW: "Beklemede",
  PUBLISHED: "Yayında",
};

function isMyEvent(v: unknown): v is MyEvent {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.slug === "string" &&
    typeof o.title === "string" &&
    typeof o.description === "string" &&
    typeof o.category === "string" &&
    typeof o.city === "string" &&
    typeof o.venue === "string" &&
    typeof o.startsAt === "string" &&
    typeof o.isFree === "boolean" &&
    typeof o.status === "string" &&
    typeof o.createdAt === "string" &&
    typeof o.attendeeCount === "number"
  );
}

export function readMyEvents(): MyEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MY_EVENTS_LS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMyEvent);
  } catch {
    return [];
  }
}

export function writeMyEvents(events: MyEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MY_EVENTS_LS_KEY, JSON.stringify(events));
  } catch {
    /* quota / private mode — sessiz geç */
  }
}

export function addMyEvent(event: MyEvent): MyEvent[] {
  const list = readMyEvents();
  const next = [event, ...list];
  writeMyEvents(next);
  return next;
}

export function removeMyEvent(id: string): MyEvent[] {
  const list = readMyEvents();
  const next = list.filter((e) => e.id !== id);
  writeMyEvents(next);
  return next;
}

export function updateMyEvent(
  id: string,
  patch: Partial<Omit<MyEvent, "id" | "createdAt">>,
): MyEvent[] {
  const list = readMyEvents();
  const next = list.map((e) => (e.id === id ? { ...e, ...patch } : e));
  writeMyEvents(next);
  return next;
}

/* ------------------------------------------------------------ */
/* useSyncExternalStore subscription                               */
/* ------------------------------------------------------------ */

type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) l();
}

export function subscribeMyEvents(listener: Listener): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    const onStorage = (e: StorageEvent) => {
      if (e.key === MY_EVENTS_LS_KEY) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }
  return () => listeners.delete(listener);
}

/** Read'in stable snapshot'ı için cache; içerik değişmediyse aynı referansı verir. */
let _snapshot: MyEvent[] = [];
let _snapshotRaw: string | null = null;

export function getMyEventsSnapshot(): MyEvent[] {
  if (typeof window === "undefined") return _snapshot;
  const raw = window.localStorage.getItem(MY_EVENTS_LS_KEY);
  if (raw === _snapshotRaw) return _snapshot;
  _snapshotRaw = raw;
  _snapshot = readMyEvents();
  return _snapshot;
}

export function getMyEventsServerSnapshot(): MyEvent[] {
  return _snapshot;
}

/** Bileşenler mutator çağırdıktan sonra subscribe'lı `useSyncExternalStore`'ları tetikler. */
export function notifyMyEventsChanged(): void {
  _snapshotRaw = null;
  emit();
}
