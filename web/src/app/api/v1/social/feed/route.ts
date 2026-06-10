import { NextResponse, type NextRequest } from "next/server";
import { listFeed, createPost, editPost, deletePost, type PostMutReason } from "@/lib/social-store";
import { extractMentionEmails, notifyEmails, preview } from "@/lib/mention-notify";

export const dynamic = "force-dynamic";

function statusForReason(reason?: PostMutReason): number {
  return reason === "forbidden" ? 403 : reason === "expired" ? 409 : reason === "notfound" ? 404 : 400;
}

// GET /api/v1/social/feed?deviceId=...&filter=all|follow&offset=0  (20'şer sayfalama)
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const deviceId = sp.get("deviceId")?.trim();
  if (!deviceId) return NextResponse.json({ error: "deviceId zorunlu" }, { status: 400 });
  const filter = sp.get("filter") === "follow" ? "follow" : "all";
  const offset = Number(sp.get("offset") ?? "0") || 0;
  const data = await listFeed({ deviceId, filter, offset });
  return NextResponse.json({ ok: true, data });
}

// PATCH /api/v1/social/feed  {id, authorId, text}  — kendi gönderini 10 dk içinde düzenle
export async function PATCH(request: NextRequest) {
  let body: { id?: string; authorId?: string; text?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const id = body.id?.trim();
  const authorId = body.authorId?.trim();
  const text = body.text?.trim();
  if (!id || !authorId || !text) return NextResponse.json({ error: "id/authorId/text zorunlu" }, { status: 400 });
  const res = await editPost({ id, authorId, text });
  return NextResponse.json(res, { status: res.ok ? 200 : statusForReason(res.reason) });
}

// DELETE /api/v1/social/feed  {id, authorId}  — kendi gönderini 10 dk içinde sil
export async function DELETE(request: NextRequest) {
  let body: { id?: string; authorId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const id = body.id?.trim();
  const authorId = body.authorId?.trim();
  if (!id || !authorId) return NextResponse.json({ error: "id/authorId zorunlu" }, { status: 400 });
  const res = await deletePost({ id, authorId });
  return NextResponse.json(res, { status: res.ok ? 200 : statusForReason(res.reason) });
}

// POST /api/v1/social/feed — gönderi oluştur
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const authorId = typeof body.authorId === "string" ? body.authorId.trim() : "";
  if (!authorId) return NextResponse.json({ error: "authorId zorunlu" }, { status: 400 });
  const hasContent = body.text || body.imageUrl || body.eventSlug;
  if (!hasContent) return NextResponse.json({ error: "İçerik boş" }, { status: 400 });
  const post = await createPost({
    authorId,
    authorName: (body.authorName as string) ?? null,
    authorAvatar: (body.authorAvatar as string) ?? null,
    text: (body.text as string) ?? null,
    imageUrl: (body.imageUrl as string) ?? null,
    eventSlug: (body.eventSlug as string) ?? null,
    eventTitle: (body.eventTitle as string) ?? null,
  });

  // @mention → gönderi metninde geçen email'lere bildirim (Meydan duvarına yönlendir).
  const text = typeof body.text === "string" ? body.text : "";
  const emails = extractMentionEmails(text);
  if (emails.length) {
    const who = (typeof body.authorName === "string" && body.authorName.trim()) || "Biri";
    void notifyEmails(emails, {
      title: `${who} bir gönderide senden bahsetti`,
      body: preview(text),
      data: { type: "feed_post", url: "/" },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, post });
}
