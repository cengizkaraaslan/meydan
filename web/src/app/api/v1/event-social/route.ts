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

// GET /api/v1/event-social?eventSlug=... → {attendeeCount, comments[]}
export async function GET(request: NextRequest) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  const eventSlug = request.nextUrl.searchParams.get("eventSlug")?.trim();
  if (!eventSlug) {
    return NextResponse.json({ error: "eventSlug zorunlu" }, { status: 400 });
  }

  if (!isDbConfigured) {
    return NextResponse.json({ data: { attendeeCount: 0, rsvp: { going: 0, maybe: 0, interested: 0 }, comments: [] } });
  }

  const [grouped, comments] = await Promise.all([
    db.eventAttendance.groupBy({ by: ["status"], where: { eventSlug }, _count: { _all: true } }),
    db.eventCommentMobile.findMany({
      where: { eventSlug },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Kategori bazlı GERÇEK sayılar. Bilinmeyen/eski status → "going".
  const rsvp = { going: 0, maybe: 0, interested: 0 };
  for (const g of grouped) {
    const key = g.status === "maybe" || g.status === "interested" ? g.status : "going";
    rsvp[key] += g._count._all;
  }

  return NextResponse.json({
    data: {
      attendeeCount: rsvp.going, // geriye dönük: "katılacak" sayısı
      rsvp,
      comments: comments.map((c) => ({
        id: c.id,
        device_id: c.deviceId,
        author_name: c.authorName,
        text: c.text,
        created_at: c.createdAt.toISOString(),
      })),
    },
  });
}

interface SocialBody {
  action?: "join" | "leave" | "comment" | "going" | "maybe" | "interested";
  deviceId?: string;
  eventSlug?: string;
  authorName?: string;
  text?: string;
}

// POST /api/v1/event-social  body {action, deviceId, eventSlug, authorName?, text?}
export async function POST(request: NextRequest) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  if (!isDbConfigured) {
    return NextResponse.json({ ok: false });
  }

  let body: SocialBody;
  try {
    body = (await request.json()) as SocialBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  const deviceId = body.deviceId?.trim();
  const eventSlug = body.eventSlug?.trim();
  if (!deviceId || !eventSlug) {
    return NextResponse.json({ error: "deviceId ve eventSlug zorunlu" }, { status: 400 });
  }

  switch (action) {
    case "join": // eski sürüm uyumluluğu → "going"
    case "going":
    case "maybe":
    case "interested": {
      const status = action === "join" ? "going" : action;
      await db.eventAttendance.upsert({
        where: { deviceId_eventSlug: { deviceId, eventSlug } },
        create: { deviceId, eventSlug, status },
        update: { status },
      });
      break;
    }
    case "leave": {
      await db.eventAttendance.deleteMany({ where: { deviceId, eventSlug } });
      break;
    }
    case "comment": {
      const text = body.text?.trim();
      if (!text) {
        return NextResponse.json({ error: "text zorunlu" }, { status: 400 });
      }
      const authorName = body.authorName?.trim() || "Misafir";
      await db.eventCommentMobile.create({
        data: { eventSlug, deviceId, authorName, text },
      });
      break;
    }
    default:
      return NextResponse.json(
        { error: "action 'going'|'maybe'|'interested'|'leave'|'comment' olmalı" },
        { status: 400 },
      );
  }

  return NextResponse.json({ ok: true });
}
