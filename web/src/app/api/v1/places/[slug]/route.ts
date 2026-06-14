import { NextResponse, type NextRequest } from "next/server";
import { getPlaceBySlug } from "@/lib/places";

export const revalidate = 300;

const MUSEUM_FALLBACK = "https://images.unsplash.com/photo-1565060169187-5284a3673b75?auto=format&fit=crop&w=900&q=70";

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const place = await getPlaceBySlug(slug);
  if (!place) {
    return NextResponse.json({ error: "Place not found" }, { status: 404 });
  }
  return NextResponse.json({
    data: {
      id: place.id,
      slug: place.slug,
      source: place.source,
      name: place.name,
      type: place.type,
      description: place.description ?? null,
      city: place.city,
      district: place.district ?? null,
      address: place.address ?? null,
      image_url: place.imageUrl ?? MUSEUM_FALLBACK,
      open_time: place.openTime ?? null,
      close_time: place.closeTime ?? null,
      website: place.website ?? null,
      phone: place.phone ?? null,
      featured: place.featured,
    },
  });
}
