import { NextResponse, type NextRequest } from "next/server";
import { db, isDbConfigured } from "@/lib/db";
import type { EventCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES: readonly EventCategory[] = [
  "KONSER",
  "FESTIVAL",
  "TIYATRO",
  "STANDUP",
  "SPOR",
  "SERGI",
  "ATOLYE",
  "COCUK",
  "DIGER",
];

function normalizeCategory(value: unknown): EventCategory {
  const up = String(value ?? "").toUpperCase();
  return (VALID_CATEGORIES as readonly string[]).includes(up)
    ? (up as EventCategory)
    : "DIGER";
}

/**
 * Başlıktan URL-dostu slug üretir: Türkçe karakterleri katlar, alfanümerik dışını
 * tireye çevirir, sonuna kısa rastgele sonek ekler (çakışma olmasın diye).
 */
function slugify(title: string): string {
  const base = title
    .replace(/İ/g, "i").replace(/I/g, "i").replace(/ı/g, "i")
    .replace(/ş/g, "s").replace(/Ş/g, "s")
    .replace(/ğ/g, "g").replace(/Ğ/g, "g")
    .replace(/ü/g, "u").replace(/Ü/g, "u")
    .replace(/ö/g, "o").replace(/Ö/g, "o")
    .replace(/ç/g, "c").replace(/Ç/g, "c")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "etkinlik";
  const rand = Math.random().toString(36).slice(2, 8);
  return `${base}-${rand}`;
}

function requireApiKey(request: NextRequest): NextResponse | null {
  const apiKey = request.headers.get("x-api-key") ?? request.nextUrl.searchParams.get("api_key");
  if (process.env.NODE_ENV === "production" && !apiKey) {
    return NextResponse.json(
      { error: "Missing API key. Send 'X-Api-Key' header or 'api_key' query param." },
      { status: 401 },
    );
  }
  return null;
}

interface CreateEventBody {
  title?: string;
  category?: string;
  venue?: string;
  city?: string;
  startsAt?: string;
  endsAt?: string;
  description?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  phone?: string;
  creatorEmail?: string;
  creatorName?: string;
  imageUrl?: string;
}

export async function POST(request: NextRequest) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  if (!isDbConfigured) {
    return NextResponse.json({ ok: false });
  }

  let body: CreateEventBody;
  try {
    body = (await request.json()) as CreateEventBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = body.title?.trim();
  const venue = body.venue?.trim();
  const city = body.city?.trim();
  const startsAtRaw = body.startsAt?.trim();
  if (!title || !venue || !city || !startsAtRaw) {
    return NextResponse.json(
      { error: "title, venue, city ve startsAt zorunlu" },
      { status: 400 },
    );
  }

  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "startsAt geçerli ISO tarih olmalı" }, { status: 400 });
  }

  // Bitiş tarihi opsiyonel: geçerli ve başlangıçtan SONRA ise sakla, değilse yok say.
  const endsAtRaw = body.endsAt?.trim();
  let endsAt: Date | null = null;
  if (endsAtRaw) {
    const d = new Date(endsAtRaw);
    if (!Number.isNaN(d.getTime()) && d.getTime() > startsAt.getTime()) endsAt = d;
  }

  const slug = slugify(title);

  await db.event.create({
    data: {
      source: "USER",
      externalId: slug,
      slug,
      title,
      description: body.description?.trim() || null,
      category: normalizeCategory(body.category),
      venue,
      city,
      startsAt,
      endsAt,
      imageUrl: body.imageUrl?.trim() || null,
      website: body.website?.trim() || null,
      instagram: body.instagram?.trim() || null,
      facebook: body.facebook?.trim() || null,
      tiktok: body.tiktok?.trim() || null,
      phone: body.phone?.trim() || null,
      creatorEmail: body.creatorEmail?.trim() || null,
      creatorName: body.creatorName?.trim() || null,
      // Düzenleyen = oluşturanın adı (varsa) — etkinlik detayında gösterilir.
      organizer: body.creatorName?.trim() || null,
    },
  });

  return NextResponse.json({ ok: true, slug });
}
