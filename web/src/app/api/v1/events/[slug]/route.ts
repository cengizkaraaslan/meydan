import { NextResponse, type NextRequest } from "next/server";
import { getEventBySlug } from "@/lib/events";

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
 * yüksek değere set eder; diğer bilinen CDN'lerde bilinen küçük boyut ekleri varsa
 * büyüğüyle değiştirir. Tanımadığı url'leri aynen döndürür.
 */
function hiRes(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.hostname.includes("unsplash.com")) {
      u.searchParams.set("auto", "format");
      u.searchParams.set("fit", "crop");
      u.searchParams.set("w", "1600");
      u.searchParams.set("q", "85");
      return u.toString();
    }
    return url
      .replace(/_(small|thumb|thumbnail|mini)\b/gi, "_large")
      .replace(/\/(thumb|small|mini)\//gi, "/large/");
  } catch {
    return url;
  }
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const event = await getEventBySlug(slug);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json({
    data: {
      id: event.id,
      slug: event.slug,
      source: event.source,
      title: event.title,
      description: event.description,
      category: event.category,
      venue: event.venue,
      city: event.city,
      starts_at: event.startsAt.toISOString(),
      ends_at: event.endsAt?.toISOString() ?? null,
      price_min: event.priceMin ?? null,
      price_max: event.priceMax ?? null,
      is_free: event.isFree,
      ticket_url: event.ticketUrl ?? null,
      image_url: hiRes(event.imageUrl ?? fallbackImage(event.category)),
      artist: event.artist ?? null,
      attendee_count: event.attendeeCount ?? 0,
      comment_count: event.commentCount ?? 0,
    },
  });
}
