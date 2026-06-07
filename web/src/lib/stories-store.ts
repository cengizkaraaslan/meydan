import "server-only";
import { MOCK_USERS } from "./social-data";
import { db, isDbConfigured } from "./db";

export interface StoryItem {
  id: string;
  userEmail: string;
  userName: string;
  userAvatarUrl?: string;
  userColor: string;
  imageUrl: string;
  caption?: string;
  eventSlug?: string;
  eventTitle?: string;
  city?: string;
  createdAt: string; // ISO
  viewedBy: Set<string>;
}

const TTL_MS = 24 * 60 * 60 * 1000;

// -----------------------------------------------------------------------------
// In-memory store (DATABASE_URL yokken VEYA DB hatası olduğunda fallback).
// DATABASE_URL varsa (isDbConfigured) her şey Prisma'ya gider; bu USE_MOCK_DATA
// (etkinlik veri kaynağı bayrağı) bağımsızdır → story'ler etkinlikler mock olsa bile
// kalıcı + serverless örnekler arası paylaşılır + restart'ta kaybolmaz.
//
// withDb(): DB yapılandırılmışsa Prisma'yı dener; tablo henüz yoksa / DB hatası
// olursa in-memory'e düşer (anasayfa story strip'i asla 500 vermesin). Böylece
// `prisma db push` çalıştırılmadan deploy edilse bile site ayakta kalır.
// -----------------------------------------------------------------------------
type Store = Map<string, StoryItem[]>;

const g = globalThis as unknown as {
  __storiesStore?: Store;
  __storiesSeeded?: boolean;
};
g.__storiesStore ??= new Map<string, StoryItem[]>();
const store: Store = g.__storiesStore;

async function withDb<T>(dbFn: () => Promise<T>, memFn: () => T | Promise<T>): Promise<T> {
  if (isDbConfigured) {
    try {
      return await dbFn();
    } catch (e) {
      console.error(
        "[stories-store] DB hatası — in-memory'e düşülüyor (prisma db push gerekebilir):",
        e instanceof Error ? e.message : e,
      );
    }
  }
  return memFn();
}

function cutoff(): Date {
  return new Date(Date.now() - TTL_MS);
}

function isFresh(s: StoryItem): boolean {
  return Date.now() - new Date(s.createdAt).getTime() < TTL_MS;
}

function newId(): string {
  return `st-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// -----------------------------------------------------------------------------
// DB satırı → StoryItem
// -----------------------------------------------------------------------------
interface StoryRow {
  id: string;
  userEmail: string;
  userName: string;
  userAvatarUrl: string | null;
  userColor: string;
  imageUrl: string;
  caption: string | null;
  eventSlug: string | null;
  eventTitle: string | null;
  city: string | null;
  createdAt: Date;
  views?: { viewerEmail: string }[];
}

function rowToItem(r: StoryRow): StoryItem {
  return {
    id: r.id,
    userEmail: r.userEmail,
    userName: r.userName,
    userAvatarUrl: r.userAvatarUrl ?? undefined,
    userColor: r.userColor,
    imageUrl: r.imageUrl,
    caption: r.caption ?? undefined,
    eventSlug: r.eventSlug ?? undefined,
    eventTitle: r.eventTitle ?? undefined,
    city: r.city ?? undefined,
    createdAt: r.createdAt.toISOString(),
    viewedBy: new Set((r.views ?? []).map((v) => v.viewerEmail)),
  };
}

export interface AddStoryInput {
  userEmail: string;
  userName: string;
  userAvatarUrl?: string;
  userColor?: string;
  imageUrl: string;
  caption?: string;
  eventSlug?: string;
  eventTitle?: string;
  city?: string;
}

export async function addStory(input: AddStoryInput): Promise<StoryItem> {
  return withDb(
    async () => {
      const r = await db.story.create({
        data: {
          userEmail: input.userEmail,
          userName: input.userName,
          userAvatarUrl: input.userAvatarUrl ?? null,
          userColor: input.userColor ?? "#7c3aed",
          imageUrl: input.imageUrl,
          caption: input.caption?.trim() || null,
          eventSlug: input.eventSlug ?? null,
          eventTitle: input.eventTitle ?? null,
          city: input.city ?? null,
        },
        include: { views: true },
      });
      return rowToItem(r);
    },
    () => {
      const story: StoryItem = {
        id: newId(),
        userEmail: input.userEmail,
        userName: input.userName,
        userAvatarUrl: input.userAvatarUrl,
        userColor: input.userColor ?? "#7c3aed",
        imageUrl: input.imageUrl,
        caption: input.caption?.trim() || undefined,
        eventSlug: input.eventSlug,
        eventTitle: input.eventTitle,
        city: input.city,
        createdAt: new Date().toISOString(),
        viewedBy: new Set<string>(),
      };
      const list = store.get(input.userEmail) ?? [];
      list.push(story);
      store.set(input.userEmail, list);
      return story;
    },
  );
}

export async function listActiveStories(): Promise<StoryItem[]> {
  return withDb(
    async () => {
      const rows = await db.story.findMany({
        where: { createdAt: { gte: cutoff() } },
        include: { views: true },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(rowToItem);
    },
    () => {
      ensureSeed();
      const out: StoryItem[] = [];
      for (const list of store.values()) {
        for (const s of list) if (isFresh(s)) out.push(s);
      }
      return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  );
}

export async function listStoriesForUser(email: string): Promise<StoryItem[]> {
  return withDb(
    async () => {
      const rows = await db.story.findMany({
        where: { userEmail: email, createdAt: { gte: cutoff() } },
        include: { views: true },
        orderBy: { createdAt: "asc" },
      });
      return rows.map(rowToItem);
    },
    () => {
      ensureSeed();
      const list = store.get(email) ?? [];
      return list.filter(isFresh).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
  );
}

export async function listStoriesForEvent(slug: string): Promise<StoryItem[]> {
  return withDb(
    async () => {
      const rows = await db.story.findMany({
        where: { eventSlug: slug, createdAt: { gte: cutoff() } },
        include: { views: true },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(rowToItem);
    },
    async () => {
      const active = await listActiveStories();
      return active.filter((s) => s.eventSlug === slug);
    },
  );
}

export async function markViewed(storyId: string, viewerEmail: string): Promise<void> {
  await withDb(
    async () => {
      const s = await db.story.findUnique({ where: { id: storyId }, select: { userEmail: true } });
      if (!s || s.userEmail === viewerEmail) return; // kendi story'mi izlenmiş sayma
      await db.storyView.upsert({
        where: { storyId_viewerEmail: { storyId, viewerEmail } },
        create: { storyId, viewerEmail },
        update: {},
      });
    },
    () => {
      for (const list of store.values()) {
        const found = list.find((s) => s.id === storyId);
        if (found) {
          if (found.userEmail !== viewerEmail) found.viewedBy.add(viewerEmail);
          return;
        }
      }
    },
  );
}

export interface StoryViewer {
  email: string;
  name: string;
  avatarUrl?: string;
  color: string;
  viewedAt?: string;
}

function resolveViewer(email: string, viewedAt?: string): StoryViewer {
  const u = MOCK_USERS.find((x) => x.username === email.split("@")[0]);
  return {
    email,
    name: u?.name ?? email.split("@")[0],
    avatarUrl: u?.avatarUrl,
    color: u?.color ?? "#7c3aed",
    viewedAt,
  };
}

/** Bir story'i kimlerin gördüğü — sadece story sahibi için döndürülür */
export async function getStoryViewers(storyId: string): Promise<StoryViewer[]> {
  return withDb(
    async () => {
      const views = await db.storyView.findMany({
        where: { storyId },
        orderBy: { viewedAt: "asc" },
      });
      return views.map((v) => resolveViewer(v.viewerEmail, v.viewedAt.toISOString()));
    },
    () => {
      for (const list of store.values()) {
        const found = list.find((s) => s.id === storyId);
        if (!found) continue;
        return Array.from(found.viewedBy).map((email) => resolveViewer(email));
      }
      return [];
    },
  );
}

/** Bir story için izlenme sayısı */
export async function getViewCount(storyId: string): Promise<number> {
  return withDb(
    () => db.storyView.count({ where: { storyId } }),
    () => {
      for (const list of store.values()) {
        const found = list.find((s) => s.id === storyId);
        if (found) return found.viewedBy.size;
      }
      return 0;
    },
  );
}

export interface ActiveUserStrip {
  email: string;
  name: string;
  avatarUrl?: string;
  color: string;
  hasUnviewed: boolean;
  storyCount: number;
  latestCreatedAt: string;
}

/** Taze story listesini kullanıcı bazında gruplayıp strip modeline çevirir (mock+DB ortak). */
function groupActiveUsers(
  stories: StoryItem[],
  viewerEmail: string | null,
  eventSlug?: string,
): ActiveUserStrip[] {
  const grouped = new Map<string, StoryItem[]>();
  for (const s of stories) {
    if (!isFresh(s)) continue;
    if (eventSlug && s.eventSlug !== eventSlug) continue;
    const list = grouped.get(s.userEmail) ?? [];
    list.push(s);
    grouped.set(s.userEmail, list);
  }

  const out: ActiveUserStrip[] = [];
  for (const [email, list] of grouped.entries()) {
    const sorted = list.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const head = sorted[sorted.length - 1];
    const hasUnviewed = !viewerEmail || sorted.some((s) => !s.viewedBy.has(viewerEmail));
    out.push({
      email,
      name: head.userName,
      avatarUrl: head.userAvatarUrl,
      color: head.userColor,
      hasUnviewed,
      storyCount: sorted.length,
      latestCreatedAt: head.createdAt,
    });
  }
  // Önce: okumadığın olanlar; sonra: en yeni hikayeyi olan
  return out.sort((a, b) => {
    if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1;
    return b.latestCreatedAt.localeCompare(a.latestCreatedAt);
  });
}

export async function getActiveUsers(
  viewerEmail: string | null,
  opts?: { eventSlug?: string },
): Promise<ActiveUserStrip[]> {
  return withDb(
    async () => {
      const rows = await db.story.findMany({
        where: {
          createdAt: { gte: cutoff() },
          ...(opts?.eventSlug ? { eventSlug: opts.eventSlug } : {}),
        },
        include: { views: true },
        orderBy: { createdAt: "desc" },
      });
      return groupActiveUsers(rows.map(rowToItem), viewerEmail, opts?.eventSlug);
    },
    () => {
      ensureSeed();
      const all: StoryItem[] = [];
      for (const list of store.values()) all.push(...list);
      return groupActiveUsers(all, viewerEmail, opts?.eventSlug);
    },
  );
}

export async function removeStory(id: string, ownerEmail: string): Promise<boolean> {
  return withDb(
    async () => {
      const res = await db.story.deleteMany({ where: { id, userEmail: ownerEmail } });
      return res.count > 0;
    },
    () => {
      const list = store.get(ownerEmail);
      if (!list) return false;
      const idx = list.findIndex((s) => s.id === id);
      if (idx === -1) return false;
      list.splice(idx, 1);
      if (list.length === 0) store.delete(ownerEmail);
      else store.set(ownerEmail, list);
      return true;
    },
  );
}

// -----------------------------------------------------------------------------
// Seed — yalnızca in-memory (DB'siz/fallback) modda. DB modunda gerçek story'ler.
// -----------------------------------------------------------------------------

const SEED_IMAGES = [
  "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=720&h=1280&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=720&h=1280&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=720&h=1280&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=720&h=1280&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=720&h=1280&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=720&h=1280&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=720&h=1280&fit=crop&auto=format",
];

const SEED_CAPTIONS = [
  "Bu akşam efsane geçecek 🎶",
  "Bizimle misin?",
  "Sahne ışıkları muhteşem",
  "Atmosfer harika ✨",
  "Etkinlik başlamak üzere!",
  "Festival vibe 🎪",
  "Bu kareyi kaçırma",
];

const SEED_EVENTS: Array<{ slug: string; title: string; city: string }> = [
  { slug: "manga-konseri-istanbul", title: "maNga • İstanbul Konseri", city: "İstanbul" },
  { slug: "kadikoy-belediyesi-acik-hava-jazz", title: "Kadıköy Açık Hava Jazz Akşamı", city: "İstanbul" },
  { slug: "rock-n-coke-2026", title: "Rock'n Coke 2026", city: "İstanbul" },
  { slug: "tarkan-ankara-konseri", title: "Tarkan Ankara Konseri", city: "Ankara" },
  { slug: "izmir-uluslararasi-tiyatro-festivali", title: "İzmir Uluslararası Tiyatro Festivali", city: "İzmir" },
];

function ensureSeed(): void {
  if (g.__storiesSeeded) return;
  g.__storiesSeeded = true;

  const users = MOCK_USERS.slice(0, 6);
  users.forEach((u, idx) => {
    const email = `seed-${u.username}@meydanfest.local`;
    const evt = SEED_EVENTS[idx % SEED_EVENTS.length];
    const stories: StoryItem[] = [];
    const baseAgeMin = 30 + idx * 90;
    const count = idx % 3 === 0 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const ageMs = (baseAgeMin + i * 25) * 60 * 1000;
      stories.push({
        id: `seed-st-${u.username}-${i}`,
        userEmail: email,
        userName: u.name,
        userAvatarUrl: u.avatarUrl,
        userColor: u.color,
        imageUrl: SEED_IMAGES[(idx + i) % SEED_IMAGES.length],
        caption: SEED_CAPTIONS[(idx + i) % SEED_CAPTIONS.length],
        eventSlug: i === 0 ? evt.slug : undefined,
        eventTitle: i === 0 ? evt.title : undefined,
        city: evt.city,
        createdAt: new Date(Date.now() - ageMs).toISOString(),
        viewedBy: new Set<string>(),
      });
    }
    store.set(email, stories);
  });
}
