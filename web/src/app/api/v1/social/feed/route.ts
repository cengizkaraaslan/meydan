import { NextResponse, type NextRequest } from "next/server";
import { listFeed, createPost } from "@/lib/social-store";

export const dynamic = "force-dynamic";

// GET /api/v1/social/feed?deviceId=...&filter=all|follow
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const deviceId = sp.get("deviceId")?.trim();
  if (!deviceId) return NextResponse.json({ error: "deviceId zorunlu" }, { status: 400 });
  const filter = sp.get("filter") === "follow" ? "follow" : "all";
  const data = await listFeed({ deviceId, filter });
  return NextResponse.json({ ok: true, data });
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
  return NextResponse.json({ ok: true, post });
}
