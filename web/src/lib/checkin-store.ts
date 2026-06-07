import "server-only";
import { db } from "./db";
import { withDb } from "./db-fallback";

export interface CheckIn {
  id: string;
  userEmail: string;
  userName: string;
  userAvatarUrl?: string;
  userColor: string;
  eventSlug: string;
  eventTitle: string;
  city: string;
  /** ISO */
  createdAt: string;
  /** Opsiyonel mood: 🔥 / 🎉 / 😎 / ❤️ */
  mood?: string;
}

// -----------------------------------------------------------------------------
// Hibrit depolama: DATABASE_URL varsa Prisma (CheckIn modeli), yoksa / DB hatası
// olursa in-memory fallback. Tüm export'lar async + withDb. Aynı kullanıcı +
// aynı etkinlik için tek kayıt (@@unique([userEmail, eventSlug])).
// -----------------------------------------------------------------------------

interface CheckInStoreShape {
  byEvent: Map<string, CheckIn[]>;
  byUser: Map<string, CheckIn[]>;
}

const g = globalThis as unknown as { __checkinStore?: CheckInStoreShape };
g.__checkinStore ??= { byEvent: new Map(), byUser: new Map() };
const store = g.__checkinStore;

// -----------------------------------------------------------------------------
// DB satırı → CheckIn (createdAt ISO string)
// -----------------------------------------------------------------------------
interface CheckInRow {
  id: string;
  userEmail: string;
  userName: string;
  userAvatarUrl: string | null;
  userColor: string;
  eventSlug: string;
  eventTitle: string;
  city: string;
  mood: string | null;
  createdAt: Date;
}

function rowToCheckIn(r: CheckInRow): CheckIn {
  return {
    id: r.id,
    userEmail: r.userEmail,
    userName: r.userName,
    userAvatarUrl: r.userAvatarUrl ?? undefined,
    userColor: r.userColor,
    eventSlug: r.eventSlug,
    eventTitle: r.eventTitle,
    city: r.city,
    createdAt: r.createdAt.toISOString(),
    mood: r.mood ?? undefined,
  };
}

function seedFor(): void {
  // Demo: birkaç fake check-in (yalnızca in-memory/fallback modda)
  const now = Date.now();
  const demo: Omit<CheckIn, "id">[] = [
    {
      userEmail: "ahmet@demo",
      userName: "Ahmet K.",
      userColor: "#7c3aed",
      eventSlug: "eskisehir-kahve-festivali-ll-14235-217",
      eventTitle: "Eskişehir Kahve Festivali",
      city: "Eskişehir",
      createdAt: new Date(now - 1000 * 60 * 30).toISOString(),
      mood: "🔥",
    },
    {
      userEmail: "elif@demo",
      userName: "Elif Ş.",
      userColor: "#f59e0b",
      eventSlug: "eskisehir-kahve-festivali-ll-14235-217",
      eventTitle: "Eskişehir Kahve Festivali",
      city: "Eskişehir",
      createdAt: new Date(now - 1000 * 60 * 60 * 2).toISOString(),
      mood: "🎉",
    },
  ];
  for (const c of demo) {
    const ci: CheckIn = {
      ...c,
      id: `seed-${c.userEmail}-${c.eventSlug}`,
    };
    addToIndexes(ci);
  }
}

function addToIndexes(ci: CheckIn) {
  const evList = store.byEvent.get(ci.eventSlug) ?? [];
  evList.push(ci);
  store.byEvent.set(ci.eventSlug, evList);

  const usList = store.byUser.get(ci.userEmail) ?? [];
  usList.push(ci);
  store.byUser.set(ci.userEmail, usList);
}

let seeded = false;
function ensureSeed() {
  if (seeded) return;
  seeded = true;
  seedFor();
}

export async function listCheckInsForEvent(slug: string): Promise<CheckIn[]> {
  return withDb(
    async () => {
      const rows = await db.checkIn.findMany({
        where: { eventSlug: slug },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(rowToCheckIn);
    },
    () => {
      ensureSeed();
      return (store.byEvent.get(slug) ?? [])
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  );
}

export async function listCheckInsForUser(email: string): Promise<CheckIn[]> {
  return withDb(
    async () => {
      const rows = await db.checkIn.findMany({
        where: { userEmail: email },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(rowToCheckIn);
    },
    () => {
      ensureSeed();
      return (store.byUser.get(email) ?? [])
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  );
}

export async function getCheckInCountForEvent(slug: string): Promise<number> {
  return withDb(
    () => db.checkIn.count({ where: { eventSlug: slug } }),
    () => {
      ensureSeed();
      return store.byEvent.get(slug)?.length ?? 0;
    },
  );
}

export async function hasCheckedIn(email: string, slug: string): Promise<boolean> {
  return withDb(
    async () => {
      const count = await db.checkIn.count({
        where: { userEmail: email, eventSlug: slug },
      });
      return count > 0;
    },
    () => {
      ensureSeed();
      return (store.byEvent.get(slug) ?? []).some((c) => c.userEmail === email);
    },
  );
}

export interface AddCheckInInput {
  userEmail: string;
  userName: string;
  userAvatarUrl?: string;
  userColor: string;
  eventSlug: string;
  eventTitle: string;
  city: string;
  mood?: string;
}

export async function addCheckIn(input: AddCheckInInput): Promise<CheckIn> {
  return withDb(
    async () => {
      // upsert: varsa mevcut kaydı koru (güncelleme yok), yoksa oluştur.
      // Aynı kullanıcı + etkinlik için tek kayıt (@@unique).
      const r = await db.checkIn.upsert({
        where: {
          userEmail_eventSlug: {
            userEmail: input.userEmail,
            eventSlug: input.eventSlug,
          },
        },
        create: {
          userEmail: input.userEmail,
          userName: input.userName,
          userAvatarUrl: input.userAvatarUrl ?? null,
          userColor: input.userColor,
          eventSlug: input.eventSlug,
          eventTitle: input.eventTitle,
          city: input.city,
          mood: input.mood ?? null,
        },
        update: {},
      });
      return rowToCheckIn(r);
    },
    () => {
      ensureSeed();
      // Aynı kullanıcı + aynı etkinlik için sadece bir check-in
      const existing = (store.byEvent.get(input.eventSlug) ?? []).find(
        (c) => c.userEmail === input.userEmail,
      );
      if (existing) return existing;
      const ci: CheckIn = {
        ...input,
        id: `ci-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
      };
      addToIndexes(ci);
      return ci;
    },
  );
}

export async function removeCheckIn(email: string, slug: string): Promise<boolean> {
  return withDb(
    async () => {
      const res = await db.checkIn.deleteMany({
        where: { userEmail: email, eventSlug: slug },
      });
      return res.count > 0;
    },
    () => {
      ensureSeed();
      const evList = store.byEvent.get(slug) ?? [];
      const idx = evList.findIndex((c) => c.userEmail === email);
      if (idx < 0) return false;
      evList.splice(idx, 1);
      const usList = store.byUser.get(email) ?? [];
      const usIdx = usList.findIndex((c) => c.eventSlug === slug);
      if (usIdx >= 0) usList.splice(usIdx, 1);
      return true;
    },
  );
}

/** Rozet için: kullanıcının check-in sayısı */
export async function getCheckInStats(email: string): Promise<{
  total: number;
  uniqueCities: number;
  uniqueEvents: number;
}> {
  return withDb(
    async () => {
      const rows = await db.checkIn.findMany({
        where: { userEmail: email },
        select: { city: true, eventSlug: true },
      });
      return {
        total: rows.length,
        uniqueCities: new Set(rows.map((c) => c.city)).size,
        uniqueEvents: new Set(rows.map((c) => c.eventSlug)).size,
      };
    },
    () => {
      ensureSeed();
      const list = store.byUser.get(email) ?? [];
      return {
        total: list.length,
        uniqueCities: new Set(list.map((c) => c.city)).size,
        uniqueEvents: new Set(list.map((c) => c.eventSlug)).size,
      };
    },
  );
}
