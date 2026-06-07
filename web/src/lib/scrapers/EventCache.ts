import "server-only";
import { db, isDbConfigured } from "../db";
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
  district: string | null;
  startsAt: Date;
  endsAt: Date | null;
  priceMin: number | null;
  priceMax: number | null;
  isFree: boolean;
  ticketUrl: string | null;
  imageUrl: string | null;
  artist: string | null;
  featured: boolean;
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
    district: r.district ?? undefined,
    startsAt: r.startsAt,
    endsAt: r.endsAt ?? undefined,
    priceMin: r.priceMin ?? undefined,
    priceMax: r.priceMax ?? undefined,
    isFree: r.isFree,
    ticketUrl: r.ticketUrl ?? undefined,
    imageUrl: r.imageUrl ?? undefined,
    artist: r.artist ?? undefined,
    featured: r.featured,
  };
}

const SELECT = {
  id: true, slug: true, source: true, externalId: true, title: true, description: true,
  category: true, venue: true, city: true, district: true, startsAt: true, endsAt: true,
  priceMin: true, priceMax: true, isFree: true, ticketUrl: true, imageUrl: true,
  artist: true, featured: true,
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
  for (const e of events) {
    const data = {
      slug: buildSlug(e),
      title: e.title,
      description: e.description ?? null,
      category: e.category as EventCategory,
      venue: e.venue,
      city: e.city,
      district: e.district ?? null,
      startsAt: e.startsAt,
      endsAt: e.endsAt ?? null,
      priceMin: e.priceMin ?? null,
      priceMax: e.priceMax ?? null,
      isFree: e.isFree,
      ticketUrl: e.ticketUrl ?? null,
      imageUrl: e.imageUrl ?? null,
      artist: e.artist ?? null,
      hidden: false,
      lastScrapedAt: now,
    };
    try {
      await db.event.upsert({
        where: { source_externalId: { source: String(source), externalId: e.externalId } },
        create: { source: String(source), externalId: e.externalId, ...data },
        update: data,
      });
      written++;
    } catch (err) {
      console.warn(
        `[EventCache] ${source} ${e.externalId} yazılamadı:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return written;
}
