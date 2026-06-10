import { NextResponse, type NextRequest } from "next/server";
import { getEvents } from "@/lib/events";
import type { EventCategory, EventSource } from "@/lib/types";

export const revalidate = 300;

// Kategoriye göre Unsplash fallback foto id'leri — etkinliğin kendi görseli yoksa
// image_url asla null dönmesin diye burayı kullanırız.
const FALLBACK: Record<string, string> = {
  KONSER: "1470225620780-dba8ba36b745",
  FESTIVAL: "1533174072545-7a4b6ad7a6c3",
  TIYATRO: "1503095396549-807759245b35",
  STANDUP: "1585699324551-f6c309eedeca",
  SPOR: "1461896836934-ffe607ba8211",
  SERGI: "1531058020387-3be344556be6",
  ATOLYE: "1556761175-5973dc0f32e7",
  COCUK: "1503454537195-1dcabb73ffb9",
  FUAR: "1540575467063-178a50c2df87",
  DIGER: "1492684223066-81342ee5ff30",
};

function fallbackImage(c: string): string {
  return `https://images.unsplash.com/photo-${FALLBACK[c] ?? FALLBACK.DIGER}?auto=format&fit=crop&w=900&q=70`;
}

/**
 * Görsel çözünürlüğünü yükseltir (#8/#15). Unsplash url'lerinde w/q parametrelerini
 * yüksek değere set eder; diğer bilinen CDN'lerde (Biletix, Bubilet) bilinen küçük
 * boyut ekleri varsa büyüğüyle değiştirir. Tanımadığı url'leri aynen döndürür.
 */
function hiRes(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    const host = u.hostname;
    if (host.includes("unsplash.com")) {
      u.searchParams.set("auto", "format");
      u.searchParams.set("fit", "crop");
      u.searchParams.set("w", "1600");
      u.searchParams.set("q", "85");
      return u.toString();
    }
    // Biletix/Bubilet vb. boyut ekli dosya adları: _small/_thumb/_120x... → büyük
    return url
      .replace(/_(small|thumb|thumbnail|mini)\b/gi, "_large")
      .replace(/\/(thumb|small|mini)\//gi, "/large/");
  } catch {
    return url;
  }
}

// Kullanıcı oluşturduğu (source:"USER"/"MANUAL") etkinliklerde DB'den gelebilen
// sosyal/web alanları. EventListItem tipinde tanımlı değiller → opsiyonel okuyup
// yoksa null döneriz (scraped etkinliklerde her zaman null).
interface EventSocial {
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  creatorName?: string | null;
}

function social(e: unknown): {
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  creator_name: string | null;
} {
  const s = e as EventSocial;
  return {
    website: s.website ?? null,
    instagram: s.instagram ?? null,
    facebook: s.facebook ?? null,
    tiktok: s.tiktok ?? null,
    creator_name: s.creatorName ?? null,
  };
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const apiKey = request.headers.get("x-api-key") ?? sp.get("api_key");
  if (process.env.NODE_ENV === "production" && !apiKey) {
    return NextResponse.json(
      { error: "Missing API key. Send 'X-Api-Key' header or 'api_key' query param." },
      { status: 401 },
    );
  }

  const page = Math.max(1, Number(sp.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("page_size") ?? "20")));

  const result = await getEvents({
    city: sp.get("city") ?? undefined,
    country: sp.get("country") ?? undefined,
    category: (sp.get("category") as EventCategory) ?? undefined,
    source: (sp.get("source") as EventSource) ?? undefined,
    freeOnly: sp.get("free") === "true" || sp.get("free") === "1",
    search: sp.get("q") ?? undefined,
    from: sp.get("from") ? new Date(sp.get("from")!) : undefined,
    to: sp.get("to") ? new Date(sp.get("to")!) : undefined,
    page,
    pageSize,
  });

  return NextResponse.json(
    {
      data: result.events.map((e) => ({
        id: e.id,
        slug: e.slug,
        source: e.source,
        title: e.title,
        description: e.description,
        category: e.category,
        venue: e.venue,
        city: e.city,
        country: e.country ?? null,
        organizer: e.organizer ?? null,
        // Düzenleyen bir kullanıcıysa profil kimliği (mobil /kisi/<id>); scraped'lerde null.
        organizer_id: e.organizerId ?? null,
        starts_at: e.startsAt.toISOString(),
        ends_at: e.endsAt?.toISOString() ?? null,
        price_min: e.priceMin ?? null,
        price_max: e.priceMax ?? null,
        is_free: e.isFree,
        ticket_url: e.ticketUrl ?? null,
        image_url: hiRes(e.imageUrl ?? fallbackImage(e.category)),
        artist: e.artist ?? null,
        ...social(e),
      })),
      meta: {
        total: result.total,
        page: result.page,
        page_size: result.pageSize,
        total_pages: result.totalPages,
      },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    },
  );
}
