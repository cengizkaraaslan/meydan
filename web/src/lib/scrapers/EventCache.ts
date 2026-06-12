import "server-only";
import { db, isDbConfigured } from "../db";
import { syncSystemPostsForEvents } from "../social-store";
import { slugify } from "../utils";
import type { EventCategory, EventListItem, EventSource, ScrapedEvent } from "../types";

/**
 * Scraper sonuçlarının kalıcı deposu (Neon Postgres).
 *
 * Eskiden no-op stub'tı → scrape edilen etkinlikler UI'da hiç görünmüyordu.
 * Artık cron (`/api/cron/scrape`) scrape sonuçlarını `setEventsForSource` ile
 * db.event'e (source != "MANUAL") yazar; sayfalar/`getEvents`/public API bunları
 * `getAllCachedEvents` ile okur. DATABASE_URL yoksa eski davranış (boş) korunur.
 */

/** (source, externalId) için kararlı, çakışmasız slug üretir. */
function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36).slice(0, 7);
}

function buildSlug(e: ScrapedEvent): string {
  const base = slugify(e.title) || "etkinlik";
  return `${base}-${shortHash(`${e.source}|${e.externalId}`)}`;
}

interface CachedRow {
  id: string;
  slug: string;
  source: string;
  externalId: string;
  title: string;
  description: string | null;
  category: string;
  venue: string;
  city: string;
  country: string | null;
  district: string | null;
  organizer: string | null;
  startsAt: Date;
  endsAt: Date | null;
  priceMin: number | null;
  priceMax: number | null;
  isFree: boolean;
  ticketUrl: string | null;
  imageUrl: string | null;
  artist: string | null;
  featured: boolean;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  phone: string | null;
}

function rowToListItem(r: CachedRow): EventListItem {
  return {
    id: r.id,
    slug: r.slug,
    source: r.source as EventSource,
    externalId: r.externalId,
    title: r.title,
    description: r.description ?? undefined,
    category: r.category as EventCategory,
    venue: r.venue,
    city: r.city,
    country: r.country ?? undefined,
    district: r.district ?? undefined,
    organizer: r.organizer ?? undefined,
    startsAt: r.startsAt,
    endsAt: r.endsAt ?? undefined,
    priceMin: r.priceMin ?? undefined,
    priceMax: r.priceMax ?? undefined,
    isFree: r.isFree,
    ticketUrl: r.ticketUrl ?? undefined,
    imageUrl: r.imageUrl ?? undefined,
    artist: r.artist ?? undefined,
    featured: r.featured,
    website: r.website ?? undefined,
    instagram: r.instagram ?? undefined,
    facebook: r.facebook ?? undefined,
    tiktok: r.tiktok ?? undefined,
    phone: r.phone ?? undefined,
  };
}

const SELECT = {
  id: true, slug: true, source: true, externalId: true, title: true, description: true,
  category: true, venue: true, city: true, country: true, district: true, organizer: true, startsAt: true, endsAt: true,
  priceMin: true, priceMax: true, isFree: true, ticketUrl: true, imageUrl: true,
  artist: true, featured: true,
  website: true, instagram: true, facebook: true, tiktok: true, phone: true,
} as const;

/** Scrape edilmiş (MANUAL olmayan), gizli olmayan, ~geçmiş 1 günden yeni etkinlikler. */
export async function getAllCachedEvents(): Promise<EventListItem[]> {
  if (!isDbConfigured) return [];
  try {
    const cutoff = new Date(Date.now() - 86400_000);
    const rows = await db.event.findMany({
      where: { source: { not: "MANUAL" }, hidden: false, startsAt: { gte: cutoff } },
      orderBy: { startsAt: "asc" },
      take: 3000,
      select: SELECT,
    });
    return (rows as CachedRow[]).map(rowToListItem);
  } catch (err) {
    console.warn("[EventCache] getAll hatası:", err instanceof Error ? err.message : err);
    return [];
  }
}

export async function getCachedEventBySlug(slug: string): Promise<EventListItem | null> {
  if (!isDbConfigured) return null;
  try {
    const row = await db.event.findFirst({
      where: { slug, source: { not: "MANUAL" }, hidden: false },
      select: SELECT,
    });
    return row ? rowToListItem(row as CachedRow) : null;
  } catch {
    return null;
  }
}

/**
 * Bir kaynağın scrape sonuçlarını db.event'e yazar (upsert: source+externalId tekil).
 * Her etkinlik tek tek try/catch — biri (örn. slug çakışması) tüm batch'i bozmasın.
 */
export async function setEventsForSource(
  source: EventSource,
  events: ScrapedEvent[],
): Promise<number> {
  if (!isDbConfigured || events.length === 0) return 0;
  let written = 0;
  const now = new Date();
  const writtenForFeed: { slug: string; title: string; city: string; category: string; imageUrl: string | null; startsAt: Date }[] = [];

  // Her event için upsert verisi + (feed için) özet hazırla.
  const items = events.map((e) => {
    const data = {
      slug: buildSlug(e),
      title: e.title,
      description: e.description ?? null,
      category: e.category as EventCategory,
      venue: e.venue,
      city: e.city,
      country: e.country ?? null,
      district: e.district ?? null,
      organizer: e.organizer ?? null,
      startsAt: e.startsAt,
      endsAt: e.endsAt ?? null,
      priceMin: e.priceMin ?? null,
      priceMax: e.priceMax ?? null,
      isFree: e.isFree,
      ticketUrl: e.ticketUrl ?? null,
      imageUrl: e.imageUrl ?? null,
      artist: e.artist ?? null,
      website: e.website ?? null,
      instagram: e.instagram ?? null,
      facebook: e.facebook ?? null,
      tiktok: e.tiktok ?? null,
      phone: e.phone ?? null,
      hidden: false,
      lastScrapedAt: now,
    };
    return { externalId: e.externalId, data };
  });

  const upsertOne = (it: (typeof items)[number]) =>
    db.event.upsert({
      where: { source_externalId: { source: String(source), externalId: it.externalId } },
      create: { source: String(source), externalId: it.externalId, ...it.data },
      update: it.data,
    });

  // Tek tek `await` (her biri ayrı round-trip) yüzlerce event'te 60sn serverless
  // limitini aşıyordu. Parçalara böl ve her parçayı TEK transaction'da batch'le
  // → round-trip yığılması biter (silme yok; katılım/yorum FK'leri korunur).
  // Yalnızca DB'ye GERÇEKTEN yazılan event'lerin slug'larını feed'e ekle. Aksi halde
  // upsert'i düşen (constraint/slug çakışması vb.) bir event için db.event'te karşılığı
  // olmayan "Sistem" gönderisi üretilir → "Etkinliğe git → bulunamadı" (404) kartı oluşur.
  const pushFeed = (it: (typeof items)[number]) =>
    writtenForFeed.push({ slug: it.data.slug, title: it.data.title, city: it.data.city, category: String(it.data.category), imageUrl: it.data.imageUrl, startsAt: it.data.startsAt });

  const CHUNK = 50;
  try {
    for (let i = 0; i < items.length; i += CHUNK) {
      const chunk = items.slice(i, i + CHUNK);
      await db.$transaction(chunk.map(upsertOne));
      written += chunk.length;
      for (const it of chunk) pushFeed(it);
    }
  } catch (err) {
    console.warn(
      `[EventCache] ${source} batch yazımı düştü, tek tek deneniyor:`,
      err instanceof Error ? err.message : err,
    );
    written = 0;
    writtenForFeed.length = 0;
    for (const it of items) {
      try {
        await upsertOne(it);
        written++;
        pushFeed(it);
      } catch {
        /* tek kayıt hatasını yut — feed'e de eklenmez */
      }
    }
  }
  // Meydan duvarına "Sistem" etkinlik gönderileri (eventSlug ile idempotent — yalnız yeniler eklenir).
  try {
    await syncSystemPostsForEvents(writtenForFeed);
  } catch {
    /* duvar gönderisi scrape'i bozmaz */
  }
  return written;
}
