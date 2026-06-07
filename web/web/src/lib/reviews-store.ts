import "server-only";
import { db } from "./db";
import { withDb } from "./db-fallback";

export interface StoredReview {
  id: string;
  eventSlug: string;
  authorEmail: string;
  authorName: string;
  authorColor: string;
  /** 1-5 */
  rating: number;
  /** Opsiyonel kısa yorum */
  comment: string;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// In-memory store — yalnızca DATABASE_URL yokken VEYA DB hatasında fallback.
// DB modunda (isDbConfigured) her şey Prisma'ya gider; seed YOKtur. Seed sadece
// in-memory fallback içindir ki DB'siz ortamda etkinlik sayfası boş görünmesin.
// withDb(): DB yapılandırılmışsa Prisma'yı dener; tablo yoksa / DB hatası olursa
// in-memory'e düşer (sayfa asla 500 vermesin).
// -----------------------------------------------------------------------------
interface ReviewStoreShape {
  byEvent: Map<string, StoredReview[]>;
}

const g = globalThis as unknown as { __reviewsStore?: ReviewStoreShape };
g.__reviewsStore ??= { byEvent: new Map() };
const store = g.__reviewsStore;

function seedFor(slug: string): StoredReview[] {
  const now = Date.now();
  return [
    {
      id: `rseed-${slug}-1`,
      eventSlug: slug,
      authorEmail: "ahmet@demo",
      authorName: "Ahmet K.",
      authorColor: "#7c3aed",
      rating: 5,
      comment: "Ses ve sahne harikaydı, kesinlikle tavsiye ederim.",
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 10).toISOString(),
    },
    {
      id: `rseed-${slug}-2`,
      eventSlug: slug,
      authorEmail: "elif@demo",
      authorName: "Elif S.",
      authorColor: "#f59e0b",
      rating: 4,
      comment: "Güzeldi ama otopark sorunu vardı.",
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 6).toISOString(),
    },
    {
      id: `rseed-${slug}-3`,
      eventSlug: slug,
      authorEmail: "burak@demo",
      authorName: "Burak D.",
      authorColor: "#10b981",
      rating: 5,
      comment: "Atmosfer muhteşemdi.",
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 3).toISOString(),
    },
  ];
}

// In-memory modda etkinlik ilk istendiğinde demo değerlendirmelerle doldurur.
function ensureSeed(slug: string): StoredReview[] {
  let list = store.byEvent.get(slug);
  if (!list) {
    list = seedFor(slug);
    store.byEvent.set(slug, list);
  }
  return list;
}

export interface ReviewSummary {
  average: number;
  count: number;
  /** [1-yıldız sayısı, 2-yıldız, ..., 5-yıldız] */
  distribution: [number, number, number, number, number];
}

export interface SerializedReview {
  id: string;
  authorEmail: string;
  authorName: string;
  authorColor: string;
  rating: number;
  comment: string;
  createdAt: string;
  isMine: boolean;
}

// -----------------------------------------------------------------------------
// DB satırı → StoredReview
// -----------------------------------------------------------------------------
interface ReviewRow {
  id: string;
  eventSlug: string;
  authorEmail: string;
  authorName: string;
  authorColor: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

function rowToStored(r: ReviewRow): StoredReview {
  return {
    id: r.id,
    eventSlug: r.eventSlug,
    authorEmail: r.authorEmail,
    authorName: r.authorName,
    authorColor: r.authorColor,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
  };
}

// Ortak özet hesabı (mock + DB aynı mantığı paylaşsın).
function buildSummary(list: StoredReview[]): ReviewSummary {
  if (list.length === 0) {
    return { average: 0, count: 0, distribution: [0, 0, 0, 0, 0] };
  }
  const sum = list.reduce((s, r) => s + r.rating, 0);
  const dist: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (const r of list) {
    dist[r.rating - 1]++;
  }
  return {
    average: Math.round((sum / list.length) * 10) / 10,
    count: list.length,
    distribution: dist,
  };
}

export async function summarize(slug: string): Promise<ReviewSummary> {
  return withDb(
    async () => {
      const rows = await db.eventReview.findMany({ where: { eventSlug: slug } });
      return buildSummary(rows.map(rowToStored));
    },
    () => buildSummary(ensureSeed(slug)),
  );
}

export async function listReviews(slug: string, viewerEmail: string): Promise<SerializedReview[]> {
  return withDb(
    async () => {
      const rows = await db.eventReview.findMany({
        where: { eventSlug: slug },
        orderBy: { createdAt: "desc" },
      });
      return rows.map((r) => ({
        id: r.id,
        authorEmail: r.authorEmail,
        authorName: r.authorName,
        authorColor: r.authorColor,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
        isMine: r.authorEmail === viewerEmail,
      }));
    },
    () => {
      const list = ensureSeed(slug);
      return list
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((r) => ({
          id: r.id,
          authorEmail: r.authorEmail,
          authorName: r.authorName,
          authorColor: r.authorColor,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
          isMine: r.authorEmail === viewerEmail,
        }));
    },
  );
}

export async function getMyReview(slug: string, email: string): Promise<StoredReview | null> {
  return withDb(
    async () => {
      const r = await db.eventReview.findUnique({
        where: { eventSlug_authorEmail: { eventSlug: slug, authorEmail: email } },
      });
      return r ? rowToStored(r) : null;
    },
    () => {
      const list = ensureSeed(slug);
      return list.find((r) => r.authorEmail === email) ?? null;
    },
  );
}

export async function upsertReview(input: {
  slug: string;
  authorEmail: string;
  authorName: string;
  authorColor: string;
  rating: number;
  comment: string;
}): Promise<StoredReview> {
  return withDb(
    async () => {
      const now = new Date();
      const r = await db.eventReview.upsert({
        where: {
          eventSlug_authorEmail: { eventSlug: input.slug, authorEmail: input.authorEmail },
        },
        create: {
          eventSlug: input.slug,
          authorEmail: input.authorEmail,
          authorName: input.authorName,
          authorColor: input.authorColor,
          rating: input.rating,
          comment: input.comment,
          createdAt: now,
        },
        update: {
          authorName: input.authorName,
          authorColor: input.authorColor,
          rating: input.rating,
          comment: input.comment,
          createdAt: now, // güncelleme tarihini en üste taşımak için createdAt'i yenile
        },
      });
      return rowToStored(r);
    },
    () => {
      const list = ensureSeed(input.slug);
      const existingIdx = list.findIndex((r) => r.authorEmail === input.authorEmail);
      if (existingIdx >= 0) {
        list[existingIdx] = {
          ...list[existingIdx],
          rating: input.rating,
          comment: input.comment,
          createdAt: new Date().toISOString(),
        };
        return list[existingIdx];
      }
      const r: StoredReview = {
        id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        eventSlug: input.slug,
        authorEmail: input.authorEmail,
        authorName: input.authorName,
        authorColor: input.authorColor,
        rating: input.rating,
        comment: input.comment,
        createdAt: new Date().toISOString(),
      };
      list.push(r);
      return r;
    },
  );
}

export async function removeReview(slug: string, email: string): Promise<boolean> {
  return withDb(
    async () => {
      const res = await db.eventReview.deleteMany({
        where: { eventSlug: slug, authorEmail: email },
      });
      return res.count > 0;
    },
    () => {
      const list = ensureSeed(slug);
      const idx = list.findIndex((r) => r.authorEmail === email);
      if (idx < 0) return false;
      list.splice(idx, 1);
      return true;
    },
  );
}
