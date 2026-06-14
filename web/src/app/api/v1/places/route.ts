import { NextResponse, type NextRequest } from "next/server";
import { getPlaces } from "@/lib/places";
import type { PlaceType } from "@/lib/types";

export const revalidate = 300;

const MUSEUM_FALLBACK = "https://images.unsplash.com/photo-1565060169187-5284a3673b75?auto=format&fit=crop&w=900&q=70";

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

  const result = await getPlaces({
    city: sp.get("city") ?? undefined,
    type: (sp.get("type") as PlaceType) ?? undefined,
    search: sp.get("q") ?? undefined,
    page,
    pageSize,
  });

  return NextResponse.json(
    {
      data: result.places.map((p) => ({
        id: p.id,
        slug: p.slug,
        source: p.source,
        name: p.name,
        type: p.type,
        description: p.description ?? null,
        city: p.city,
        district: p.district ?? null,
        address: p.address ?? null,
        image_url: p.imageUrl ?? MUSEUM_FALLBACK,
        open_time: p.openTime ?? null,
        close_time: p.closeTime ?? null,
        website: p.website ?? null,
        phone: p.phone ?? null,
        lat: p.lat ?? null,
        lng: p.lng ?? null,
        fee: p.fee ?? null, // "PAID" | "FREE" | null=bilinmiyor
        featured: p.featured,
      })),
      meta: {
        total: result.total,
        page: result.page,
        page_size: result.pageSize,
        total_pages: result.totalPages,
      },
    },
    {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    },
  );
}
