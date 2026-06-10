import { NextResponse, type NextRequest } from "next/server";
import {
  listEventPhotos,
  addEventPhoto,
  deleteEventPhoto,
  type PhotoMutReason,
} from "@/lib/event-photos-store";

export const dynamic = "force-dynamic";

function statusForReason(reason: PhotoMutReason | undefined): number {
  return reason === "forbidden" ? 403 : 404;
}

// GET /api/v1/mobile/event-photos?eventSlug=...
export async function GET(request: NextRequest) {
  const eventSlug = request.nextUrl.searchParams.get("eventSlug")?.trim();
  if (!eventSlug) return NextResponse.json({ error: "eventSlug zorunlu" }, { status: 400 });
  const data = await listEventPhotos(eventSlug);
  return NextResponse.json({ ok: true, data });
}

// POST /api/v1/mobile/event-photos  body {eventSlug, deviceId, url}
export async function POST(request: NextRequest) {
  let body: { eventSlug?: string; deviceId?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const eventSlug = body.eventSlug?.trim();
  const deviceId = body.deviceId?.trim();
  const url = body.url?.trim();
  if (!eventSlug || !deviceId || !url) {
    return NextResponse.json({ error: "eventSlug/deviceId/url zorunlu" }, { status: 400 });
  }
  const photo = await addEventPhoto({ eventSlug, deviceId, url });
  return NextResponse.json({ ok: true, photo });
}

// DELETE /api/v1/mobile/event-photos  body {id, deviceId, isAdmin?}
export async function DELETE(request: NextRequest) {
  let body: { id?: string; deviceId?: string; isAdmin?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = body.id?.trim();
  const deviceId = body.deviceId?.trim();
  if (!id || !deviceId) return NextResponse.json({ error: "id/deviceId zorunlu" }, { status: 400 });
  const result = await deleteEventPhoto({ id, deviceId, isAdmin: body.isAdmin === true });
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: statusForReason(result.reason) });
  }
  return NextResponse.json({ ok: true });
}
