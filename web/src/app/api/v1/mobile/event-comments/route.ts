import { NextResponse, type NextRequest } from "next/server";
import {
  listEventComments,
  addEventComment,
  editEventComment,
  deleteEventComment,
  type CommentMutReason,
} from "@/lib/event-comments-store";
import { extractMentionEmails, notifyEmails, preview } from "@/lib/mention-notify";

export const dynamic = "force-dynamic";

function statusForReason(reason: CommentMutReason | undefined): number {
  switch (reason) {
    case "forbidden":
      return 403;
    case "expired":
      return 409;
    case "notfound":
    default:
      return 404;
  }
}

// GET /api/v1/mobile/event-comments?eventSlug=...
export async function GET(request: NextRequest) {
  const eventSlug = request.nextUrl.searchParams.get("eventSlug")?.trim();
  if (!eventSlug) return NextResponse.json({ error: "eventSlug zorunlu" }, { status: 400 });
  const data = await listEventComments(eventSlug);
  return NextResponse.json({ ok: true, data });
}

// POST /api/v1/mobile/event-comments  body {eventSlug, deviceId, authorName, avatar?, text}
export async function POST(request: NextRequest) {
  let body: { eventSlug?: string; deviceId?: string; authorName?: string; avatar?: string | null; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const eventSlug = body.eventSlug?.trim();
  const deviceId = body.deviceId?.trim();
  const text = body.text?.trim();
  if (!eventSlug || !deviceId || !text) {
    return NextResponse.json({ error: "eventSlug/deviceId/text zorunlu" }, { status: 400 });
  }
  const authorName = body.authorName?.trim() || "Biri";
  const comment = await addEventComment({ eventSlug, deviceId, authorName, avatar: body.avatar ?? null, text });

  // @mention → bahsedilen email'lere bildirim (mobil + web). Tıklayınca etkinliğe gider.
  const emails = extractMentionEmails(text);
  if (emails.length) {
    void notifyEmails(emails, {
      title: `${authorName} bir yorumda senden bahsetti`,
      body: preview(text),
      data: { type: "comment", eventId: eventSlug, url: `/etkinlik/${eventSlug}` },
      inApp: { type: "comment", actorId: deviceId, actorName: authorName },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, comment });
}

// PATCH /api/v1/mobile/event-comments  body {id, deviceId, text}
export async function PATCH(request: NextRequest) {
  let body: { id?: string; deviceId?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = body.id?.trim();
  const deviceId = body.deviceId?.trim();
  const text = body.text?.trim();
  if (!id || !deviceId || !text) {
    return NextResponse.json({ error: "id/deviceId/text zorunlu" }, { status: 400 });
  }
  const result = await editEventComment({ id, deviceId, text });
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: statusForReason(result.reason) });
  }
  return NextResponse.json({ ok: true, comment: result.comment });
}

// DELETE /api/v1/mobile/event-comments  body {id, deviceId, isAdmin?}
export async function DELETE(request: NextRequest) {
  let body: { id?: string; deviceId?: string; isAdmin?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = body.id?.trim();
  const deviceId = body.deviceId?.trim();
  if (!id || !deviceId) {
    return NextResponse.json({ error: "id/deviceId zorunlu" }, { status: 400 });
  }
  const result = await deleteEventComment({ id, deviceId, isAdmin: body.isAdmin === true });
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: statusForReason(result.reason) });
  }
  return NextResponse.json({ ok: true });
}
