import "server-only";
import { db, isDbConfigured } from "../db";
import { slugify } from "../utils";
import type { PlaceFilters, PlaceListItem, PlaceType, ScrapedPlace } from "../types";

/**
 * Gezilecek yer / müze kalıcı deposu (Neon Postgres) — EventCache'in Place karşılığı.
 * Yorum/story/foto AYNEN slug-bazlı event uçlarından gelir; bu yüzden burada sosyal
 * tablo yok, sadece Place upsert + okuma.
 */

/** (source, externalId) için kararlı, çakışmasız slug. "yer-" öneki ZORUNLU
 *  (Event slug çakışmasını ve bildirim deep-link ayrımını çözer). */
function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36).slice(0, 7);
}

export function buildPlaceSlug(p: { source: string; externalId: string; name: string }): string {
  const base = slugify(p.name) || "yer";
  return `yer-${base}-${shortHash(`${p.source}|${p.externalId}`)}`;
}

const SELECT = {
  id: true, slug: true, source: true, externalId: true, name: true, type: true,
  city: true, district: true, address: true, description: true, imageUrl: true,
  openTime: true, closeTime: true, website: true, phone: true, featured: true,
} as const;

interface PlaceRow {
  id: string; slug: string; source: string; externalId: string; name: string; type: string;
  city: string; district: string | null; address: string | null; description: string | null;
  imageUrl: string | null; openTime: string | null; closeTime: string | null;
  website: string | null; phone: string | null; featured: boolean;
}

function rowToItem(r: PlaceRow): PlaceListItem {
  return {
    id: r.id,
    slug: r.slug,
    source: r.source,
    externalId: r.externalId,
    name: r.name,
    type: r.type as PlaceType,
    city: r.city,
    district: r.district ?? undefined,
    address: r.address ?? undefined,
    description: r.description ?? undefined,
    imageUrl: r.imageUrl ?? undefined,
    openTime: r.openTime ?? undefined,
    closeTime: r.closeTime ?? undefined,
    website: r.website ?? undefined,
    phone: r.phone ?? undefined,
    featured: r.featured,
  };
}

/** Türkçe karakter katlama (events.foldTr ile aynı). */
function foldTr(s: string): string {
  return s
    .replace(/İ/g, "i").replace(/I/g, "i").replace(/ı/g, "i")
    .replace(/ş/g, "s").replace(/Ş/g, "s")
    .replace(/ğ/g, "g").replace(/Ğ/g, "g")
    .replace(/ü/g, "u").replace(/Ü/g, "u")
    .replace(/ö/g, "o").replace(/Ö/g, "o")
    .replace(/ç/g, "c").replace(/Ç/g, "c")
    .toLowerCase()
    .trim();
}

export interface SetPlacesResult {
  written: number;
  created: number;
  updated: number;
}

/**
 * Bir kaynağın yerlerini Place tablosuna yazar (upsert: source+externalId tekil).
 * Yeni müze tespiti: upsert öncesi mevcut externalId set'i ile create/update ayrılır.
 */
export async function setPlacesForSource(
  source: string,
  places: ScrapedPlace[],
): Promise<SetPlacesResult> {
  if (!isDbConfigured || places.length === 0) return { written: 0, created: 0, updated: 0 };
  const now = new Date();

  // Yeni-tespit için mevcut externalId'ler.
  let existing = new Set<string>();
  try {
    const rows = await db.place.findMany({ where: { source }, select: { externalId: true } });
    existing = new Set(rows.map((r: { externalId: string }) => r.externalId));
  } catch {
    /* boş set ile devam — sayım yaklaşık olur */
  }

  const items = places.map((p) => {
    const createData = {
      slug: buildPlaceSlug(p),
      name: p.name,
      type: p.type,
      distId: p.distId ?? null,
      city: p.city,
      district: p.district ?? null,
      address: p.address ?? null,
      description: p.description ?? null,
      imageUrl: p.imageUrl ?? null,
      openTime: p.openTime ?? null,
      closeTime: p.closeTime ?? null,
      website: p.website ?? null,
      phone: p.phone ?? null,
      lastScrapedAt: now,
    };
    // UPDATE: zenginleştirme alanları (görsel/saat/adres/açıklama…) YALNIZ bu run'da
    // doluysa yazılır. Böylece bütçe-limitli (liste-only) bir cron run'ı önceki gerçek
    // görseli/saati NULL'a EZMEZ. Ad/şehir/tip/slug hep güncellenir.
    const updateData = {
      slug: createData.slug,
      name: p.name,
      type: p.type,
      city: p.city,
      lastScrapedAt: now,
      ...(p.distId ? { distId: p.distId } : {}),
      ...(p.district ? { district: p.district } : {}),
      ...(p.address ? { address: p.address } : {}),
      ...(p.description ? { description: p.description } : {}),
      ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}),
      ...(p.openTime ? { openTime: p.openTime } : {}),
      ...(p.closeTime ? { closeTime: p.closeTime } : {}),
      ...(p.website ? { website: p.website } : {}),
      ...(p.phone ? { phone: p.phone } : {}),
    };
    return { externalId: p.externalId, createData, updateData };
  });

  const upsertOne = (it: (typeof items)[number]) =>
    db.place.upsert({
      where: { source_externalId: { source, externalId: it.externalId } },
      create: { source, externalId: it.externalId, ...it.createData },
      update: it.updateData,
    });

  let written = 0;
  const CHUNK = 50;
  try {
    for (let i = 0; i < items.length; i += CHUNK) {
      const chunk = items.slice(i, i + CHUNK);
      await db.$transaction(chunk.map(upsertOne));
      written += chunk.length;
    }
  } catch (err) {
    console.warn(
      `[PlaceCache] ${source} batch yazımı düştü, tek tek deneniyor:`,
      err instanceof Error ? err.message : err,
    );
    written = 0;
    for (const it of items) {
      try {
        await upsertOne(it);
        written++;
      } catch {
        /* tek kayıt hatasını yut */
      }
    }
  }

  const created = items.filter((it) => !existing.has(it.externalId)).length;
  return { written, created, updated: Math.max(0, written - created) };
}

export async function getAllPlaces(): Promise<PlaceListItem[]> {
  if (!isDbConfigured) return [];
  try {
    const rows = await db.place.findMany({
      where: { hidden: false },
      orderBy: [{ featured: "desc" }, { name: "asc" }],
      take: 5000,
      select: SELECT,
    });
    return (rows as PlaceRow[]).map(rowToItem);
  } catch (err) {
    console.warn("[PlaceCache] getAll hatası:", err instanceof Error ? err.message : err);
    return [];
  }
}

export async function getPlaceBySlug(slug: string): Promise<PlaceListItem | null> {
  if (!isDbConfigured) return null;
  try {
    const row = await db.place.findFirst({ where: { slug, hidden: false }, select: SELECT });
    return row ? rowToItem(row as PlaceRow) : null;
  } catch {
    return null;
  }
}

export async function getFeaturedPlaces(limit = 6, city?: string): Promise<PlaceListItem[]> {
  if (!isDbConfigured) return [];
  try {
    // Önce görselli + (varsa) şehir eşleşen yerler — anasayfa güzel görünsün.
    const rows = await db.place.findMany({
      where: {
        hidden: false,
        imageUrl: { not: null },
        ...(city ? { city: { equals: city, mode: "insensitive" as const } } : {}),
      },
      orderBy: [{ featured: "desc" }, { name: "asc" }],
      take: limit,
      select: SELECT,
    });
    if (rows.length >= limit || !city) return (rows as PlaceRow[]).map(rowToItem);
    // Şehirde yeterli yoksa ülke geneliyle tamamla.
    const more = await db.place.findMany({
      where: { hidden: false, imageUrl: { not: null }, NOT: { city: { equals: city, mode: "insensitive" as const } } },
      orderBy: [{ featured: "desc" }, { name: "asc" }],
      take: limit - rows.length,
      select: SELECT,
    });
    return ([...rows, ...more] as PlaceRow[]).map(rowToItem);
  } catch {
    return [];
  }
}

/** Filtreli, sayfalı yer listesi (DB-side filtre + JS dilim). */
export async function getPlaces(filters: PlaceFilters = {}): Promise<{
  places: PlaceListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const pageSize = filters.pageSize ?? 12;
  const rawPage = filters.page ?? 1;
  const all = await getAllPlaces();

  let out = all;
  if (filters.city) {
    const c = foldTr(filters.city);
    out = out.filter((p) => foldTr(p.city) === c);
  }
  if (filters.type) out = out.filter((p) => p.type === filters.type);
  if (filters.search) {
    const q = foldTr(filters.search);
    out = out.filter(
      (p) => foldTr(p.name).includes(q) || foldTr(p.city).includes(q) || (p.address ? foldTr(p.address).includes(q) : false),
    );
  }

  const total = out.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, rawPage), totalPages);
  const start = (page - 1) * pageSize;
  return { places: out.slice(start, start + pageSize), total, page, pageSize, totalPages };
}
