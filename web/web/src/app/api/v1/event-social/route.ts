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
    return NextResponse.json({ data: { attendeeCount: 0, comments: [] } });
  }

  const [attendeeCount, comments] = await Promise.all([
    db.eventAttendance.count({ where: { eventSlug } }),
    db.eventCommentMobile.findMany({
      where: { eventSlug },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    data: {
      attendeeCount,
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
  action?: "join" | "leave" | "comment";
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
    case "join": {
      await db.eventAttendance.upsert({
        where: { deviceId_eventSlug: { deviceId, eventSlug } },
        create: { deviceId, eventSlug },
        update: {},
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
        { error: "action 'join' | 'leave' | 'comment' olmalı" },
        { status: 400 },
      );
  }

  return NextResponse.json({ ok: true });
}
