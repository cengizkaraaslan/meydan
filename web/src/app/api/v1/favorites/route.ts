import { NextResponse, type NextRequest } from "next/server";
import { db, isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

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

// GET /api/v1/favorites?deviceId=... → kullanıcının favori eventSlug listesi
export async function GET(request: NextRequest) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  const deviceId = request.nextUrl.searchParams.get("deviceId")?.trim();
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId zorunlu" }, { status: 400 });
  }

  if (!isDbConfigured) {
    return NextResponse.json({ data: [] });
  }

  const favorites = await db.favorite.findMany({
    where: { deviceId },
    orderBy: { createdAt: "desc" },
    select: { eventSlug: true },
  });

  return NextResponse.json({ data: favorites.map((f) => f.eventSlug) });
}

interface FavoriteBody {
  deviceId?: string;
  eventSlug?: string;
  on?: boolean;
}

// POST /api/v1/favorites  body {deviceId, eventSlug, on} → on ise upsert, değilse delete
export async function POST(request: NextRequest) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  if (!isDbConfigured) {
    return NextResponse.json({ ok: false });
  }

  let body: FavoriteBody;
  try {
    body = (await request.json()) as FavoriteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const deviceId = body.deviceId?.trim();
  const eventSlug = body.eventSlug?.trim();
  if (!deviceId || !eventSlug) {
    return NextResponse.json({ error: "deviceId ve eventSlug zorunlu" }, { status: 400 });
  }

  if (body.on) {
    await db.favorite.upsert({
      where: { deviceId_eventSlug: { deviceId, eventSlug } },
      create: { deviceId, eventSlug },
      update: {},
    });
  } else {
    await db.favorite.deleteMany({ where: { deviceId, eventSlug } });
  }

  return NextResponse.json({ ok: true, on: Boolean(body.on) });
}
