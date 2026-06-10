import "server-only";
import { MOCK_EVENTS } from "./mock-data";
import { FESTIVALL_EVENTS } from "./festivall-events";
import { db, useMockData, isDbConfigured } from "./db";
import { getAllCachedEvents, getCachedEventBySlug } from "./scrapers/EventCache";
import type { EventCategory, EventFilters, EventListItem } from "./types";

/** Build-time snapshot + mock data — kalıcı, hızlı, KV gerektirmez */
const STATIC_EVENTS: EventListItem[] = [...FESTIVALL_EVENTS, ...MOCK_EVENTS];

/** Prisma Event row'unun manuel etkinlik merge'i için ihtiyaç duyduğumuz alanları. */
interface ManualEventRow {
  id: string;
  slug: string;
  externalId: string;
  title: string;
  description: string | null;
  category: string;
  venue: string;
  city: string;
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
  creatorEmail: string | null;
  creatorName: string | null;
}

/**
 * Manuel/USER etkinlikte "Düzenleyen" kimliği. creatorEmail oluşturanın profil
 * anahtarıdır (mobil /kisi/<id>). Gizli (creatorHidden) etkinlikte mobil tarafı
 * creatorName'i BOŞ gönderir → ne organizer ismini ne de kimliği yayımlarız.
 */
function creatorIdentity(r: { creatorEmail: string | null; creatorName: string | null }): {
  organizer?: string;
  organizerId?: string;
} {
  const name = r.creatorName?.trim();
  if (!name) return {}; // gizli/anonim → boş bırak
  return { organizer: name, organizerId: r.creatorEmail?.trim() || undefined };
}

function manualRowToListItem(r: ManualEventRow): EventListItem {
  const creator = creatorIdentity(r);
  return {
    id: r.id,
    slug: r.slug,
    source: "MANUAL",
    externalId: r.externalId,
    title: r.title,
    description: r.description ?? undefined,
    category: r.category as EventCategory,
    venue: r.venue,
    city: r.city,
    district: r.district ?? undefined,
    // Manuel etkinlikte düzenleyen = oluşturan kişi (gizli değilse). r.organizer
    // genelde boş; creatorName varsa onu organizer olarak öne çıkarırız.
    organizer: creator.organizer ?? r.organizer ?? undefined,
    organizerId: creator.organizerId,
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

const MANUAL_SELECT = {
  id: true,
  slug: true,
  externalId: true,
  title: true,
  description: true,
  category: true,
  venue: true,
  city: true,
  district: true,
  organizer: true,
  startsAt: true,
  endsAt: true,
  priceMin: true,
  priceMax: true,
  isFree: true,
  ticketUrl: true,
  imageUrl: true,
  artist: true,
  featured: true,
  creatorEmail: true,
  creatorName: true,
} as const;

/**
 * Mock modda bile, DB yapılandırılmışsa kullanıcıların oluşturduğu (source:"MANUAL",
 * hidden:false) etkinlikleri çek — herkes görsün. Hata olursa sessizce boş dön.
 */
async function getManualEvents(): Promise<EventListItem[]> {
  if (!isDbConfigured) return [];
  try {
    const rows = await db.event.findMany({
      where: { source: "MANUAL", hidden: false },
      orderBy: { startsAt: "asc" },
      select: MANUAL_SELECT,
    });
    return (rows as ManualEventRow[]).map(manualRowToListItem);
  } catch {
    return [];
  }
}

async function getManualEventBySlug(slug: string): Promise<EventListItem | null> {
  if (!isDbConfigured) return null;
  try {
    const row = await db.event.findFirst({
      where: { slug, source: "MANUAL", hidden: false },
      select: MANUAL_SELECT,
    });
    return row ? manualRowToListItem(row as ManualEventRow) : null;
  } catch {
    return null;
  }
}

async function mergeMockAndCache(): Promise<EventListItem[]> {
  // Production'da Suspense timeout'a düşmemek için scraper'ları sayfada çalıştırma;
  // FESTIVALL_EVENTS build-time snapshot + cron'la canlanan EventCache kullan.
  // Ek olarak: DB'deki kullanıcı oluşturmuş MANUAL etkinlikleri de katarız ki
  // herkese görünür olsunlar (hata olursa getManualEvents sessizce [] döner).
  const manual = await getManualEvents();
  try {
    const cached = await Promise.race<EventListItem[]>([
      getAllCachedEvents(),
      new Promise<EventListItem[]>((resolve) => setTimeout(() => resolve([]), 4000)),
    ]);
    if (cached.length === 0) return [...manual, ...STATIC_EVENTS];
    const cachedKeys = new Set(cached.map((e) => `${e.source}-${e.externalId}`));
    const staticOnly = STATIC_EVENTS.filter(
      (e) => !cachedKeys.has(`${e.source}-${e.externalId}`),
    );
    return [...manual, ...cached, ...staticOnly];
  } catch {
    return [...manual, ...STATIC_EVENTS];
  }
}

export interface EventQueryResult {
  events: EventListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Türkçe karakterleri ASCII'ye katlayıp küçük harfe çevirir.
 * "Eskişehir" ≡ "Eskisehir", "Muğla" ≡ "Mugla", "Çankaya" ≡ "cankaya" eşleşsin diye —
 * kullanıcı şehir/ilçeyi düz harflerle yazsa/linklese de filtre tutsun.
 */
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

function applyFilters(items: EventListItem[], filters: EventFilters): EventListItem[] {
  let out = items;
  if (filters.city) {
    const c = foldTr(filters.city);
    out = out.filter((e) => foldTr(e.city) === c);
  }
  if (filters.country) {
    const c = foldTr(filters.country);
    out = out.filter((e) => (e.country ? foldTr(e.country) === c : false));
  }
  if (filters.district) {
    const q = foldTr(filters.district);
    out = out.filter(
      (e) =>
        (e.district ? foldTr(e.district) === q : false) ||
        foldTr(e.venue).includes(q),
    );
  }
  if (filters.category) {
    out = out.filter((e) => e.category === filters.category);
  }
  if (filters.source) {
    out = out.filter((e) => e.source === filters.source);
  }
  if (filters.freeOnly) {
    out = out.filter((e) => e.isFree);
  }
  if (filters.from) {
    out = out.filter((e) => e.startsAt >= filters.from!);
  }
  if (filters.to) {
    out = out.filter((e) => e.startsAt <= filters.to!);
  }
  if (filters.search) {
    const q = foldTr(filters.search);
    out = out.filter(
      (e) =>
        foldTr(e.title).includes(q) ||
        (e.artist ? foldTr(e.artist).includes(q) : false) ||
        foldTr(e.venue).includes(q),
    );
  }
  return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export async function getEvents(filters: EventFilters = {}): Promise<EventQueryResult> {
  const rawPage = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 12;

  if (useMockData) {
    const filtered = applyFilters(await mergeMockAndCache(), filters);
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    // İstenen sayfa toplam sayfadan büyükse son sayfaya kıstır — eski ?page=N linki
    // ya da filtre değişimi sonrası boş sayfada kalınmasın.
    const page = Math.min(Math.max(1, rawPage), totalPages);
    const start = (page - 1) * pageSize;
    return {
      events: filtered.slice(start, start + pageSize),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  // Birden fazla OR grubu (ilçe + arama) çakışmasın diye AND dizisine topluyoruz.
  const and: Record<string, unknown>[] = [];
  if (filters.district) {
    const d = filters.district;
    and.push({
      OR: [
        { district: { equals: d, mode: "insensitive" as const } },
        { venue: { contains: d, mode: "insensitive" as const } },
      ],
    });
  }
  if (filters.search) {
    and.push({
      OR: [
        { title: { contains: filters.search, mode: "insensitive" as const } },
        { artist: { contains: filters.search, mode: "insensitive" as const } },
        { venue: { contains: filters.search, mode: "insensitive" as const } },
      ],
    });
  }

  const where = {
    hidden: false,
    // case-insensitive: "İstanbul" / "istanbul" / "İSTANBUL" hepsi eşleşsin
    ...(filters.city && { city: { equals: filters.city, mode: "insensitive" as const } }),
    ...(filters.country && { country: { equals: filters.country, mode: "insensitive" as const } }),
    ...(filters.category && { category: filters.category }),
    // Cast: yeni üniversite source'ları Prisma şemasına Faz 2 migration'ı ile eklenecek;
    // o zamana dek client tip-checker'ı bypass etmek için cast'liyoruz.
    ...(filters.source && { source: filters.source as never }),
    ...(filters.freeOnly && { isFree: true }),
    ...(filters.from || filters.to
      ? {
          startsAt: {
            ...(filters.from && { gte: filters.from }),
            ...(filters.to && { lte: filters.to }),
          },
        }
      : { startsAt: { gte: new Date() } }),
    ...(and.length && { AND: and }),
  };

  // Kaynaklar-arası dedup: aynı etkinlik (başlık+gün+şehir) birden çok kaynaktan
  // (Biletix+Ticketmaster+Passo…) gelebilir → tek kayıt göster. Eşleşen pencereyi
  // çekip JS'te tekilleştir, sonra sayfala.
  const allRows = await db.event.findMany({
    where,
    orderBy: { startsAt: "asc" },
    take: 1000,
    include: {
      _count: { select: { attendances: true, comments: true } },
    },
  });
  const normTitle = (s: string) => foldTr(s).replace(/[^a-z0-9]/g, "");
  const score = (x: (typeof allRows)[number]) => (x.imageUrl ? 1 : 0) + (x.ticketUrl ? 1 : 0);
  const byKey = new Map<string, (typeof allRows)[number]>();
  for (const r of allRows) {
    const key = `${normTitle(r.title)}|${r.startsAt.toISOString().slice(0, 10)}|${foldTr(r.city)}`;
    const prev = byKey.get(key);
    if (!prev || score(r) > score(prev)) byKey.set(key, r);
  }
  const deduped = [...byKey.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const total = deduped.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, rawPage), totalPages); // boş sayfada kalma
  const rows = deduped.slice((page - 1) * pageSize, page * pageSize);

  return {
    events: rows.map((r) => {
      const creator = creatorIdentity(r);
      return {
      id: r.id,
      slug: r.slug,
      source: r.source,
      externalId: r.externalId,
      title: r.title,
      description: r.description ?? undefined,
      category: r.category,
      venue: r.venue,
      city: r.city,
      country: r.country ?? undefined,
      // Kullanıcı etkinliğinde düzenleyen = oluşturan (gizli değilse). Scraped'lerde
      // creator boş → r.organizer (kurum/festival metni) kalır, organizerId boş.
      organizer: creator.organizer ?? r.organizer ?? undefined,
      organizerId: creator.organizerId,
      startsAt: r.startsAt,
      endsAt: r.endsAt ?? undefined,
      priceMin: r.priceMin ?? undefined,
      priceMax: r.priceMax ?? undefined,
      isFree: r.isFree,
      ticketUrl: r.ticketUrl ?? undefined,
      imageUrl: r.imageUrl ?? undefined,
      artist: r.artist ?? undefined,
      featured: r.featured,
      attendeeCount: r._count.attendances,
      commentCount: r._count.comments,
      };
    }),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function getEventBySlug(slug: string): Promise<EventListItem | null> {
  if (useMockData) {
    // Önce DB'deki kullanıcı oluşturmuş MANUAL etkinliğe bak, sonra cache/static.
    // SON ÇARE: snapshot/static'te yoksa GERÇEK db.event'e düş — mock modda bile
    // scrape edilmiş etkinlikler (üniversite/Meydan sistem gönderileri) slug ile açılsın
    // (aksi halde detayda "Etkinlik bulunamadı" veriyordu).
    return (
      (await getManualEventBySlug(slug)) ??
      (await getCachedEventBySlug(slug)) ??
      STATIC_EVENTS.find((e) => e.slug === slug) ??
      (isDbConfigured ? await dbEventBySlug(slug) : null)
    );
  }
  return dbEventBySlug(slug);
}

/** Gerçek db.event'ten slug ile etkinlik (EventListItem). Mock-fallback ve normal path ortak. */
async function dbEventBySlug(slug: string): Promise<EventListItem | null> {
  const row = await db.event.findUnique({
    where: { slug },
    include: { _count: { select: { attendances: true, comments: true } } },
  });
  if (!row) return null;
  const creator = creatorIdentity(row);
  return {
    id: row.id,
    slug: row.slug,
    source: row.source,
    externalId: row.externalId,
    title: row.title,
    description: row.description ?? undefined,
    category: row.category,
    venue: row.venue,
    city: row.city,
    organizer: creator.organizer ?? row.organizer ?? undefined,
    organizerId: creator.organizerId,
    startsAt: row.startsAt,
    endsAt: row.endsAt ?? undefined,
    priceMin: row.priceMin ?? undefined,
    priceMax: row.priceMax ?? undefined,
    isFree: row.isFree,
    ticketUrl: row.ticketUrl ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    artist: row.artist ?? undefined,
    featured: row.featured,
    attendeeCount: row._count.attendances,
    commentCount: row._count.comments,
  };
}

/**
 * Etkinlik başlığından "seri" anahtarı üretir: yıl / edisyon / sıra eklerini ayıklayıp
 * Türkçe-katlanmış sade bir anahtar döner. "54. İstanbul Film Festivali 2026" ve
 * "53. İstanbul Film Festivali" aynı seriye düşer.
 */
export function eventSeriesKey(title: string): string {
  let s = ` ${title} `;
  s = s.replace(/\b(19|20)\d{2}\b/g, " "); // yıl: 2026
  s = s.replace(/\bvol\.?\s*\d+/gi, " "); // Vol. 3
  s = s.replace(/#\s*\d+/g, " "); // #5
  s = s.replace(/\b\d{1,3}\s*\.(?=\s)/g, " "); // "54. "
  s = s.replace(/\b\d{1,3}\s*(?:inci|ıncı|uncu|üncü)\b/gi, " "); // 5inci
  s = s.replace(/\s[IVXLC]{1,5}\.?\s*$/i, " "); // sonda roman rakamı: II, III
  return foldTr(s)
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Aynı serinin GEÇMİŞ edisyonları (bugünden önce başlamış), yeni→eski sıralı.
 * Detay sayfasında "Önceki yıllardan" bölümü için. Eşleşme yoksa boş döner.
 */
export async function getPastEditions(event: EventListItem, limit = 4): Promise<EventListItem[]> {
  const key = eventSeriesKey(event.title);
  if (key.length < 4) return [];
  const now = new Date();
  const pool = await mergeMockAndCache();
  return pool
    .filter(
      (e) =>
        e.id !== event.id &&
        e.slug !== event.slug &&
        e.startsAt < now &&
        eventSeriesKey(e.title) === key,
    )
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
    .slice(0, limit);
}

export async function getFeaturedEvents(limit = 6): Promise<EventListItem[]> {
  if (useMockData) {
    return MOCK_EVENTS.filter((e) => e.featured)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .slice(0, limit);
  }
  const rows = await db.event.findMany({
    where: { featured: true, hidden: false, startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    take: limit,
    include: { _count: { select: { attendances: true, comments: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    source: r.source,
    externalId: r.externalId,
    title: r.title,
    description: r.description ?? undefined,
    category: r.category,
    venue: r.venue,
    city: r.city,
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
    attendeeCount: r._count.attendances,
    commentCount: r._count.comments,
  }));
}
